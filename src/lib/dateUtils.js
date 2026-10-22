export function parseISO(s) {
  const [y, m, day] = s.split("-").map(Number);
  return new Date(y, m - 1, day);
}

export function toISO(dt) {
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

export function addDays(dt, n) {
  const r = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
  r.setDate(r.getDate() + n);
  return r;
}

export function startOfWeek(dt) {
  // Weeks start on Sunday (getDay(): 0 = Sunday).
  const r = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
  r.setDate(r.getDate() - r.getDay());
  return r;
}

export function startOfMonth(dt) {
  return new Date(dt.getFullYear(), dt.getMonth(), 1);
}

export function buildMonthGrid(refDate) {
  const gridStart = startOfWeek(startOfMonth(refDate));
  const weeks = [];
  let cursor = gridStart;
  for (let w = 0; w < 6; w++) {
    const week = [];
    for (let i = 0; i < 7; i++) {
      week.push(cursor);
      cursor = addDays(cursor, 1);
    }
    weeks.push(week);
  }
  return weeks;
}

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// "14:30" / "14:30:00" -> { h: 14, m: 30 }, or null for empty/invalid input.
export function parseTime(s) {
  if (!s) return null;
  const [h, m] = String(s).split(":").map(Number);
  if (Number.isNaN(h)) return null;
  return { h, m: Number.isNaN(m) ? 0 : m };
}

// Normalizes a stored time ("14:30:00") to an <input type="time"> value ("14:30").
export function timeInputValue(s) {
  const t = parseTime(s);
  if (!t) return "";
  return `${String(t.h).padStart(2, "0")}:${String(t.m).padStart(2, "0")}`;
}

// 14 -> "2 PM", 9 -> "9 AM", with optional minutes ("2:30 PM").
export function formatHour(h, m = 0) {
  const period = h < 12 ? "AM" : "PM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hour12}:${String(m).padStart(2, "0")} ${period}` : `${hour12} ${period}`;
}

// Formats a stored time string for display ("14:30:00" -> "2:30 PM"), "" if none.
export function formatTime(s) {
  const t = parseTime(s);
  if (!t) return "";
  return formatHour(t.h, t.m);
}

// "2026-08-03" -> "Aug 3" (short month + day), "" for empty input.
export function formatShortDate(iso) {
  if (!iso) return "";
  return parseISO(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Inclusive list of ISO dates from startIso..endIso. Returns [endIso] when
// there's no start (or start is after end). Capped so a bad range can't blow up.
export function eachDayISO(startIso, endIso) {
  if (!endIso) return startIso ? [startIso] : [];
  if (!startIso || startIso > endIso) return [endIso];
  const out = [];
  let cur = parseISO(startIso);
  const end = parseISO(endIso);
  while (cur <= end && out.length < 366) {
    out.push(toISO(cur));
    cur = addDays(cur, 1);
  }
  return out;
}

// Add n calendar months, clamping the day to the target month's last day
// (so Jan 31 + 1 month -> Feb 28/29, not an overflow into March).
export function addMonths(dt, n) {
  const target = new Date(dt.getFullYear(), dt.getMonth() + n, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(dt.getDate(), lastDay));
  return target;
}

// Expand a recurring task into concrete occurrences, preserving the original
// start..due span length on each. freq: 'daily'|'weekly'|'biweekly'|'monthly'.
// Occurrences run from the first date up to (and including) untilIso. Capped so
// a bad range can't create a runaway number of rows.
export function recurrenceOccurrences(startIso, dueIso, freq, untilIso) {
  const first = { start_date: startIso, due_date: dueIso };
  if (!freq || freq === "none" || !untilIso) return [first];
  const spanDays = Math.max(0, Math.round((parseISO(dueIso) - parseISO(startIso)) / 86400000));
  const origin = parseISO(startIso);
  const until = parseISO(untilIso);
  // Each occurrence is computed from the origin (not the previous one) so that a
  // monthly series anchors to the original day-of-month each month, clamping per
  // month (Jan 31 -> Feb 28 -> Mar 31), rather than drifting.
  const at = (k) => {
    if (freq === "daily") return addDays(origin, k);
    if (freq === "weekly") return addDays(origin, k * 7);
    if (freq === "biweekly") return addDays(origin, k * 14);
    if (freq === "monthly") return addMonths(origin, k);
    return null;
  };
  const out = [];
  for (let k = 0; k < 366; k++) {
    const occStart = at(k);
    if (!occStart || occStart > until) break;
    out.push({ start_date: toISO(occStart), due_date: toISO(addDays(occStart, spanDays)) });
  }
  return out.length ? out : [first];
}

// Whether an item's day-span (start_date..due_date) covers a given ISO date.
// A missing start_date means the item lives only on its due_date.
export function spanCovers(item, iso) {
  const start = item.start_date || item.due_date;
  return !!item.due_date && start <= iso && item.due_date >= iso;
}
