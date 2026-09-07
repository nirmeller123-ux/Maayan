import { HebrewCalendar, flags } from "@hebcal/core";
import { toISO } from "./dateUtils";

// Major chagim + well-known minor holidays (Chanukah, Purim, Tu BiShvat…) +
// modern Israeli national days (Yom HaAtzmaut, Yom HaZikaron, …).
const MASK = flags.CHAG | flags.MODERN_HOLIDAY | flags.MINOR_HOLIDAY;

// Drop a trailing Hebrew year that hebcal appends to a few names ("… 5787").
function cleanName(s) {
  return s.replace(/\s+\d{3,4}$/, "").trim();
}

// Returns { "YYYY-MM-DD": [hebrewName, ...] } for the given date range,
// following Israel observance. Never throws — a bad range yields {}.
export function holidaysByDate(startDate, endDate) {
  const map = {};
  let events;
  try {
    events = HebrewCalendar.calendar({
      start: startDate,
      end: endDate,
      il: true,
      noRoshChodesh: true,
      noMinorFast: true,
      noSpecialShabbat: true,
      sedrot: false,
      omer: false,
    });
  } catch {
    return map;
  }
  for (const ev of events) {
    if ((ev.getFlags() & MASK) === 0) continue;
    const iso = toISO(ev.getDate().greg());
    const name = cleanName(ev.render("he"));
    (map[iso] = map[iso] || []).push(name);
  }
  return map;
}
