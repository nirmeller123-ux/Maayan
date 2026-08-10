import React from "react";
import { segColor, segName, statusStyle, INK } from "../lib/constants";
import { formatTime } from "../lib/dateUtils";

export function ItemPill({ item }) {
  const extra = item.project_name ? ` · ${item.project_name}` : "";
  const time = formatTime(item.start_time);
  const done = item.status === "Done";
  return (
    <div
      title={`${item.title} — ${segName(item.segment)} · ${item.priority} · ${item.status || "Not Started"} · ${item.hours}h${time ? ` · ${time}` : ""}${extra}`}
      className="text-xs px-2 py-1 rounded mb-1 truncate"
      style={{
        background: `${segColor(item.segment)}1A`,
        borderLeft: `3px solid ${segColor(item.segment)}`,
        color: INK,
        opacity: done ? 0.55 : 1,
        textDecoration: done ? "line-through" : "none",
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
