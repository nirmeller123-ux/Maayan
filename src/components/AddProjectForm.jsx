import React, { useState } from "react";
import { SEGMENTS, PRIORITIES, STATUSES, NAVY, BORDER, MUTED } from "../lib/constants";
import { toISO, addDays, timeInputValue } from "../lib/dateUtils";
import RangePicker from "./RangePicker";

function blankRow() {
  return {
    title: "",
    start_date: toISO(addDays(new Date(), 7)),
    due_date: toISO(addDays(new Date(), 9)),
    start_time: "",
    hours: 2,
    priority: "Medium",
    status: "Not Started",
  };
}

export default function AddProjectForm({ mode = "create", initialProject, onCancel, onSubmit, onDelete }) {
  const [name, setName] = useState(initialProject ? initialProject.name : "");
  const [segment, setSegment] = useState(initialProject ? initialProject.segment : SEGMENTS[0].id);
  const [rows, setRows] = useState(
    initialProject && initialProject.tasks.length > 0
      ? initialProject.tasks.map((t) => ({
          id: t.id,
          title: t.title,
          start_date: t.start_date,
          due_date: t.due_date,
          start_time: timeInputValue(t.start_time),
          hours: t.hours,
          priority: t.priority,
          status: t.status || "Not Started",
        }))
      : [blankRow()]
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function updateRow(i, patch) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function addRow() {
    setRows((prev) => [...prev, blankRow()]);
  }
  function removeRow(i) {
    setRows((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));
  }

  async function submit(e) {
    e.preventDefault();
    if (!name.trim() || rows.some((r) => !r.title.trim())) return;
    setSaving(true);
    try {
      await onSubmit({
        id: initialProject ? initialProject.id : undefined,
        name: name.trim(),
        segment,
        steps: rows.map((r) => ({
          ...r,
          hours: Number(r.hours) || 0,
          start_time: r.start_time ? r.start_time : null,
        })),
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete "${name}" and all its steps? This can't be undone.`)) return;
    setDeleting(true);
    try {
      await onDelete(initialProject.id);
    } finally {
      setDeleting(false);
    }
  }

  const fieldLabel = "text-xs font-medium mb-1 block";

  return (
    <form onSubmit={submit} className="bg-white rounded-2xl shadow-sm p-4 md:p-6 mb-6" style={{ border: `1px solid ${NAVY}` }}>
      <div className="text-sm font-semibold mb-3" style={{ color: NAVY }}>
        {mode === "edit" ? "Edit Project" : "New Project"}
      </div>
      <div className="grid gap-3 md:grid-cols-3 mb-4">
        <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Project name" className="md:col-span-2 border rounded px-3 py-2 text-sm" style={{ borderColor: BORDER }} />
        <select value={segment} onChange={(e) => setSegment(e.target.value)} className="border rounded px-3 py-2 text-sm" style={{ borderColor: BORDER }}>
          {SEGMENTS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <div className="text-xs font-medium mb-2" style={{ color: MUTED }}>Steps (each step depends on the one before it)</div>
      <div className="space-y-3 mb-3">
        {rows.map((r, i) => (
          <div key={r.id || `new-${i}`} className="rounded-lg p-3" style={{ border: "1px solid #EEEBE4", background: "#FCFBF9" }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold" style={{ color: NAVY }}>Step {i + 1}</span>
              {rows.length > 1 && (
                <button type="button" onClick={() => removeRow(i)} className="text-xs ml-auto px-2 py-0.5 rounded" style={{ color: "#B3261E", border: "1px solid #F0D9D6" }}>Remove</button>
              )}
            </div>
            <div className="grid gap-2 md:grid-cols-12 items-end">
              <div className="md:col-span-4">
                <label className={fieldLabel} style={{ color: MUTED }}>Title</label>
                <input required value={r.title} onChange={(e) => updateRow(i, { title: e.target.value })} placeholder={`Step ${i + 1} title`} className="w-full border rounded px-2 py-1.5 text-sm" style={{ borderColor: BORDER }} />
              </div>
              <div className="md:col-span-3">
                <label className={fieldLabel} style={{ color: MUTED }}>Dates</label>
                <RangePicker
                  start_date={r.start_date}
                  due_date={r.due_date}
                  onChange={({ start_date, due_date }) => updateRow(i, { start_date, due_date })}
                />
              </div>
              <div className="md:col-span-2">
                <label className={fieldLabel} style={{ color: MUTED }}>Start time</label>
                <input type="time" value={r.start_time} onChange={(e) => updateRow(i, { start_time: e.target.value })} className="w-full border rounded px-2 py-1.5 text-sm" style={{ borderColor: BORDER }} />
              </div>
              <div className="md:col-span-1">
                <label className={fieldLabel} style={{ color: MUTED }}>Hrs</label>
                <input type="number" min="0" step="0.5" value={r.hours} onChange={(e) => updateRow(i, { hours: e.target.value })} className="w-full border rounded px-2 py-1.5 text-sm" style={{ borderColor: BORDER }} />
              </div>
              <div className="md:col-span-2">
                <label className={fieldLabel} style={{ color: MUTED }}>Priority</label>
                <select value={r.priority} onChange={(e) => updateRow(i, { priority: e.target.value })} className="w-full border rounded px-2 py-1.5 text-sm" style={{ borderColor: BORDER }}>
                  {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="md:col-span-3">
                <label className={fieldLabel} style={{ color: MUTED }}>Status</label>
                <select value={r.status} onChange={(e) => updateRow(i, { status: e.target.value })} className="w-full border rounded px-2 py-1.5 text-sm" style={{ borderColor: BORDER }}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </div>
        ))}
      </div>
      <button type="button" onClick={addRow} className="text-sm font-medium mb-4" style={{ color: NAVY }}>+ Add step</button>
      <div className="flex items-center justify-between gap-2">
        <div>
          {mode === "edit" && (
            <button type="button" onClick={handleDelete} disabled={deleting} className="px-4 py-2 rounded-full text-sm" style={{ border: "1px solid #B3261E", color: "#B3261E", opacity: deleting ? 0.6 : 1 }}>
              {deleting ? "Deleting…" : "Delete Project"}
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} className="px-4 py-2 rounded-full text-sm" style={{ border: `1px solid ${BORDER}` }}>Cancel</button>
          <button type="submit" disabled={saving} className="px-4 py-2 rounded-full text-sm font-medium" style={{ background: NAVY, color: "#fff", opacity: saving ? 0.6 : 1 }}>
            {saving ? "Saving…" : mode === "edit" ? "Save Changes" : "Save Project"}
          </button>
        </div>
      </div>
    </form>
  );
}
