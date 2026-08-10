import React from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import { SEGMENTS, segColor, segName, NAVY, MUTED, BORDER, BG } from "../lib/constants";
import { parseISO } from "../lib/dateUtils";

function ProjectGantt({ project }) {
  const starts = project.tasks.map((t) => parseISO(t.start_date).getTime());
  const dues = project.tasks.map((t) => parseISO(t.due_date).getTime());
  const minStart = Math.min(...starts);
  const dayMs = 1000 * 60 * 60 * 24;

  const data = project.tasks.map((t) => {
    const offset = Math.round((parseISO(t.start_date).getTime() - minStart) / dayMs);
    const duration = Math.max(1, Math.round((parseISO(t.due_date).getTime() - parseISO(t.start_date).getTime()) / dayMs));
    return { name: t.title, offset, duration };
  });

  const color = segColor(project.segment);
  const dependents = project.tasks.filter((t) => t.depends_on);

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span style={{ width: 10, height: 10, borderRadius: 9999, background: color }} />
        <div className="font-semibold" style={{ color: NAVY }}>{project.name}</div>
        <span className="text-xs" style={{ color: MUTED }}>{segName(project.segment)}</span>
      </div>
      <ResponsiveContainer width="100%" height={Math.max(120, project.tasks.length * 44 + 30)}>
        <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#EEEBE4" />
          <XAxis
            type="number"
            tick={{ fontSize: 11, fill: MUTED }}
            label={{ value: "days from project start", position: "insideBottom", offset: -2, fontSize: 10, fill: MUTED }}
          />
          <YAxis type="category" dataKey="name" width={190} tick={{ fontSize: 11, fill: "#22303F" }} />
          <Tooltip formatter={(value, name) => (name === "duration" ? [`${value} day(s)`, "duration"] : [value, name])} />
          <Bar dataKey="offset" stackId="a" fill="transparent" />
          <Bar dataKey="duration" stackId="a" fill={color} radius={[4, 4, 4, 4]} />
        </BarChart>
      </ResponsiveContainer>
      {dependents.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
          {dependents.map((t) => {
            const dep = project.tasks.find((x) => x.id === t.depends_on);
            if (!dep) return null;
            return (
              <div key={t.id} className="text-xs" style={{ color: MUTED }}>
                "{t.title}" waits on "{dep.title}"
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function GanttView({ projects, activeSegments, setActiveSegments }) {
  function toggleSegment(id) {
    setActiveSegments((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }
  const filtered = projects.filter((p) => activeSegments.includes(p.segment));

  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 md:p-6" style={{ border: `1px solid ${BORDER}` }}>
      <div className="flex flex-wrap gap-2 mb-6">
        {SEGMENTS.map((s) => {
          const active = activeSegments.includes(s.id);
          return (
            <button
              key={s.id}
              onClick={() => toggleSegment(s.id)}
              className="text-xs px-3 py-1.5 rounded-full font-medium flex items-center gap-1.5"
              style={
                active
                  ? { background: `${s.color}1A`, border: `1px solid ${s.color}`, color: s.color }
                  : { background: BG, border: `1px solid ${BORDER}`, color: MUTED }
              }
            >
              <span style={{ width: 8, height: 8, borderRadius: 9999, background: s.color }} />
              {s.name}
            </button>
          );
        })}
      </div>
      {filtered.length === 0 && (
        <div className="text-sm py-8 text-center" style={{ color: MUTED }}>No projects match this filter.</div>
      )}
      <div className="space-y-8">
        {filtered.map((p) => <ProjectGantt key={p.id} project={p} />)}
      </div>
    </div>
  );
}
