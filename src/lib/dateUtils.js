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
  const r = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
  const day = r.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  r.setDate(r.getDate() + diff);
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

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

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
