import React, { useState, useRef, useEffect, useCallback } from "react";
import { NAVY, MUTED, BORDER, BG } from "../lib/constants";
import { toISO, addDays, parseISO } from "../lib/dateUtils";
import {
  fetchCanvasDay, saveCanvasDay, fetchCanvasFiles, addCanvasFileRow,
  deleteCanvasFileRow, uploadCanvasObject, signedCanvasUrl, removeCanvasObject,
} from "../lib/api";

const W = 900; // sketch internal resolution
const H = 520;
const SWATCHES = ["#1F3864", "#111827", "#B3261E", "#2F855A", "#2E5395", "#B8860B", "#6B4FA0"];

function bytes(n) {
  if (n == null) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function canvasToBlob(c) {
  return new Promise((res) => c.toBlob(res, "image/png"));
}

// A per-day workspace: free writing, a free-hand sketch, and file attachments.
// Everything is keyed by the selected date, so any day can be revisited.
export default function CanvasView() {
  const [date, setDate] = useState(toISO(new Date()));
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [color, setColor] = useState(SWATCHES[0]);
  const [erasing, setErasing] = useState(false);
  const [brush, setBrush] = useState(3);

  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const drawing = useRef(false);
  const last = useRef(null);
  const undo = useRef([]);
  const sketchDirty = useRef(false);
  const notesTimer = useRef(null);
  const sketchTimer = useRef(null);
  const dateRef = useRef(date);
  const notesRef = useRef(notes);
  dateRef.current = date;
  notesRef.current = notes;

  // Set up the 2D context once.
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, W, H);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctxRef.current = ctx;
  }, []);

  const loadDay = useCallback(async (d) => {
    setLoading(true);
    setStatus("");
    try {
      const [day, fl] = await Promise.all([fetchCanvasDay(d), fetchCanvasFiles(d)]);
      if (dateRef.current !== d) return;
      setNotes(day?.notes || "");
      setFiles(fl || []);
      const ctx = ctxRef.current;
      if (ctx) {
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, W, H);
        undo.current = [];
        sketchDirty.current = false;
        if (day?.sketch_path) {
          const url = await signedCanvasUrl(day.sketch_path);
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => { if (dateRef.current === d && ctxRef.current) ctxRef.current.drawImage(img, 0, 0, W, H); };
          img.src = url;
        }
      }
    } catch {
      setStatus("Couldn't load this day");
    } finally {
      if (dateRef.current === d) setLoading(false);
    }
  }, []);

  useEffect(() => { loadDay(date); }, [date, loadDay]);

  // Best-effort save of notes when leaving the Canvas.
  useEffect(() => {
    return () => {
      clearTimeout(notesTimer.current);
      clearTimeout(sketchTimer.current);
      saveCanvasDay(dateRef.current, { notes: notesRef.current }).catch(() => {});
    };
  }, []);

  async function flushThen(d) {
    clearTimeout(notesTimer.current);
    clearTimeout(sketchTimer.current);
    const prev = dateRef.current;
    try {
      const patch = { notes: notesRef.current };
      if (sketchDirty.current && canvasRef.current) {
        const blob = await canvasToBlob(canvasRef.current);
        const path = `sketches/${prev}.png`;
        await uploadCanvasObject(path, blob, "image/png");
        patch.sketch_path = path;
        sketchDirty.current = false;
      }
      await saveCanvasDay(prev, patch);
    } catch { /* best effort */ }
    setDate(d);
  }

  function onNotesChange(v) {
    setNotes(v);
    setStatus("Saving…");
    clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(async () => {
      try { await saveCanvasDay(dateRef.current, { notes: v }); setStatus("Saved"); }
      catch { setStatus("Save failed"); }
    }, 800);
  }

  function scheduleSketchSave() {
    sketchDirty.current = true;
    setStatus("Saving…");
    clearTimeout(sketchTimer.current);
    sketchTimer.current = setTimeout(async () => {
      const d = dateRef.current;
      try {
        const blob = await canvasToBlob(canvasRef.current);
        const path = `sketches/${d}.png`;
        await uploadCanvasObject(path, blob, "image/png");
        await saveCanvasDay(d, { sketch_path: path });
        sketchDirty.current = false;
        setStatus("Saved");
      } catch { setStatus("Save failed"); }
    }, 1500);
  }

  function pointFromEvent(e) {
    const c = canvasRef.current;
    const r = c.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (c.width / r.width), y: (e.clientY - r.top) * (c.height / r.height) };
  }
  function strokeStyle(ctx) {
    ctx.strokeStyle = erasing ? "#fff" : color;
    ctx.lineWidth = erasing ? brush * 5 : brush;
  }
  function onDown(e) {
    e.preventDefault();
    const ctx = ctxRef.current;
    if (!ctx) return;
    undo.current.push(ctx.getImageData(0, 0, W, H));
    if (undo.current.length > 25) undo.current.shift();
    drawing.current = true;
    const p = pointFromEvent(e);
    last.current = p;
    strokeStyle(ctx);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + 0.01, p.y + 0.01);
    ctx.stroke();
    canvasRef.current.setPointerCapture?.(e.pointerId);
  }
  function onMove(e) {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = ctxRef.current;
    const p = pointFromEvent(e);
    strokeStyle(ctx);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
  }
  function onUp() {
    if (!drawing.current) return;
    drawing.current = false;
    scheduleSketchSave();
  }
  function doUndo() {
    const ctx = ctxRef.current;
    const prev = undo.current.pop();
    if (!prev) return;
    ctx.putImageData(prev, 0, 0);
    scheduleSketchSave();
  }
  function doClear() {
    const ctx = ctxRef.current;
    undo.current.push(ctx.getImageData(0, 0, W, H));
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, W, H);
    scheduleSketchSave();
  }

  async function onUpload(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setStatus("Uploading…");
    const d = dateRef.current;
    const id = (crypto.randomUUID && crypto.randomUUID()) || String(Date.now());
    const path = `files/${d}/${id}-${file.name}`;
    try {
      await uploadCanvasObject(path, file, file.type || undefined);
      const row = await addCanvasFileRow({ date: d, name: file.name, path, mime: file.type, size: file.size });
      setFiles((f) => [...f, row]);
      setStatus("Saved");
    } catch { setStatus("Upload failed"); }
  }
  async function openFile(f) {
    try { window.open(await signedCanvasUrl(f.path), "_blank", "noopener"); } catch { setStatus("Couldn't open file"); }
  }
  async function removeFile(f) {
    if (!window.confirm(`Remove "${f.name}"?`)) return;
    try {
      await removeCanvasObject(f.path);
      await deleteCanvasFileRow(f.id);
      setFiles((x) => x.filter((y) => y.id !== f.id));
    } catch { setStatus("Couldn't remove file"); }
  }

  const isToday = date === toISO(new Date());
  const heading = parseISO(date).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const navBtn = "px-3 py-1 rounded-full text-sm";

  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 md:p-6" style={{ border: `1px solid ${BORDER}` }}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => flushThen(toISO(addDays(parseISO(date), -1)))} className={navBtn} style={{ border: `1px solid ${BORDER}` }} aria-label="Previous day">&larr;</button>
          <input type="date" value={date} onChange={(e) => e.target.value && flushThen(e.target.value)} className="border rounded px-3 py-1.5 text-sm" style={{ borderColor: BORDER, color: NAVY }} />
          <button onClick={() => flushThen(toISO(addDays(parseISO(date), 1)))} className={navBtn} style={{ border: `1px solid ${BORDER}` }} aria-label="Next day">&rarr;</button>
          {!isToday && <button onClick={() => flushThen(toISO(new Date()))} className="px-3 py-1 rounded-full text-sm font-medium" style={{ background: BG, color: NAVY, border: `1px solid ${BORDER}` }}>Today</button>}
        </div>
        <div className="text-xs" style={{ color: MUTED }}>{heading}{status ? ` · ${status}` : ""}</div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {/* Sketch */}
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: MUTED }}>Sketch</div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {SWATCHES.map((c) => (
              <button key={c} onClick={() => { setColor(c); setErasing(false); }} title={c}
                style={{ width: 20, height: 20, borderRadius: 9999, background: c, border: color === c && !erasing ? `2px solid ${NAVY}` : "1px solid #0002", outline: "none" }} />
            ))}
            <input type="color" value={color} onChange={(e) => { setColor(e.target.value); setErasing(false); }} title="Custom color" style={{ width: 24, height: 24, padding: 0, border: "none", background: "none" }} />
            <button onClick={() => setErasing((v) => !v)} className="text-xs px-3 py-1 rounded-full" style={erasing ? { background: NAVY, color: "#fff" } : { border: `1px solid ${BORDER}`, color: NAVY }}>Eraser</button>
            <span className="text-xs" style={{ color: MUTED }}>Size</span>
            {[2, 4, 8].map((s) => (
              <button key={s} onClick={() => setBrush(s)} className="text-xs px-2 py-1 rounded-full" style={brush === s ? { background: NAVY, color: "#fff" } : { border: `1px solid ${BORDER}`, color: NAVY }}>{s}</button>
            ))}
            <button onClick={doUndo} className="text-xs px-3 py-1 rounded-full" style={{ border: `1px solid ${BORDER}`, color: NAVY }}>Undo</button>
            <button onClick={doClear} className="text-xs px-3 py-1 rounded-full" style={{ border: "1px solid #F0D9D6", color: "#B3261E" }}>Clear</button>
          </div>
          <canvas
            ref={canvasRef}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerLeave={onUp}
            style={{ width: "100%", aspectRatio: `${W} / ${H}`, touchAction: "none", border: `1px solid ${BORDER}`, borderRadius: 10, background: "#fff", cursor: "crosshair", display: "block" }}
          />
        </div>

        {/* Notes + attachments */}
        <div className="flex flex-col gap-5">
          <div className="flex flex-col">
            <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: MUTED }}>Notes &amp; thoughts</div>
            <textarea
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              placeholder="Write freely — anything on your mind today…"
              className="border rounded-lg px-3 py-2 text-sm"
              style={{ borderColor: BORDER, minHeight: 220, resize: "vertical", lineHeight: 1.5 }}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: MUTED }}>Attachments ({files.length})</div>
              <label className="text-xs px-3 py-1 rounded-full font-medium cursor-pointer" style={{ background: NAVY, color: "#fff" }}>
                + Add file
                <input type="file" onChange={onUpload} style={{ display: "none" }} />
              </label>
            </div>
            {files.length === 0 ? (
              <div className="text-xs" style={{ color: "#C8C3B8" }}>No files attached to this day.</div>
            ) : (
              <div className="space-y-2">
                {files.map((f) => (
                  <div key={f.id} className="flex items-center gap-3 rounded-lg p-2" style={{ border: "1px solid #EEEBE4" }}>
                    <button type="button" onClick={() => openFile(f)} className="flex-1 min-w-0 text-left">
                      <div className="text-sm font-medium truncate" style={{ color: NAVY }}>{f.name}</div>
                      <div className="text-xs" style={{ color: MUTED }}>{bytes(f.size)}{f.mime ? ` · ${f.mime}` : ""}</div>
                    </button>
                    <button type="button" onClick={() => removeFile(f)} className="text-xs px-2 py-1 rounded" style={{ color: "#B3261E", border: "1px solid #F0D9D6" }}>Remove</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {loading && <div className="text-xs mt-3" style={{ color: MUTED }}>Loading this day…</div>}
    </div>
  );
}
