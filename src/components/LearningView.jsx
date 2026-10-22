import React, { useState, useEffect, useMemo, useCallback } from "react";
import { NAVY, INK, MUTED, BORDER, segColor } from "../lib/constants";
import { toISO, parseISO, addDays, startOfWeek, formatTime, formatShortDate, timeInputValue } from "../lib/dateUtils";
import {
  createTasks, updateTask, deleteTask,
  fetchLearning, upsertLearningSession, linkLearningSessions, upsertLearningWeek,
  createLearningInsight, deleteLearningInsight, subscribeToLearning,
} from "../lib/api";
import MicButton from "./MicButton";
import Modal from "./Modal";
import {
  PLAN_URL, TOPICS, KINDS, WEEK_TOPIC, WEEKS, ALL_SESSIONS, PLANNED_TOTAL,
  DAY_NAMES, DEFAULT_PATTERN, LEARNING_SEGMENT, slotHours, slotTitle,
} from "../lib/learningPlan";

const OK = "#2F855A";
const card = { background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12 };
// 16px keeps iOS Safari from zooming the page when a field gets focus.
const field = { border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 10px", fontSize: 16, background: "#fff", color: INK, minWidth: 0 };
const tap = { minHeight: 44 };

function describe(e) {
  const msg = e?.message || "";
  if (e?.code === "PGRST205" || /learning_/.test(msg)) {
    return "The learning tables aren't set up yet. Run supabase/migration_2026-10-22_learning.sql in the Supabase SQL Editor.";
  }
  return "Couldn't save. Check your connection and try again.";
}

function nextSunday(from = new Date()) {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const add = (7 - d.getDay()) % 7;
  return toISO(addDays(d, add));
}

function taskRow(s, date, time) {
  return {
    title: slotTitle(s),
    start_date: null,
    due_date: date,
    start_time: time || null,
    priority: "Medium",
    hours: slotHours(s),
    segment: LEARNING_SEGMENT,
    status: "Not Started",
  };
}

function SlotEditor({ task, onSave, onClear }) {
  const [date, setDate] = useState(task?.due_date || "");
  const [time, setTime] = useState(timeInputValue(task?.start_time));
  useEffect(() => {
    setDate(task?.due_date || "");
    setTime(timeInputValue(task?.start_time));
  }, [task?.due_date, task?.start_time]);
  const dirty = !!date && (date !== (task?.due_date || "") || time !== timeInputValue(task?.start_time));
  useEffect(() => {
    if (!dirty) return undefined;
    const t = setTimeout(() => onSave(date, time), 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, time, dirty]);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="text-xs" style={{ color: MUTED }}>Slot</label>
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Slot date" style={field} />
      <input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Slot start time" style={field} />
      {task && (
        <button type="button" onClick={onClear} className="text-xs underline" style={{ color: MUTED, ...tap }}>Unschedule</button>
      )}
    </div>
  );
}

function SessionCard({ s, st, mode, onToggle, onThought, onSaveSlot, onClearSlot, onField }) {
  const { row, task, done } = st;
  const when = task ? `${formatShortDate(task.due_date)}${task.start_time ? ` · ${formatTime(task.start_time)}` : ""}` : "";
  return (
    <div style={{ ...card, padding: 14, opacity: done && mode === "today" ? 0.75 : 1 }}>
      <div className="flex items-start gap-3">
        <button
          type="button"
          role="checkbox"
          aria-checked={done}
          aria-label={`Mark done: ${s.title}`}
          onClick={() => onToggle(s, !done)}
          style={{
            width: 44, height: 44, flexShrink: 0, borderRadius: 10,
            border: `2px solid ${done ? OK : "#B8B4AA"}`, background: done ? OK : "#fff",
            color: "#fff", fontSize: 22, lineHeight: 1,
          }}
        >{done ? "✓" : ""}</button>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-xs" style={{ color: MUTED, fontVariantNumeric: "tabular-nums" }}>W{s.week}·{s.code}</span>
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: segColor(LEARNING_SEGMENT) }}>{s.kind}</span>
            {s.h > 0 && <span className="text-xs" style={{ color: MUTED }}>{s.h}h</span>}
            {when && <span className="text-xs" style={{ color: MUTED }}>· {when}</span>}
          </div>
          <div className="text-base font-semibold" style={{ color: done ? MUTED : INK, textDecoration: done ? "line-through" : "none" }}>{s.title}</div>
          <p className="text-sm mt-1" style={{ color: INK }}>{s.what}</p>
          <p className="text-sm mt-1" style={{ color: MUTED }}><b style={{ color: INK }}>Output </b>{s.out}</p>

          {mode === "plan" && (
            <div className="mt-3 flex flex-col gap-2">
              <SlotEditor task={task} onSave={(d, t) => onSaveSlot(s, d, t)} onClear={() => onClearSlot(s)} />
              <div className="flex flex-wrap items-center gap-2">
                {s.h > 0 && (
                  <label className="flex items-center gap-2 text-xs" style={{ color: MUTED }}>
                    Hours spent
                    <input
                      key={`h-${s.id}-${row?.actual_hours ?? ""}`}
                      type="number" min="0" max="40" step="0.25" inputMode="decimal"
                      defaultValue={row?.actual_hours ?? ""}
                      placeholder={String(s.h)}
                      onBlur={(e) => {
                        const v = parseFloat(e.target.value);
                        const next = Number.isFinite(v) && v >= 0 ? v : null;
                        if (next !== (row?.actual_hours ?? null)) onField(s, { actual_hours: next });
                      }}
                      style={{ ...field, width: 90 }}
                    />
                  </label>
                )}
                <input
                  key={`n-${s.id}-${row?.note ?? ""}`}
                  type="text" maxLength={400}
                  defaultValue={row?.note ?? ""}
                  placeholder="Note: link, page, one line"
                  aria-label={`Note for ${s.title}`}
                  onBlur={(e) => { const v = e.target.value.trim(); if (v !== (row?.note ?? "")) onField(s, { note: v }); }}
                  style={{ ...field, flex: "1 1 200px" }}
                />
              </div>
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            {mode === "today" && (
              <button type="button" onClick={() => onToggle(s, !done)} className="px-4 rounded-full text-sm font-medium"
                style={{ ...tap, background: done ? "#fff" : OK, color: done ? OK : "#fff", border: `1px solid ${OK}` }}>
                {done ? "Done · undo" : "Mark done"}
              </button>
            )}
            <button type="button" onClick={() => onThought(s)} className="px-4 rounded-full text-sm font-medium"
              style={{ ...tap, background: "#fff", color: NAVY, border: `1px solid ${NAVY}` }}>
              Add thought
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SchedulerModal({ onClose, onRun, busy }) {
  const [anchor, setAnchor] = useState(nextSunday());
  const [pattern, setPattern] = useState(() => JSON.parse(JSON.stringify(DEFAULT_PATTERN)));
  const [moveExisting, setMoveExisting] = useState(false);
  const rows = [
    ["A", "Learn", 2], ["B", "Learn", 2], ["C", "Deep dive", 2.5],
    ["D", "Apply", "1.5 to 2"], ["E", "Review", 0.5], ["LI", "LinkedIn", "0.5"],
  ];
  const first = startOfWeek(parseISO(anchor));
  const last = addDays(first, 3 * 7 + 6);
  return (
    <Modal onClose={onClose}>
      <div style={{ ...card, padding: 18 }}>
        <h2 className="text-lg font-semibold" style={{ color: NAVY, fontFamily: "Georgia, 'Times New Roman', serif" }}>Schedule learning slots</h2>
        <p className="text-sm mt-1" style={{ color: MUTED }}>
          Each session becomes a calendar task, so it shows in Daily and Calendar (and Google, if connected). Weeks run Sunday to Saturday.
          Session lengths come from the plan. You can move any slot afterwards.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <label className="text-sm" htmlFor="learn-anchor">Week 1 starts the week of</label>
          <input id="learn-anchor" type="date" value={anchor} onChange={(e) => e.target.value && setAnchor(e.target.value)} style={field} />
        </div>
        <div className="mt-4 flex flex-col gap-2">
          {rows.map(([code, label, hrs]) => (
            <div key={code} className="flex flex-wrap items-center gap-2">
              <span className="text-sm" style={{ width: 150 }}>{code === "LI" ? "LinkedIn" : `Session ${code}`} · {label} ({hrs}h)</span>
              <select
                aria-label={`Day for ${code}`}
                value={pattern[code].day}
                onChange={(e) => setPattern((p) => ({ ...p, [code]: { ...p[code], day: Number(e.target.value) } }))}
                style={field}
              >
                {DAY_NAMES.map((d, i) => <option key={d} value={i}>{d}</option>)}
              </select>
              <input
                type="time" aria-label={`Start time for ${code}`}
                value={pattern[code].time}
                onChange={(e) => setPattern((p) => ({ ...p, [code]: { ...p[code], time: e.target.value } }))}
                style={field}
              />
            </div>
          ))}
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={moveExisting} onChange={(e) => setMoveExisting(e.target.checked)} style={{ width: 20, height: 20 }} />
          Also move sessions that already have a slot (finished ones never move)
        </label>
        <p className="text-xs mt-3" style={{ color: MUTED }}>
          Runs {formatShortDate(toISO(first))} to {formatShortDate(toISO(last))}. Check for clashes with your other plans; Saturday is open if you want it.
        </p>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 rounded-full text-sm" style={{ ...tap, border: `1px solid ${BORDER}`, background: "#fff" }}>Cancel</button>
          <button type="button" disabled={busy} onClick={() => onRun({ anchor, pattern, moveExisting })} className="px-5 rounded-full text-sm font-medium" style={{ ...tap, background: NAVY, color: "#fff", opacity: busy ? 0.6 : 1 }}>
            {busy ? "Scheduling…" : "Schedule slots"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default function LearningView({ tasks, voiceLang, setToast, reloadTasks }) {
  const [data, setData] = useState({ sessions: [], weeks: [], insights: [] });
  const [err, setErr] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("today");
  const [week, setWeek] = useState(() => {
    try { const v = parseInt(localStorage.getItem("learning-week"), 10); return v >= 1 && v <= 4 ? v : 1; } catch { return 1; }
  });
  const [scheduler, setScheduler] = useState(false);
  const [busy, setBusy] = useState(false);
  const [composer, setComposer] = useState({ text: "", kind: KINDS[0], topic: WEEK_TOPIC[1], week: 1, session: null });
  const [filter, setFilter] = useState("all");

  const reload = useCallback(async () => {
    try {
      setData(await fetchLearning());
      setErr("");
    } catch (e) {
      setErr(describe(e));
    } finally {
      setLoaded(true);
    }
  }, []);
  useEffect(() => {
    reload();
    return subscribeToLearning(reload);
  }, [reload]);

  const rowById = useMemo(() => Object.fromEntries(data.sessions.map((r) => [r.id, r])), [data.sessions]);
  const weekRow = useMemo(() => Object.fromEntries(data.weeks.map((r) => [r.week, r])), [data.weeks]);
  const taskById = useMemo(() => Object.fromEntries(tasks.map((t) => [t.id, t])), [tasks]);

  const stateOf = useCallback((s) => {
    const row = rowById[s.id];
    const task = row?.task_id ? taskById[row.task_id] : undefined;
    return { row, task, done: !!row?.done || task?.status === "Done" };
  }, [rowById, taskById]);

  async function guard(fn) {
    try { await fn(); } catch (e) { setToast({ text: describe(e) }); }
  }
  const refresh = () => Promise.all([reload(), reloadTasks && reloadTasks()]);

  async function setDone(s, value) {
    const st = stateOf(s);
    await guard(async () => {
      await upsertLearningSession(
        s.id,
        value
          ? { done: true, done_at: new Date().toISOString(), actual_hours: st.row?.actual_hours ?? (s.h || null) }
          : { done: false, done_at: null }
      );
      if (st.task) await updateTask(st.task.id, { status: value ? "Done" : "Not Started" });
      await refresh();
    });
    if (value) setToast({ text: `Done: W${s.week}·${s.code} ${s.title}`, onUndo: () => setDone(s, false) });
  }
  const saveField = (s, patch) => guard(async () => { await upsertLearningSession(s.id, patch); await reload(); });

  const saveSlot = (s, date, time) => guard(async () => {
    const st = stateOf(s);
    if (st.task) {
      await updateTask(st.task.id, { due_date: date, start_date: null, start_time: time || null });
    } else {
      const [t] = await createTasks([taskRow(s, date, time)]);
      await linkLearningSessions([{ id: s.id, task_id: t.id }]);
    }
    await refresh();
  });
  const clearSlot = (s) => guard(async () => {
    const st = stateOf(s);
    if (st.task) await deleteTask(st.task.id);
    await refresh();
  });

  async function runSchedule({ anchor, pattern, moveExisting }) {
    setBusy(true);
    const start = startOfWeek(parseISO(anchor));
    const toCreate = [];
    const toMove = [];
    ALL_SESSIONS.forEach((s) => {
      const st = stateOf(s);
      if (st.done) return;
      const p = pattern[s.code];
      const date = toISO(addDays(start, (s.week - 1) * 7 + p.day));
      if (st.task) { if (moveExisting) toMove.push({ task: st.task, date, time: p.time }); }
      else toCreate.push({ s, date, time: p.time });
    });
    let ok = false;
    await guard(async () => {
      if (toCreate.length) {
        const rows = await createTasks(toCreate.map((c) => taskRow(c.s, c.date, c.time)));
        const byTitle = Object.fromEntries(rows.map((r) => [r.title, r]));
        await linkLearningSessions(toCreate.map((c) => ({ id: c.s.id, task_id: byTitle[slotTitle(c.s)].id })));
      }
      for (const m of toMove) await updateTask(m.task.id, { due_date: m.date, start_date: null, start_time: m.time || null });
      await refresh();
      ok = true;
    });
    setBusy(false);
    if (ok) {
      setScheduler(false);
      setToast({ text: `Scheduled ${toCreate.length} new slot${toCreate.length === 1 ? "" : "s"}${toMove.length ? `, moved ${toMove.length}` : ""}` });
    }
  }

  function startThought(s) {
    setComposer({ text: `W${s.week}·${s.code} ${s.title}: `, kind: KINDS[0], topic: WEEK_TOPIC[s.week], week: s.week, session: s.id });
    setTab("insights");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function saveInsight() {
    const body = composer.text.trim();
    if (!body) return;
    await guard(async () => {
      await createLearningInsight({ body, kind: composer.kind, topic: composer.topic, week: composer.week || null, session_id: composer.session });
      setComposer((c) => ({ ...c, text: "", session: null }));
      await reload();
      setToast({ text: "Insight saved" });
    });
  }
  async function removeInsight(id) {
    if (!window.confirm("Delete this insight?")) return;
    await guard(async () => { await deleteLearningInsight(id); await reload(); });
  }
  function copyAll() {
    const out = [];
    TOPICS.forEach((t) => {
      const items = data.insights.filter((i) => i.topic === t).slice().reverse();
      if (!items.length) return;
      out.push(t.toUpperCase());
      items.forEach((i) => out.push(`- [${i.kind}${i.week ? `, week ${i.week}` : ""}] ${i.body}`));
      out.push("");
    });
    if (!out.length) { setToast({ text: "No insights to copy yet" }); return; }
    const done = () => setToast({ text: `Copied ${data.insights.length} insights` });
    const fail = () => setToast({ text: "Copy was blocked by the browser" });
    try { navigator.clipboard.writeText(out.join("\n")).then(done, fail); } catch { fail(); }
  }

  // ---- derived numbers ----
  const doneCount = ALL_SESSIONS.filter((s) => stateOf(s).done).length;
  const hoursLogged = data.sessions.reduce((a, r) => a + (typeof r.actual_hours === "number" ? r.actual_hours : 0), 0);
  const scheduledCount = ALL_SESSIONS.filter((s) => stateOf(s).task).length;
  const todayIso = toISO(new Date());
  const todays = ALL_SESSIONS.filter((s) => stateOf(s).task?.due_date === todayIso)
    .sort((a, b) => (stateOf(a).task.start_time || "").localeCompare(stateOf(b).task.start_time || ""));
  const catchUp = ALL_SESSIONS.filter((s) => { const st = stateOf(s); return !st.done && st.task && st.task.due_date < todayIso; });
  const upNext = ALL_SESSIONS.find((s) => !stateOf(s).done && !todays.includes(s) && !catchUp.includes(s));
  const w = WEEKS[week - 1];
  const wk = weekRow[week] || {};
  const filtered = data.insights.filter((i) => filter === "all" || i.topic === filter);
  const sessionLabel = (id) => { const s = ALL_SESSIONS.find((x) => x.id === id); return s ? `W${s.week}·${s.code}` : ""; };

  const pill = (active) => active
    ? { background: NAVY, color: "#fff" }
    : { background: "#fff", color: INK, border: `1px solid ${BORDER}` };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold" style={{ color: NAVY, fontFamily: "Georgia, 'Times New Roman', serif" }}>Learning project</h2>
          <div className="text-sm" style={{ color: MUTED }}>
            Defense-tech operations, 4 weeks · {doneCount} of {ALL_SESSIONS.length} done · {Math.round(hoursLogged * 100) / 100} of {PLANNED_TOTAL} h logged · {scheduledCount} scheduled
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setScheduler(true)} className="px-4 rounded-full text-sm font-medium" style={{ ...tap, background: NAVY, color: "#fff" }}>Schedule slots</button>
          <a href={PLAN_URL} target="_blank" rel="noopener noreferrer" className="px-4 rounded-full text-sm font-medium inline-flex items-center" style={{ ...tap, border: `1px solid ${BORDER}`, background: "#fff", color: NAVY }}>Plan document</a>
        </div>
      </div>

      {err && <div className="rounded-lg p-3 text-sm" style={{ background: "#FDECEA", color: "#B3261E" }}>{err}</div>}

      <div className="flex flex-wrap gap-2">
        {[["today", "Today"], ["plan", "Plan"], ["insights", `Insights (${data.insights.length})`]].map(([k, label]) => (
          <button key={k} type="button" onClick={() => setTab(k)} className="px-4 rounded-full text-sm font-medium" style={{ ...tap, ...pill(tab === k) }}>{label}</button>
        ))}
      </div>

      {!loaded && <div className="text-sm py-8 text-center" style={{ color: MUTED }}>Loading…</div>}

      {loaded && tab === "today" && (
        <div className="flex flex-col gap-3">
          {scheduledCount === 0 && (
            <div style={{ ...card, padding: 16 }}>
              <div className="text-base font-semibold">No slots scheduled yet</div>
              <p className="text-sm mt-1" style={{ color: MUTED }}>Pick a weekly rhythm and the 24 sessions land in your calendar. You can move any of them later.</p>
              <button type="button" onClick={() => setScheduler(true)} className="mt-3 px-5 rounded-full text-sm font-medium" style={{ ...tap, background: NAVY, color: "#fff" }}>Schedule slots</button>
            </div>
          )}
          {catchUp.length > 0 && (
            <>
              <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#B3261E" }}>Catch up ({catchUp.length})</div>
              {catchUp.map((s) => <SessionCard key={s.id} s={s} st={stateOf(s)} mode="today" onToggle={setDone} onThought={startThought} />)}
            </>
          )}
          <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: MUTED }}>Today ({todays.length})</div>
          {todays.length === 0
            ? <div className="text-sm py-1" style={{ color: "#8A8578" }}>Nothing scheduled for today.</div>
            : todays.map((s) => <SessionCard key={s.id} s={s} st={stateOf(s)} mode="today" onToggle={setDone} onThought={startThought} />)}
          {upNext && (
            <>
              <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: MUTED }}>Up next</div>
              <SessionCard s={upNext} st={stateOf(upNext)} mode="today" onToggle={setDone} onThought={startThought} />
            </>
          )}
          {!upNext && scheduledCount > 0 && doneCount === ALL_SESSIONS.length && (
            <div style={{ ...card, padding: 16 }}>All 24 items are done. Copy your insights from the Insights tab into your interview notes.</div>
          )}
        </div>
      )}

      {loaded && tab === "plan" && (
        <div className="flex flex-col gap-3">
          <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
            {WEEKS.map((x) => {
              const d = x.sessions.filter((s) => stateOf(s).done).length;
              return (
                <button key={x.n} type="button" onClick={() => { setWeek(x.n); try { localStorage.setItem("learning-week", String(x.n)); } catch { /* ignore */ } }}
                  className="text-left rounded-xl p-3" style={{ ...tap, background: "#fff", border: `1px solid ${week === x.n ? NAVY : BORDER}`, boxShadow: week === x.n ? `inset 0 -3px 0 ${NAVY}` : "none" }}>
                  <div className="text-xs" style={{ color: MUTED }}>WEEK {x.n}</div>
                  <div className="text-sm font-semibold">{x.title}</div>
                  <div className="flex gap-1 mt-2" aria-hidden="true">
                    {x.sessions.map((s) => <span key={s.id} style={{ flex: 1, height: 6, borderRadius: 2, background: stateOf(s).done ? OK : BORDER }} />)}
                  </div>
                  <div className="text-xs mt-1" style={{ color: MUTED }}>{d}/{x.sessions.length} done</div>
                </button>
              );
            })}
          </div>
          <div style={{ ...card, padding: 14 }}>
            <div className="text-lg font-semibold" style={{ color: NAVY, fontFamily: "Georgia, 'Times New Roman', serif" }}>{w.title}</div>
            <p className="text-sm mt-1" style={{ color: MUTED }}>{w.goal}</p>
          </div>
          {w.sessions.map((s0) => {
            const s = { ...s0, week: w.n };
            return <SessionCard key={s.id} s={s} st={stateOf(s)} mode="plan" onToggle={setDone} onThought={startThought} onSaveSlot={saveSlot} onClearSlot={clearSlot} onField={saveField} />;
          })}
          <div style={{ ...card, padding: 14 }}>
            <div className="text-base font-semibold">Check yourself at the end of week {w.n}</div>
            <p className="text-sm mt-1">{w.check}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Confidence">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" role="radio" aria-checked={wk.confidence === n}
                  onClick={() => guard(async () => { await upsertLearningWeek(w.n, { confidence: n }); await reload(); })}
                  style={{ width: 44, height: 44, borderRadius: 10, border: `1px solid ${wk.confidence === n ? NAVY : BORDER}`, background: wk.confidence === n ? NAVY : "#fff", color: wk.confidence === n ? "#fff" : INK }}>{n}</button>
              ))}
              <span className="text-xs" style={{ color: MUTED }}>1 = not yet, 5 = could do it in an interview today</span>
            </div>
            <textarea
              key={`refl-${w.n}-${wk.reflection ?? ""}`}
              rows={3} maxLength={2000} defaultValue={wk.reflection ?? ""}
              placeholder="What is still weak? What will you do about it next week?"
              aria-label="Week reflection"
              onBlur={(e) => { const v = e.target.value.trim(); if (v !== (wk.reflection ?? "")) guard(async () => { await upsertLearningWeek(w.n, { reflection: v }); await reload(); }); }}
              className="w-full mt-3" style={{ ...field, resize: "vertical" }}
            />
          </div>
        </div>
      )}

      {loaded && tab === "insights" && (
        <div className="flex flex-col gap-3">
          <div style={{ ...card, padding: 14 }}>
            <label htmlFor="learn-insight" className="text-sm font-semibold">What changed in your thinking?</label>
            <textarea
              id="learn-insight" rows={4} value={composer.text}
              onChange={(e) => setComposer((c) => ({ ...c, text: e.target.value }))}
              placeholder="One idea, one example, or one number you can use in an interview."
              className="w-full mt-2" style={{ ...field, resize: "vertical" }}
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <select aria-label="Type" value={composer.kind} onChange={(e) => setComposer((c) => ({ ...c, kind: e.target.value }))} style={field}>
                {KINDS.map((k) => <option key={k}>{k}</option>)}
              </select>
              <select aria-label="Topic" value={composer.topic} onChange={(e) => setComposer((c) => ({ ...c, topic: e.target.value }))} style={field}>
                {TOPICS.map((t) => <option key={t}>{t}</option>)}
              </select>
              <select aria-label="Week" value={composer.week} onChange={(e) => setComposer((c) => ({ ...c, week: Number(e.target.value) }))} style={field}>
                <option value={0}>No week</option>
                {[1, 2, 3, 4].map((n) => <option key={n} value={n}>Week {n}</option>)}
              </select>
              <MicButton onText={(t) => setComposer((c) => ({ ...c, text: c.text ? `${c.text}${/\s$/.test(c.text) ? "" : " "}${t}` : t }))} lang={voiceLang} title="Dictate your thought" label="Dictate" />
              <span style={{ flex: 1 }} />
              <button type="button" onClick={saveInsight} className="px-5 rounded-full text-sm font-medium" style={{ ...tap, background: NAVY, color: "#fff" }}>Save insight</button>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              {["all", ...TOPICS].map((t) => {
                const n = t === "all" ? data.insights.length : data.insights.filter((i) => i.topic === t).length;
                return <button key={t} type="button" onClick={() => setFilter(t)} className="px-3 rounded-full text-xs font-medium" style={{ ...tap, ...pill(filter === t) }}>{t === "all" ? "All" : t} {n}</button>;
              })}
            </div>
            <button type="button" onClick={copyAll} className="px-4 rounded-full text-sm" style={{ ...tap, border: `1px solid ${BORDER}`, background: "#fff" }}>Copy all</button>
          </div>
          {filtered.length === 0 ? (
            <div className="rounded-xl p-5 text-sm" style={{ border: `1px dashed ${BORDER}`, color: MUTED }}>
              {data.insights.length ? "Nothing under this topic yet." : "No insights yet. After each session, write the one thing that changed your thinking, in your own words. Interview stories and open questions go here too."}
            </div>
          ) : filtered.map((i) => (
            <div key={i.id} style={{ ...card, padding: 14 }}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs" style={{ color: MUTED }}>
                <span className="font-semibold uppercase tracking-wide" style={{ color: i.kind === "Interview story" ? "#B45309" : NAVY }}>{i.kind}</span>
                <span>{i.topic}</span>
                {i.week ? <span>Week {i.week}</span> : null}
                {i.session_id ? <span>{sessionLabel(i.session_id)}</span> : null}
                <span>{new Date(i.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</span>
                <button type="button" onClick={() => removeInsight(i.id)} className="underline" style={{ ...tap, color: MUTED }}>Delete</button>
              </div>
              <p className="text-sm mt-1" style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{i.body}</p>
            </div>
          ))}
        </div>
      )}

      {scheduler && <SchedulerModal busy={busy} onClose={() => setScheduler(false)} onRun={runSchedule} />}
    </div>
  );
}
