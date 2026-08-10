import React, { useMemo } from "react";
import { segColor, segName, PRIORITIES, NAVY, MUTED, BORDER } from "../lib/constants";
import { PriorityBadge, StatusBadge } from "./shared";
import { parseISO, toISO, addDays, formatTime } from "../lib/dateUtils";

// Sort within a bucket: earlier due date first, then timed items by clock time
// (untimed last), then by priority.
function sortItems(a, b) {
  const d = (a.due_date || "").localeCompare(b.due_date || "");
  if (d !== 0) return d;
  const at = a.start_time || "99:99";
  const bt = b.start_time || "99:99";
  if (at !== bt) return at.localeCompare(bt);
  return PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority);
}

function Row({ item, onSelectItem }) {
  const done = item.status === "Done";
  const time = formatTime(item.start_time);
  return (
    <button
      type="button"
      onClick={() => onSelectItem(item)}
      className="w-full text-left rounded-lg p-3 flex items-center gap-3"
      style={{ border: "1px solid #EEEBE4", background: "#fff", opacity: done ? 0.6 : 1 }}
    >
      <span style={{ width: 10, height: 10, borderRadius: 9999, background: segColor(item.segment), flexShrink: 0 }} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate" style={{ textDecoration: done ? "line-through" : "none" }}>
          {item.title}
        </div>
        <div className="text-xs" style={{ color: MUTED }}>
          {segName(item.segment)}
          {item.project_name ? ` · ${item.project_name}` : ""}
          {" · due "}{item.due_date}
          {time ? ` · ${time}` : ""}
          {" · "}{item.hours}h
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <StatusBadge status={item.status} />
        <PriorityBadge priority={item.priority} />
      </div>
    </button>
  );
}

function Section({ title, accent, items, onSelectItem }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span style={{ width: 8, height: 8, borderRadius: 9999, background: accent, display: "inline-block" }} />
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: MUTED }}>
          {title} ({items.length})
        </span>
      </div>
      {items.length === 0 ? (
        <div className="text-sm py-2" style={{ color: "#C8C3B8" }}>Nothing here.</div>
      ) : (
        <div className="space-y-2">
          {items.map((it) => <Row key={`${it.kind}-${it.id}`} item={it} onSelectItem={onSelectItem} />)}
        </div>
      )}
    </div>
  );
}

export default function TodayView({ items, onSelectItem }) {
  const { overdue, today, tomorrow } = useMemo(() => {
    const now = new Date();
    const todayIso = toISO(now);
    const tomorrowIso = toISO(addDays(now, 1));
    const todayStart = parseISO(todayIso);

    const overdue = [];
    const today = [];
    const tomorrow = [];
    items.forEach((it) => {
      if (!it.due_date) return;
      // Completed work shouldn't nag from the overdue pile.
      if (it.status === "Done" && it.due_date < todayIso) return;
      const due = parseISO(it.due_date);
      if (due < todayStart) overdue.push(it);
      else if (it.due_date === todayIso) today.push(it);
      else if (it.due_date === tomorrowIso) tomorrow.push(it);
    });
    overdue.sort(sortItems);
    today.sort(sortItems);
    tomorrow.sort(sortItems);
    return { overdue, today, tomorrow };
  }, [items]);

  const total = overdue.length + today.length + tomorrow.length;
  const heading = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 md:p-6" style={{ border: `1px solid ${BORDER}` }}>
      <div className="flex items-baseline justify-between mb-5">
        <div className="font-semibold text-lg" style={{ color: NAVY }}>{heading}</div>
        <div className="text-xs" style={{ color: MUTED }}>{total} item{total !== 1 ? "s" : ""} needing attention</div>
      </div>

      {total === 0 ? (
        <div className="text-sm py-8 text-center" style={{ color: MUTED }}>
          You're all caught up — nothing overdue, due today, or due tomorrow. 🎉
        </div>
      ) : (
        <>
          <Section title="Overdue" accent="#B3261E" items={overdue} onSelectItem={onSelectItem} />
          <Section title="Due today" accent={NAVY} items={today} onSelectItem={onSelectItem} />
          <Section title="Due tomorrow" accent="#2F855A" items={tomorrow} onSelectItem={onSelectItem} />
        </>
      )}
    </div>
  );
}
