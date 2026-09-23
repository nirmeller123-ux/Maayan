import React, { useState, useRef, useEffect, useCallback } from "react";
import { NAVY, MUTED, BORDER, INK } from "../lib/constants";

// The Canvas notes editor: free-form lines plus bullets and clickable
// check-boxes, all in one field. It reads/writes a plain-text string using a
// markdown convention ("- item", "- [ ] todo", "- [x] done"), so it stays
// compatible with voice dictation and the existing text-based autosave — no
// data model change.

let _uid = 0;
const uid = () => `ln${++_uid}`;

function parseLines(str) {
  return (str ?? "").split("\n").map((line) => {
    const todo = line.match(/^- \[([ xX])\]\s?(.*)$/);
    if (todo) return { id: uid(), type: "todo", done: /x/i.test(todo[1]), text: todo[2] };
    const bullet = line.match(/^- (.*)$/);
    if (bullet) return { id: uid(), type: "bullet", done: false, text: bullet[1] };
    return { id: uid(), type: "text", done: false, text: line };
  });
}
function serialize(lines) {
  return lines
    .map((l) => (l.type === "todo" ? `- [${l.done ? "x" : " "}] ${l.text}` : l.type === "bullet" ? `- ${l.text}` : l.text))
    .join("\n");
}

// One line: a single-row textarea that grows to fit wrapped text.
function LineInput({ bindEl, value, onChange, onKeyDown, onFocus, placeholder, done }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (el) { el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; }
  }, [value]);
  return (
    <textarea
      ref={(el) => { ref.current = el; bindEl(el); }}
      rows={1}
      value={value}
      onChange={onChange}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      placeholder={placeholder}
      style={{
        flex: 1, border: "none", outline: "none", resize: "none", overflow: "hidden",
        fontSize: 14, lineHeight: 1.5, padding: "1px 0", background: "transparent",
        fontFamily: "inherit", color: done ? MUTED : INK, textDecoration: done ? "line-through" : "none",
      }}
    />
  );
}

export default function NotesEditor({ value, onChange, placeholder }) {
  const [lines, setLines] = useState(() => parseLines(value));
  const lastSerialized = useRef(value);
  const focusReq = useRef(null); // id to focus after a structural change
  const els = useRef({});
  const [focusedId, setFocusedId] = useState(null);

  // Re-sync when the text changes from outside (day load, voice dictation).
  useEffect(() => {
    if (value !== lastSerialized.current) {
      setLines(parseLines(value));
      lastSerialized.current = value;
    }
  }, [value]);

  // Move focus after inserting/removing a line.
  useEffect(() => {
    const id = focusReq.current;
    if (id && els.current[id]) {
      const el = els.current[id];
      el.focus();
      try { el.setSelectionRange(el.value.length, el.value.length); } catch { /* noop */ }
      focusReq.current = null;
    }
  });

  const commit = useCallback((newLines, focusId) => {
    if (focusId) focusReq.current = focusId;
    setLines(newLines);
    const s = serialize(newLines);
    lastSerialized.current = s; // our own output — don't let the sync effect re-parse it
    onChange(s);
  }, [onChange]);

  const setText = (id, text) => commit(lines.map((l) => (l.id === id ? { ...l, text } : l)));
  const toggleDone = (id) => commit(lines.map((l) => (l.id === id ? { ...l, done: !l.done } : l)));

  function toggleType(type) {
    const id = focusedId || (lines.length ? lines[lines.length - 1].id : null);
    if (!id) return;
    const l = lines.find((x) => x.id === id);
    const next = l && l.type === type ? "text" : type;
    commit(lines.map((x) => (x.id === id ? { ...x, type: next, done: false } : x)), id);
  }

  function onKeyDown(e, idx) {
    const l = lines[idx];
    if (e.key === "Enter") {
      e.preventDefault();
      // Enter on an empty list item exits the list instead of nesting deeper.
      if ((l.type === "todo" || l.type === "bullet") && l.text.trim() === "") {
        commit(lines.map((x, i) => (i === idx ? { ...x, type: "text" } : x)), l.id);
        return;
      }
      const nl = { id: uid(), type: l.type === "todo" || l.type === "bullet" ? l.type : "text", done: false, text: "" };
      commit([...lines.slice(0, idx + 1), nl, ...lines.slice(idx + 1)], nl.id);
    } else if (e.key === "Backspace" && l.text === "") {
      if (l.type !== "text") {
        e.preventDefault();
        commit(lines.map((x, i) => (i === idx ? { ...x, type: "text" } : x)), l.id);
      } else if (idx > 0) {
        e.preventDefault();
        const prev = lines[idx - 1];
        commit(lines.filter((_, i) => i !== idx), prev.id);
      }
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <button type="button" onClick={() => toggleType("bullet")} className="text-xs px-2.5 py-1 rounded-full" style={{ border: `1px solid ${BORDER}`, color: NAVY }}>• Bullet</button>
        <button type="button" onClick={() => toggleType("todo")} className="text-xs px-2.5 py-1 rounded-full" style={{ border: `1px solid ${BORDER}`, color: NAVY }}>☐ Checkbox</button>
      </div>
      <div className="border rounded-lg px-3 py-2" style={{ borderColor: BORDER, minHeight: 220 }}>
        {lines.map((l, idx) => (
          <div key={l.id} className="flex items-start gap-2">
            {l.type === "todo" && (
              <input type="checkbox" checked={l.done} onChange={() => toggleDone(l.id)} style={{ marginTop: 5, cursor: "pointer", accentColor: NAVY, width: 16, height: 16, flexShrink: 0 }} />
            )}
            {l.type === "bullet" && <span style={{ marginTop: 1, color: MUTED, flexShrink: 0 }}>•</span>}
            <LineInput
              bindEl={(el) => { if (el) els.current[l.id] = el; else delete els.current[l.id]; }}
              value={l.text}
              onChange={(e) => setText(l.id, e.target.value)}
              onKeyDown={(e) => onKeyDown(e, idx)}
              onFocus={() => setFocusedId(l.id)}
              placeholder={idx === 0 && lines.length === 1 && !l.text ? placeholder : ""}
              done={l.type === "todo" && l.done}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
