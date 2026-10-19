import React, { useState, useRef, useEffect, useCallback } from "react";
import { NAVY, MUTED, BORDER } from "../lib/constants";
import MicButton from "./MicButton";
import NotesEditor from "./NotesEditor";
import { fetchCanvasLists, createCanvasList, updateCanvasList, deleteCanvasList } from "../lib/api";

// Turn a Supabase error into a short, useful message. The common one right now
// is the table not existing yet (migration not run).
function describe(e) {
  const code = e?.code || "";
  if (code === "PGRST205" || /canvas_lists/.test(e?.message || "")) {
    return "Lists aren't set up on the database yet — run the canvas_lists migration in Supabase.";
  }
  return "Couldn't save — check your connection.";
}

// One list card: an optional title and a NotesEditor body, each debounced-saved
// independently. Flushes any pending save if it unmounts (e.g. day/scope change
// or removal), so nothing in-flight is lost.
function ListCard({ list, onPatch, onRemove, speechLang }) {
  const [title, setTitle] = useState(list.title || "");
  const [body, setBody] = useState(list.body || "");
  const [status, setStatus] = useState("");
  const timer = useRef(null);
  const pending = useRef(null);
  const bodyRef = useRef(body);
  bodyRef.current = body;

  // Re-sync only when a genuinely different list lands in this slot.
  useEffect(() => {
    setTitle(list.title || "");
    setBody(list.body || "");
  }, [list.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const schedule = useCallback((patch) => {
    pending.current = { ...(pending.current || {}), ...patch };
    setStatus("Saving…");
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const p = pending.current;
      pending.current = null;
      try { await onPatch(list.id, p); setStatus("Saved"); }
      catch { setStatus("Save failed"); }
    }, 800);
  }, [list.id, onPatch]);

  useEffect(() => () => {
    clearTimeout(timer.current);
    if (pending.current) onPatch(list.id, pending.current).catch(() => {});
  }, [list.id, onPatch]);

  function changeTitle(v) { setTitle(v); schedule({ title: v }); }
  function changeBody(v) { setBody(v); schedule({ body: v }); }
  function appendBody(text) {
    const cur = bodyRef.current || "";
    changeBody(cur ? `${cur}${/\s$/.test(cur) ? "" : " "}${text}` : text);
  }

  return (
    <div className="rounded-xl p-3" style={{ border: `1px solid ${BORDER}` }}>
      <div className="flex items-center gap-2 mb-2">
        <input
          value={title}
          onChange={(e) => changeTitle(e.target.value)}
          placeholder="Untitled list"
          className="flex-1 min-w-0 text-sm font-semibold"
          style={{ border: "none", outline: "none", background: "transparent", color: NAVY }}
        />
        <MicButton onText={appendBody} lang={speechLang} title="Dictate into this list" label="🎙" />
        <button type="button" onClick={() => onRemove(list.id)} className="text-xs px-2 py-1 rounded" style={{ color: "#B3261E", border: "1px solid #F0D9D6" }}>Remove</button>
      </div>
      <NotesEditor value={body} onChange={changeBody} placeholder="Write freely — thoughts, bullets, or check-boxes…" />
      <div className="text-xs mt-1" style={{ color: MUTED }}>{status}</div>
    </div>
  );
}

// The lists panel for a scope: a specific day (date set) or the general,
// date-independent space (date null).
export default function CanvasLists({ date, speechLang }) {
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const dateRef = useRef(date);
  dateRef.current = date;

  const load = useCallback(async (d) => {
    setLoading(true);
    setErr("");
    try {
      const data = await fetchCanvasLists(d);
      if (dateRef.current === d) setLists(data || []);
    } catch (e) {
      if (dateRef.current === d) { setLists([]); setErr(describe(e)); }
    } finally {
      if (dateRef.current === d) setLoading(false);
    }
  }, []);

  useEffect(() => { load(date); }, [date, load]);

  async function addList() {
    setErr("");
    try {
      const row = await createCanvasList({ date: date ?? null, title: null, body: "", position: lists.length });
      setLists((l) => [...l, row]);
    } catch (e) {
      setErr(describe(e));
    }
  }

  const patchList = useCallback(async (id, patch) => {
    await updateCanvasList(id, patch);
    setLists((l) => l.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }, []);

  async function removeList(id) {
    if (!window.confirm("Remove this list?")) return;
    try {
      await deleteCanvasList(id);
      setLists((l) => l.filter((x) => x.id !== id));
    } catch { /* leave it in place on failure */ }
  }

  return (
    <div className="flex flex-col gap-3">
      {loading ? (
        <div className="text-xs" style={{ color: MUTED }}>Loading…</div>
      ) : lists.length === 0 ? (
        <div className="text-xs" style={{ color: "#C8C3B8" }}>No lists yet — add one below.</div>
      ) : (
        lists.map((l) => (
          <ListCard key={l.id} list={l} onPatch={patchList} onRemove={removeList} speechLang={speechLang} />
        ))
      )}
      <button type="button" onClick={addList} className="text-xs px-3 py-1.5 rounded-full font-medium self-start" style={{ background: NAVY, color: "#fff" }}>
        + Add list
      </button>
      {err && <div className="text-xs" style={{ color: "#B3261E" }}>{err}</div>}
    </div>
  );
}
