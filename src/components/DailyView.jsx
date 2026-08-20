import React, { useMemo } from "react";
import { segColor, segName, PRIORITIES, NAVY, MUTED, BORDER, BG } from "../lib/constants";
import { PriorityBadge, StatusBadge } from "./shared";
import { parseISO, toISO, addDays, formatTime, spanCovers } from "../lib/dateUtils";

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

// A day-by-day planner. `refDate` is the day being viewed (defaults to today,
// set by the date picker here or by clicking a date in the Calendar). Shows
// what's overdue as of that day, due that day, and due the next day.
export default function DailyView({ items, onSelectItem, refDate, setRefDate }) {
  const selIso = toISO(refDate);
  const nextIso = toISO(addDays(refDate, 1));
  const isToday = selIso === toISO(new Date());

  const { overdue, selected, next } = useMemo(() => {
    const overdue = [];
    const selected = [];
    const next = [];
    items.forEach((it) => {
      if (!it.due_date) return;
      // Span-aware: a multi-day item lands in the earliest bucket it covers.
      if (spanCovers(it, selIso)) selected.push(it);
      else if (spanCovers(it, nextIso)) next.push(it);
      else if (it.due_date < selIso) {
        // Completed work shouldn't nag from the overdue pile.
        if (it.status === "Done") return;
        overdue.push(it);
      }
    });
    overdue.sort(sortItems);
    selected.sort(sortItems);
    next.sort(sortItems);
    return { overdue, selected, next };
  }, [items, selIso, nextIso]);

  const total = overdue.length + selected.length + next.length;
  const fmt = (iso, opts) => parseISO(iso).toLocaleDateString(undefined, opts);
  const selLabel = isToday ? "Due today" : `Due ${fmt(selIso, { weekday: "short", month: "short", day: "numeric" })}`;
  const nextLabel = isToday ? "Due tomorrow" : `Due ${fmt(nextIso, { weekday: "short", month: "short", day: "numeric" })}`;

  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 md:p-6" style={{ border: `1px solid ${BORDER}` }}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setRefDate(addDays(refDate, -1))}
            className="px-3 py-1 rounded-full text-sm"
            style={{ border: `1px solid ${BORDER}` }}
            aria-label="Previous day"
          >&larr;</button>
          <input
            type="date"
            value={selIso}
            onChange={(e) => e.target.value && setRefDate(parseISO(e.target.value))}
            className="border rounded px-3 py-1.5 text-sm"
            style={{ borderColor: BORDER, color: NAVY }}
          />
          <button
            onClick={() => setRefDate(addDays(refDate, 1))}
            className="px-3 py-1 rounded-full text-sm"
            style={{ border: `1px solid ${BORDER}` }}
            aria-label="Next day"
          >&rarr;</button>
          {!isToday && (
            <button
              onClick={() => setRefDate(new Date())}
              className="px-3 py-1 rounded-full text-sm font-medium"
              style={{ background: BG, color: NAVY, border: `1px solid ${BORDER}` }}
            >Today</button>
          )}
        </div>
        <div className="text-xs" style={{ color: MUTED }}>
          {fmt(selIso, { weekday: "long", month: "long", day: "numeric" })}
          {isToday ? " · Today" : ""} · {total} item{total !== 1 ? "s" : ""}
        </div>
      </div>

      {total === 0 ? (
        <div className="text-sm py-8 text-center" style={{ color: MUTED }}>
          Nothing overdue, due {isToday ? "today" : "this day"}, or the next day. 🎉
        </div>
      ) : (
        <>
          <Section title="Overdue" accent="#B3261E" items={overdue} onSelectItem={onSelectItem} />
          <Section title={selLabel} accent={NAVY} items={selected} onSelectItem={onSelectItem} />
          <Section title={nextLabel} accent="#2F855A" items={next} onSelectItem={onSelectItem} />
        </>
      )}
    </div>
  );
}
