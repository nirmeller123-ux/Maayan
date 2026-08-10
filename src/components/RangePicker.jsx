import React, { useState, useRef, useEffect } from "react";
import { NAVY, MUTED, BORDER, BG } from "../lib/constants";
import { parseISO, toISO, buildMonthGrid, WEEKDAY_LABELS } from "../lib/dateUtils";

// A compact, drag-to-select date range picker. Renders a button showing the
// current start→due range; clicking it opens a one-month calendar you can
// click-and-drag across to set the range (press on the start day, drag to the
// end day, release). A single click sets a one-day range. Month arrows let you
// reach other months; an anchor already placed survives navigation so you can
// select ranges that span months (press start, navigate, click end).
//
// Writes back through onChange({ start_date, due_date }) as ISO date strings,
// so the surrounding form keeps using the same two fields it always has.
export default function RangePicker({ start_date, due_date, onChange }) {
  const [open, setOpen] = useState(false);
  const [refDate, setRefDate] = useState(() => parseISO(start_date || toISO(new Date())));
  // While dragging: anchor is the pressed day, hover is the day under the cursor.
  const [anchor, setAnchor] = useState(null); // ISO string or null
  const [hover, setHover] = useState(null); // ISO string or null
  const rootRef = useRef(null);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    function onDown(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // End a drag anywhere on the page (not just on a day cell).
  useEffect(() => {
    if (anchor == null) return;
    function onUp() {
      commit(anchor, hover || anchor);
      setAnchor(null);
      setHover(null);
    }
    window.addEventListener("mouseup", onUp);
    return () => window.removeEventListener("mouseup", onUp);
  }, [anchor, hover]);

  function commit(aIso, bIso) {
    const lo = aIso <= bIso ? aIso : bIso;
    const hi = aIso <= bIso ? bIso : aIso;
    onChange({ start_date: lo, due_date: hi });
  }

  const weeks = buildMonthGrid(refDate);
  const month = refDate.getMonth();

  // The range currently shown: a live preview while dragging, else the committed value.
  const previewLo = anchor && hover ? (anchor <= hover ? anchor : hover) : start_date;
  const previewHi = anchor && hover ? (anchor <= hover ? hover : anchor) : due_date;

  function label() {
    if (!start_date || !due_date) return "Set dates";
    const opts = { month: "short", day: "numeric" };
    const s = parseISO(start_date).toLocaleDateString(undefined, opts);
    if (start_date === due_date) return s;
    const e = parseISO(due_date).toLocaleDateString(undefined, opts);
    return `${s} – ${e}`;
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full border rounded px-2 py-1.5 text-sm text-left flex items-center justify-between gap-2"
        style={{ borderColor: BORDER, background: "#fff" }}
      >
        <span className="truncate">{label()}</span>
        <span style={{ color: MUTED }}>▾</span>
      </button>

      {open && (
        <div
          className="absolute z-20 mt-1 p-3 rounded-xl shadow-lg"
          style={{ background: "#fff", border: `1px solid ${BORDER}`, width: 264 }}
        >
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() => setRefDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
              className="px-2 py-0.5 rounded text-sm"
              style={{ border: `1px solid ${BORDER}` }}
            >
              ←
            </button>
            <div className="text-sm font-semibold" style={{ color: NAVY }}>
              {refDate.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
            </div>
            <button
              type="button"
              onClick={() => setRefDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
              className="px-2 py-0.5 rounded text-sm"
              style={{ border: `1px solid ${BORDER}` }}
            >
              →
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5 mb-1 text-center" style={{ color: MUTED, fontSize: 10 }}>
            {WEEKDAY_LABELS.map((w) => (
              <div key={w}>{w[0]}</div>
            ))}
          </div>

          <div
            className="grid grid-cols-7 gap-0.5"
            style={{ userSelect: "none" }}
            onMouseLeave={() => anchor && setHover(anchor)}
          >
            {weeks.flat().map((dt, i) => {
              const iso = toISO(dt);
              const outside = dt.getMonth() !== month;
              const inRange = previewLo && previewHi && iso >= previewLo && iso <= previewHi;
              const isEnd = iso === previewLo || iso === previewHi;
              return (
                <button
                  key={i}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setAnchor(iso);
                    setHover(iso);
                  }}
                  onMouseEnter={() => anchor && setHover(iso)}
                  className="text-xs rounded"
                  style={{
                    height: 30,
                    color: isEnd ? "#fff" : outside ? "#B7B2A6" : "#22303F",
                    background: isEnd ? NAVY : inRange ? `${NAVY}22` : "transparent",
                    fontWeight: isEnd ? 600 : 400,
                  }}
                >
                  {dt.getDate()}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between mt-2">
            <span className="text-xs" style={{ color: MUTED }}>{label()}</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs px-3 py-1 rounded-full font-medium"
              style={{ background: BG, color: NAVY, border: `1px solid ${BORDER}` }}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
