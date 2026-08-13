import React from "react";
import { segColor, segName, statusStyle, INK, MUTED, BORDER } from "../lib/constants";
import { formatTime, formatShortDate } from "../lib/dateUtils";

export function ItemPill({ item, onClick, onMouseEnter, onMouseMove, onMouseLeave }) {
  const time = formatTime(item.start_time);
  const done = item.status === "Done";
  return (
    <div
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      className="text-xs px-2 py-1 rounded mb-1 truncate"
      style={{
        background: `${segColor(item.segment)}1A`,
        borderLeft: `3px solid ${segColor(item.segment)}`,
        color: INK,
        opacity: done ? 0.55 : 1,
        textDecoration: done ? "line-through" : "none",
        cursor: onClick ? "pointer" : "default",
      }}
    >
      {time ? <span style={{ fontVariantNumeric: "tabular-nums", opacity: 0.75 }}>{time} </span> : null}
      {item.title}
    </div>
  );
}

export function PriorityBadge({ priority }) {
  const map = {
    High: { bg: "#FDECEA", color: "#B3261E" },
    Medium: { bg: "#FFF4E0", color: "#8A5A00" },
    Low: { bg: "#EAF2FE", color: "#1E4B8F" },
  };
  const s = map[priority] || { bg: "#EEE", color: "#555" };
  return (
    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: s.bg, color: s.color }}>
      {priority}
    </span>
  );
}

export function StatusBadge({ status }) {
  const s = statusStyle(status);
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1.5 whitespace-nowrap"
      style={{ background: s.bg, color: s.color }}
    >
      <span style={{ width: 6, height: 6, borderRadius: 9999, background: s.dot, display: "inline-block" }} />
      {status || "Not Started"}
    </span>
  );
}

// A rich detail card for a single item — reused by the Calendar hover popup and
// the Gantt tooltip. Shows every field a task/step carries.
function DetailRow({ label, children }) {
  return (
    <div className="flex items-baseline gap-2 text-xs">
      <span style={{ color: MUTED, minWidth: 58, flexShrink: 0 }}>{label}</span>
      <span style={{ color: INK }}>{children}</span>
    </div>
  );
}

export function TaskDetailCard({ item }) {
  const time = formatTime(item.start_time);
  const isStep = !!item.project_name;
  const dateText =
    isStep && item.start_date && item.start_date !== item.due_date
      ? `${formatShortDate(item.start_date)} → ${formatShortDate(item.due_date)}`
      : formatShortDate(item.due_date);

  return (
    <div
      style={{
        width: 252,
        background: "#fff",
        border: `1px solid ${BORDER}`,
        borderRadius: 12,
        boxShadow: "0 10px 30px rgba(31,56,100,0.16)",
        padding: 12,
        textAlign: "left",
      }}
    >
      <div className="flex items-start gap-2 mb-2">
        <span style={{ width: 10, height: 10, borderRadius: 9999, background: segColor(item.segment), marginTop: 4, flexShrink: 0 }} />
        <div className="text-sm font-semibold" style={{ color: INK, lineHeight: 1.3 }}>{item.title}</div>
      </div>
      <div className="flex flex-wrap gap-1.5 mb-2.5">
        <StatusBadge status={item.status} />
        <PriorityBadge priority={item.priority} />
      </div>
      <div className="flex flex-col gap-1">
        <DetailRow label="Segment">{segName(item.segment)}</DetailRow>
        {isStep && <DetailRow label="Project">{item.project_name}</DetailRow>}
        <DetailRow label={isStep && dateText.includes("→") ? "Dates" : "Due"}>{dateText}</DetailRow>
        {time && <DetailRow label="Start">{time}</DetailRow>}
        <DetailRow label="Hours">{item.hours}h</DetailRow>
      </div>
    </div>
  );
}
