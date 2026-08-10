import React, { useState } from "react";
import { SEGMENTS, PRIORITIES, STATUSES, NAVY, BORDER, MUTED } from "../lib/constants";
import { toISO, addDays, timeInputValue } from "../lib/dateUtils";

export default function AddTaskForm({ mode = "create", initialTask, onCancel, onSubmit, onDelete }) {
  const [title, setTitle] = useState(initialTask ? initialTask.title : "");
  const [dueDate, setDueDate] = useState(initialTask ? initialTask.due_date : toISO(addDays(new Date(), 7)));
  const [startTime, setStartTime] = useState(initialTask ? timeInputValue(initialTask.start_time) : "");
  const [priority, setPriority] = useState(initialTask ? initialTask.priority : "Medium");
  const [status, setStatus] = useState(initialTask ? initialTask.status || "Not Started" : "Not Started");
  const [hours, setHours] = useState(initialTask ? initialTask.hours : 1);
  const [segment, setSegment] = useState(initialTask ? initialTask.segment : SEGMENTS[0].id);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSubmit({
        id: initialTask ? initialTask.id : undefined,
        title: title.trim(),
        due_date: dueDate,
        start_time: startTime ? startTime : null,
        priority,
        status,
        hours: Number(hours) || 0,
        segment,
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete "${title}"? This can't be undone.`)) return;
    setDeleting(true);
    try {
      await onDelete(initialTask.id);
    } finally {
      setDeleting(false);
    }
  }

  const fieldLabel = "text-xs font-medium mb-1 block";

  return (
    <form onSubmit={submit} className="bg-white rounded-2xl shadow-sm p-4 md:p-6 mb-6 grid gap-3 md:grid-cols-6" style={{ border: `1px solid ${NAVY}` }}>
      <div className="md:col-span-6 text-sm font-semibold" style={{ color: NAVY }}>
        {mode === "edit" ? "Edit Task" : "New Task"}
      </div>

      <div className="md:col-span-3">
        <label className={fieldLabel} style={{ color: MUTED }}>Title</label>
        <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title" className="w-full border rounded px-3 py-2 text-sm" style={{ borderColor: BORDER }} />
      </div>
      <div>
        <label className={fieldLabel} style={{ color: MUTED }}>Due date</label>
        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" style={{ borderColor: BORDER }} />
      </div>
      <div>
        <label className={fieldLabel} style={{ color: MUTED }}>Start time</label>
        <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" style={{ borderColor: BORDER }} />
      </div>
      <div>
        <label className={fieldLabel} style={{ color: MUTED }}>Hours</label>
        <input type="number" min="0" step="0.5" value={hours} onChange={(e) => setHours(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" style={{ borderColor: BORDER }} placeholder="Hours" />
      </div>

      <div className="md:col-span-2">
        <label className={fieldLabel} style={{ color: MUTED }}>Segment</label>
        <select value={segment} onChange={(e) => setSegment(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" style={{ borderColor: BORDER }}>
          {SEGMENTS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <div className="md:col-span-2">
        <label className={fieldLabel} style={{ color: MUTED }}>Priority</label>
        <select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" style={{ borderColor: BORDER }}>
          {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      <div className="md:col-span-2">
        <label className={fieldLabel} style={{ color: MUTED }}>Status</label>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" style={{ borderColor: BORDER }}>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="flex items-center justify-between gap-2 md:col-span-6">
        <div>
          {mode === "edit" && (
            <button type="button" onClick={handleDelete} disabled={deleting} className="px-4 py-2 rounded-full text-sm" style={{ border: "1px solid #B3261E", color: "#B3261E", opacity: deleting ? 0.6 : 1 }}>
              {deleting ? "Deleting…" : "Delete Task"}
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} className="px-4 py-2 rounded-full text-sm" style={{ border: `1px solid ${BORDER}` }}>Cancel</button>
          <button type="submit" disabled={saving} className="px-4 py-2 rounded-full text-sm font-medium" style={{ background: NAVY, color: "#fff", opacity: saving ? 0.6 : 1 }}>
            {saving ? "Saving…" : mode === "edit" ? "Save Changes" : "Save Task"}
          </button>
        </div>
      </div>
    </form>
  );
}
