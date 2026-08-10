import React, { useMemo } from "react";
import { ItemPill, PriorityBadge } from "./shared";
import { segColor, segName, PRIORITIES, NAVY, MUTED, BORDER, BG, INK } from "../lib/constants";
import { toISO, addDays, startOfWeek, buildMonthGrid, WEEKDAY_LABELS, parseTime, formatHour } from "../lib/dateUtils";

function MonthGrid({ refDate, itemsByDate }) {
  const weeks = buildMonthGrid(refDate);
  const month = refDate.getMonth();
  return (
    <div>
      <div className="grid grid-cols-7 gap-1 mb-1 text-xs font-medium" style={{ color: MUTED }}>
        {WEEKDAY_LABELS.map((w) => (
          <div key={w} className="px-1">{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {weeks.flat().map((dt, i) => {
          const iso = toISO(dt);
          const dayItems = itemsByDate[iso] || [];
          const outside = dt.getMonth() !== month;
          return (
            <div
              key={i}
              className="rounded-lg p-2"
              style={{ minHeight: 92, background: outside ? "#FAFAF8" : "#fff", border: "1px solid #EEEBE4" }}
            >
              <div className="text-xs mb-1" style={{ color: outside ? "#B7B2A6" : MUTED }}>{dt.getDate()}</div>
              {dayItems.slice(0, 3).map((it) => <ItemPill key={it.id} item={it} />)}
              {dayItems.length > 3 && (
                <div className="text-xs" style={{ color: MUTED }}>+{dayItems.length - 3} more</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekGrid({ refDate, itemsByDate }) {
  const start = startOfWeek(refDate);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map((dt, i) => {
        const iso = toISO(dt);
        const dayItems = itemsByDate[iso] || [];
        return (
          <div key={i} className="rounded-lg p-2" style={{ minHeight: 160, border: "1px solid #EEEBE4" }}>
            <div className="text-xs font-medium mb-2" style={{ color: MUTED }}>{WEEKDAY_LABELS[i]} {dt.getDate()}</div>
            {dayItems.map((it) => <ItemPill key={it.id} item={it} />)}
            {dayItems.length === 0 && <div className="text-xs" style={{ color: "#C8C3B8" }}>—</div>}
          </div>
        );
      })}
    </div>
  );
}

const HOUR_HEIGHT = 56; // px per hour row
const GUTTER = 56; // px width of the left time-label column

// An hour-by-hour timeline for a single day. Items with a start_time are placed
// on the grid at their hour/minute; items without one appear in an "All day /
// untimed" strip above the timeline. When several timed items share the same
// hour they're laid out side by side so none is hidden.
function DayTimeline({ refDate, itemsByDate }) {
  const iso = toISO(refDate);
  const dayItems = itemsByDate[iso] || [];

  const timed = [];
  const untimed = [];
  dayItems.forEach((it) => (parseTime(it.start_time) ? timed : untimed).push(it));

  // Visible hour window: default 7:00–21:00, widened to include any timed item.
  let startHour = 7;
  let endHour = 21;
  timed.forEach((it) => {
    const { h } = parseTime(it.start_time);
    startHour = Math.min(startHour, h);
    endHour = Math.max(endHour, h + 1);
  });
  startHour = Math.max(0, startHour);
  endHour = Math.min(24, endHour);
  const hours = [];
  for (let h = startHour; h <= endHour; h++) hours.push(h);
  const bodyHeight = (endHour - startHour) * HOUR_HEIGHT;

  // Group timed items by hour so overlapping ones can be split into columns.
  const byHour = {};
  timed.forEach((it) => {
    const { h } = parseTime(it.start_time);
    (byHour[h] = byHour[h] || []).push(it);
  });
  Object.values(byHour).forEach((arr) =>
    arr.sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""))
  );

  // "Now" indicator, only when viewing today.
  const now = new Date();
  const isToday = toISO(now) === iso;
  const nowTop = ((now.getHours() + now.getMinutes() / 60) - startHour) * HOUR_HEIGHT;
  const showNow = isToday && now.getHours() >= startHour && now.getHours() <= endHour;

  return (
    <div>
      <div className="mb-3">
        <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: MUTED }}>
          All day / untimed ({untimed.length})
        </div>
        {untimed.length === 0 ? (
          <div className="text-xs" style={{ color: "#C8C3B8" }}>Nothing untimed.</div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {untimed
              .slice()
              .sort((a, b) => PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority))
              .map((it) => (
                <div key={`${it.kind}-${it.id}`} style={{ maxWidth: 220 }}>
                  <ItemPill item={it} />
                </div>
              ))}
          </div>
        )}
      </div>

      <div className="relative" style={{ height: bodyHeight, marginLeft: GUTTER }}>
        {/* hour grid lines + labels */}
        {hours.map((h, i) => (
          <div key={h} style={{ position: "absolute", top: i * HOUR_HEIGHT, left: 0, right: 0, height: HOUR_HEIGHT }}>
            <div style={{ position: "absolute", top: -7, left: -GUTTER, width: GUTTER - 8, textAlign: "right", fontSize: 11, color: MUTED }}>
              {h < 24 ? formatHour(h) : ""}
            </div>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, borderTop: "1px solid #EEEBE4" }} />
          </div>
        ))}

        {/* now indicator */}
        {showNow && (
          <div style={{ position: "absolute", top: nowTop, left: 0, right: 0, zIndex: 5 }}>
            <div style={{ position: "absolute", left: -6, top: -4, width: 8, height: 8, borderRadius: 9999, background: "#B3261E" }} />
            <div style={{ borderTop: "2px solid #B3261E" }} />
          </div>
        )}

        {/* timed items */}
        {timed.map((it) => {
          const { h, m } = parseTime(it.start_time);
          const group = byHour[h];
          const col = group.indexOf(it);
          const cols = group.length;
          const top = (h - startHour + m / 60) * HOUR_HEIGHT;
          const widthPct = 100 / cols;
          const done = it.status === "Done";
          const color = segColor(it.segment);
          return (
            <div
              key={`${it.kind}-${it.id}`}
              title={`${it.title} — ${segName(it.segment)} · ${it.priority} · ${it.status || "Not Started"} · ${it.hours}h${it.project_name ? ` · ${it.project_name}` : ""}`}
              style={{
                position: "absolute",
                top,
                left: `calc(${col * widthPct}% + 2px)`,
                width: `calc(${widthPct}% - 4px)`,
                minHeight: HOUR_HEIGHT - 8,
                background: `${color}1A`,
                borderLeft: `3px solid ${color}`,
                borderRadius: 6,
                padding: "4px 6px",
                overflow: "hidden",
                opacity: done ? 0.6 : 1,
                zIndex: 2,
              }}
            >
              <div className="text-xs font-medium truncate" style={{ color: INK, textDecoration: done ? "line-through" : "none" }}>
                {formatHour(h, m)} · {it.title}
              </div>
              <div className="text-xs truncate" style={{ color: MUTED }}>
                {it.project_name ? `${it.project_name} · ` : ""}{it.hours}h
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function CalendarView({ items, granularity, setGranularity, refDate, setRefDate }) {
  const itemsByDate = useMemo(() => {
    const map = {};
    items.forEach((it) => {
      if (!it.due_date) return;
      map[it.due_date] = map[it.due_date] || [];
      map[it.due_date].push(it);
    });
    return map;
  }, [items]);

  function shift(n) {
    if (granularity === "month") setRefDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + n, 1));
    else if (granularity === "week") setRefDate((prev) => addDays(prev, 7 * n));
    else setRefDate((prev) => addDays(prev, n));
  }

  const label =
    granularity === "month"
      ? refDate.toLocaleDateString(undefined, { month: "long", year: "numeric" })
      : granularity === "week"
      ? `Week of ${toISO(startOfWeek(refDate))}`
      : refDate.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 md:p-6" style={{ border: `1px solid ${BORDER}` }}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <button onClick={() => shift(-1)} className="px-3 py-1 rounded-full text-sm" style={{ border: `1px solid ${BORDER}` }}>&larr;</button>
          <div className="font-semibold" style={{ color: NAVY }}>{label}</div>
          <button onClick={() => shift(1)} className="px-3 py-1 rounded-full text-sm" style={{ border: `1px solid ${BORDER}` }}>&rarr;</button>
        </div>
        <div className="flex gap-1">
          {["day", "week", "month"].map((g) => (
            <button
              key={g}
              onClick={() => setGranularity(g)}
              className="px-3 py-1 rounded-full text-sm capitalize"
              style={granularity === g ? { background: NAVY, color: "#fff" } : { background: BG, color: "#22303F" }}
            >
              {g}
            </button>
          ))}
        </div>
      </div>
      {granularity === "month" && <MonthGrid refDate={refDate} itemsByDate={itemsByDate} />}
      {granularity === "week" && <WeekGrid refDate={refDate} itemsByDate={itemsByDate} />}
      {granularity === "day" && <DayTimeline refDate={refDate} itemsByDate={itemsByDate} />}
    </div>
  );
}
