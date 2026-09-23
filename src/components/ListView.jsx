import React, { useMemo, useState } from "react";
import { SEGMENTS, PRIORITIES, STATUSES, segColor, segName, NAVY, MUTED, BORDER, BG } from "../lib/constants";
import { PriorityBadge, StatusBadge } from "./shared";
import { parseISO, toISO, addDays, startOfWeek, startOfMonth, formatTime } from "../lib/dateUtils";

const TIME_FRAMES = [
  ["all", "All"],
  ["overdue", "Overdue"],
  ["today", "Today"],
  ["week", "This Week"],
  ["month", "This Month"],
];

function matchesTimeFrame(dueDateStr, frame) {
  if (frame === "all" || !dueDateStr) return true;
  const due = parseISO(dueDateStr);
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (frame === "overdue") return due < todayStart;
  if (frame === "today") return toISO(due) === toISO(todayStart);
  if (frame === "week") {
    const start = startOfWeek(todayStart);
    const end = addDays(start, 6);
    return due >= start && due <= end;
  }
  if (frame === "month") {
    const start = startOfMonth(todayStart);
    const end = new Date(todayStart.getFullYear(), todayStart.getMonth() + 1, 0);
    return due >= start && due <= end;
  }
  return true;
}

export default function ListView({
  tasks,
  projects,
  activeSegments,
  setActiveSegments,
  activePriorities,
  setActivePriorities,
  timeFrame,
  setTimeFrame,
  onSelectTask,
  onSelectProject,
  onBulkStatus,
}) {
  const [selected, setSelected] = useState(() => new Set());
  const [applying, setApplying] = useState(false);

  function toggleSelect(id) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }
  function clearSelection() {
    setSelected(new Set());
  }

  function toggleSegment(id) {
    setActiveSegments((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }
  function togglePriority(p) {
    setActivePriorities((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }

  const filteredTasks = useMemo(() => {
    return tasks
      .filter((t) => t.status !== "Done") // completed tasks drop off the Overview
      .filter((t) => activeSegments.includes(t.segment))
      .filter((t) => activePriorities.includes(t.priority))
      .filter((t) => matchesTimeFrame(t.due_date, timeFrame))
      .slice()
      .sort((a, b) => (a.due_date || "").localeCompare(b.due_date || ""));
  }, [tasks, activeSegments, activePriorities, timeFrame]);

  const filteredProjects = useMemo(() => {
    const noPriorityOrTimeFilter = activePriorities.length === PRIORITIES.length && timeFrame === "all";
    return projects
      .filter((p) => activeSegments.includes(p.segment))
      .map((p) => ({
        ...p,
        matchingTasks: p.tasks.filter(
          (t) => activePriorities.includes(t.priority) && matchesTimeFrame(t.due_date, timeFrame)
        ),
      }))
      .filter((p) => p.matchingTasks.length > 0 || noPriorityOrTimeFilter);
  }, [projects, activeSegments, activePriorities, timeFrame]);

  const allVisibleSelected = filteredTasks.length > 0 && filteredTasks.every((t) => selected.has(t.id));
  function toggleSelectAll() {
    setSelected((prev) => {
      const n = new Set(prev);
      if (filteredTasks.every((t) => n.has(t.id))) filteredTasks.forEach((t) => n.delete(t.id));
      else filteredTasks.forEach((t) => n.add(t.id));
      return n;
    });
  }
  async function applyStatus(status) {
    const ids = [...selected];
    if (!ids.length) return;
    setApplying(true);
    try { await onBulkStatus(ids, status); } finally { setApplying(false); clearSelection(); }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 md:p-6" style={{ border: `1px solid ${BORDER}` }}>
      <div className="flex flex-wrap gap-2 mb-3">
        {SEGMENTS.map((s) => {
          const active = activeSegments.includes(s.id);
          return (
            <button
              key={s.id}
              onClick={() => toggleSegment(s.id)}
              className="text-xs px-3 py-1.5 rounded-full font-medium flex items-center gap-1.5"
              style={
                active
                  ? { background: `${s.color}1A`, border: `1px solid ${s.color}`, color: s.color }
                  : { background: BG, border: `1px solid ${BORDER}`, color: MUTED }
              }
            >
              <span style={{ width: 8, height: 8, borderRadius: 9999, background: s.color }} />
              {s.name}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {PRIORITIES.map((p) => {
          const active = activePriorities.includes(p);
          return (
            <button
              key={p}
              onClick={() => togglePriority(p)}
              className="text-xs px-3 py-1.5 rounded-full font-medium"
              style={active ? { background: NAVY, color: "#fff" } : { background: BG, border: `1px solid ${BORDER}`, color: MUTED }}
            >
              {p}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {TIME_FRAMES.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTimeFrame(key)}
            className="text-xs px-3 py-1.5 rounded-full font-medium"
            style={timeFrame === key ? { background: NAVY, color: "#fff" } : { background: BG, border: `1px solid ${BORDER}`, color: MUTED }}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mb-3 text-xs font-semibold uppercase tracking-wide" style={{ color: MUTED }}>
        Projects ({filteredProjects.length})
      </div>
      <div className="space-y-2 mb-6">
        {filteredProjects.length === 0 && (
          <div className="text-sm py-4" style={{ color: MUTED }}>No projects match these filters.</div>
        )}
        {filteredProjects.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelectProject(p)}
            className="w-full text-left rounded-lg p-3 flex items-center gap-3"
            style={{ border: "1px solid #EEEBE4", background: "#fff" }}
          >
            <span style={{ width: 10, height: 10, borderRadius: 9999, background: segColor(p.segment), flexShrink: 0 }} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{p.name}</div>
              <div className="text-xs" style={{ color: MUTED }}>
                {segName(p.segment)} · {p.tasks.length} step{p.tasks.length !== 1 ? "s" : ""}
                {" · "}{p.tasks.filter((t) => t.status === "Done").length}/{p.tasks.length} done
              </div>
            </div>
            <span className="text-xs" style={{ color: MUTED }}>Edit &rarr;</span>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 mb-3">
        {filteredTasks.length > 0 && (
          <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAll} title="Select all tasks" style={{ accentColor: NAVY, width: 16, height: 16, cursor: "pointer" }} />
        )}
        <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: MUTED }}>
          Tasks ({filteredTasks.length})
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-3 p-2 rounded-lg" style={{ background: `${NAVY}0D`, border: `1px solid ${NAVY}` }}>
          <span className="text-sm font-medium" style={{ color: NAVY }}>{selected.size} selected</span>
          <span className="text-xs" style={{ color: MUTED }}>Set to:</span>
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              disabled={applying}
              onClick={() => applyStatus(s)}
              className="text-xs px-3 py-1 rounded-full font-medium"
              style={{ border: `1px solid ${BORDER}`, background: "#fff", color: NAVY, opacity: applying ? 0.6 : 1 }}
            >
              {s}
            </button>
          ))}
          <button type="button" onClick={clearSelection} className="text-xs px-3 py-1 rounded-full ml-auto" style={{ color: MUTED }}>Clear</button>
        </div>
      )}

      <div className="space-y-2">
        {filteredTasks.length === 0 && (
          <div className="text-sm py-4" style={{ color: MUTED }}>No tasks match these filters.</div>
        )}
        {filteredTasks.map((t) => {
          const isSel = selected.has(t.id);
          return (
            <div
              key={t.id}
              className="w-full rounded-lg p-3 flex items-center gap-3"
              style={{ border: `1px solid ${isSel ? NAVY : "#EEEBE4"}`, background: isSel ? `${NAVY}08` : "#fff" }}
            >
              <input
                type="checkbox"
                checked={isSel}
                onChange={() => toggleSelect(t.id)}
                aria-label={`Select ${t.title}`}
                style={{ accentColor: NAVY, width: 16, height: 16, cursor: "pointer", flexShrink: 0 }}
              />
              <button type="button" onClick={() => onSelectTask(t)} className="flex-1 min-w-0 flex items-center gap-3 text-left">
                <span style={{ width: 10, height: 10, borderRadius: 9999, background: segColor(t.segment), flexShrink: 0 }} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate" style={{ textDecoration: t.status === "Done" ? "line-through" : "none" }}>{t.title}</div>
                  <div className="text-xs" style={{ color: MUTED }}>
                    {segName(t.segment)} · due {t.due_date}{formatTime(t.start_time) ? ` · ${formatTime(t.start_time)}` : ""} · {t.hours}h
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <StatusBadge status={t.status} />
                  <PriorityBadge priority={t.priority} />
                </div>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
