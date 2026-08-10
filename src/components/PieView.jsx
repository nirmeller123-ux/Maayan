import React from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { SEGMENTS, NAVY, MUTED, BORDER, BG } from "../lib/constants";
import { parseISO, addDays, startOfWeek, startOfMonth } from "../lib/dateUtils";

export default function PieView({ items, period, setPeriod, customStart, setCustomStart, customEnd, setCustomEnd }) {
  const today = new Date();
  let rangeStart, rangeEnd, label;

  if (period === "week") {
    rangeStart = startOfWeek(today);
    rangeEnd = addDays(rangeStart, 6);
    label = `Week of ${rangeStart.toLocaleDateString()}`;
  } else if (period === "month") {
    rangeStart = startOfMonth(today);
    rangeEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    label = today.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  } else {
    rangeStart = parseISO(customStart);
    rangeEnd = parseISO(customEnd);
    label = `${customStart} to ${customEnd}`;
  }

  const totals = {};
  SEGMENTS.forEach((s) => { totals[s.id] = 0; });
  items.forEach((it) => {
    if (!it.due_date) return;
    const dt = parseISO(it.due_date);
    if (dt >= rangeStart && dt <= rangeEnd) totals[it.segment] = (totals[it.segment] || 0) + (it.hours || 0);
  });
  const data = SEGMENTS.map((s) => ({ name: s.name, value: totals[s.id], color: s.color })).filter((x) => x.value > 0);
  const totalHours = data.reduce((sum, x) => sum + x.value, 0);

  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 md:p-6" style={{ border: `1px solid ${BORDER}` }}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <div className="flex gap-2">
          {[["week", "This Week"], ["month", "This Month"], ["custom", "Custom"]].map(([key, lab]) => (
            <button
              key={key}
              onClick={() => setPeriod(key)}
              className="px-3 py-1.5 rounded-full text-sm font-medium"
              style={period === key ? { background: NAVY, color: "#fff" } : { background: BG, color: "#22303F" }}
            >
              {lab}
            </button>
          ))}
        </div>
        {period === "custom" && (
          <div className="flex items-center gap-2 text-sm">
            <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="border rounded px-2 py-1 text-sm" style={{ borderColor: BORDER }} />
            <span style={{ color: MUTED }}>to</span>
            <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="border rounded px-2 py-1 text-sm" style={{ borderColor: BORDER }} />
          </div>
        )}
      </div>
      <div className="text-sm mb-4" style={{ color: MUTED }}>{label}</div>

      {data.length === 0 ? (
        <div className="text-sm py-12 text-center" style={{ color: MUTED }}>No hours land in this period yet — add a task or adjust the range.</div>
      ) : (
        <div>
          <div className="relative" style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" innerRadius={78} outerRadius={130} paddingAngle={2} strokeWidth={0}>
                  {data.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip formatter={(v) => `${v}h`} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <div className="text-2xl font-semibold" style={{ color: NAVY, fontFamily: "Georgia, 'Times New Roman', serif" }}>{totalHours}h</div>
              <div className="text-xs" style={{ color: MUTED }}>total planned</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 justify-center mt-4">
            {data.map((entry, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span style={{ width: 10, height: 10, borderRadius: 9999, background: entry.color }} />
                {entry.name} — {entry.value}h
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
