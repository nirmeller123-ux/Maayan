import React, { useState, useEffect, useCallback, useMemo } from "react";
import ListView from "./components/ListView";
import TodayView from "./components/TodayView";
import CalendarView from "./components/CalendarView";
import GanttView from "./components/GanttView";
import PieView from "./components/PieView";
import AddTaskForm from "./components/AddTaskForm";
import AddProjectForm from "./components/AddProjectForm";
import { SEGMENTS, PRIORITIES, NAVY, BG, INK, BORDER } from "./lib/constants";
import {
  fetchTasks, fetchProjects, createTask, createProject,
  updateTask, deleteTask, updateProject, deleteProject,
  subscribeToChanges,
} from "./lib/api";

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [view, setView] = useState("list");

  // taskEditor / projectEditor: null (closed) | "new" (create) | the object being edited
  const [taskEditor, setTaskEditor] = useState(null);
  const [projectEditor, setProjectEditor] = useState(null);

  const [calGranularity, setCalGranularity] = useState("month");
  const [calRefDate, setCalRefDate] = useState(new Date());

  const [ganttActiveSegments, setGanttActiveSegments] = useState(SEGMENTS.map((s) => s.id));

  const [period, setPeriod] = useState("month");
  const [customStart, setCustomStart] = useState(new Date().toISOString().slice(0, 10));
  const [customEnd, setCustomEnd] = useState(new Date().toISOString().slice(0, 10));

  const [listActiveSegments, setListActiveSegments] = useState(SEGMENTS.map((s) => s.id));
  const [listActivePriorities, setListActivePriorities] = useState(PRIORITIES.slice());
  const [listTimeFrame, setListTimeFrame] = useState("all");

  const loadAll = useCallback(async () => {
    try {
      const [t, p] = await Promise.all([fetchTasks(), fetchProjects()]);
      setTasks(t);
      setProjects(p);
      setError(null);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
    const unsubscribe = subscribeToChanges(() => loadAll());
    return unsubscribe;
  }, [loadAll]);

  const allItems = useMemo(() => {
    const standalone = tasks.map((t) => ({ ...t, kind: "task" }));
    const fromProjects = projects.flatMap((p) =>
      p.tasks.map((t) => ({
        id: t.id,
        title: t.title,
        due_date: t.due_date,
        start_date: t.start_date,
        start_time: t.start_time,
        priority: t.priority,
        status: t.status,
        hours: t.hours,
        segment: p.segment,
        project_name: p.name,
        project_id: p.id,
        kind: "project",
      }))
    );
    return [...standalone, ...fromProjects];
  }, [tasks, projects]);

  // Opens the right editor for a unified item from Today/Calendar: standalone
  // tasks open the task editor; a project step opens its whole-project editor.
  function openItem(item) {
    if (item.kind === "project") {
      const project = projects.find((p) => p.id === item.project_id);
      if (project) openProject(project);
    } else {
      const task = tasks.find((t) => t.id === item.id) || item;
      openTask(task);
    }
  }

  function openNewTask() {
    setTaskEditor("new");
    setProjectEditor(null);
  }
  function openNewProject() {
    setProjectEditor("new");
    setTaskEditor(null);
  }
  function openTask(task) {
    setTaskEditor(task);
    setProjectEditor(null);
  }
  function openProject(project) {
    setProjectEditor(project);
    setTaskEditor(null);
  }

  async function handleTaskSubmit(data) {
    const { id, ...patch } = data;
    if (id) {
      await updateTask(id, patch);
    } else {
      await createTask(patch);
    }
    setTaskEditor(null);
    await loadAll();
  }

  async function handleDeleteTask(id) {
    await deleteTask(id);
    setTaskEditor(null);
    await loadAll();
  }

  async function handleProjectSubmit(data) {
    if (data.id) {
      await updateProject(data);
    } else {
      await createProject(data);
    }
    setProjectEditor(null);
    await loadAll();
  }

  async function handleDeleteProject(id) {
    await deleteProject(id);
    setProjectEditor(null);
    await loadAll();
  }

  return (
    <div style={{ background: BG, minHeight: "100vh", fontFamily: "ui-sans-serif, system-ui, sans-serif", color: INK }} className="p-4 md:p-8">
      <header className="mb-6">
        <div className="flex items-baseline gap-3 flex-wrap">
          <h1 style={{ fontFamily: "Georgia, 'Times New Roman', serif", color: NAVY }} className="text-3xl md:text-4xl font-bold tracking-tight">Renesance</h1>
          <span style={{ color: "#667085" }} className="text-sm">Tasks, projects, and time — in one view</span>
        </div>
      </header>

      {error && (
        <div className="rounded-lg p-3 mb-4 text-sm" style={{ background: "#FDECEA", color: "#B3261E" }}>
          Couldn't reach Supabase: {error}. Check your .env.local values and that schema.sql has been run.
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-6">
        {SEGMENTS.map((s) => (
          <div key={s.id} className="flex items-center gap-2 text-sm">
            <span style={{ width: 10, height: 10, borderRadius: 9999, background: s.color, display: "inline-block" }} />
            {s.name}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-4" style={{ borderBottom: `1px solid ${BORDER}` }}>
        <div className="flex gap-2">
          {[["list", "Overview"], ["today", "Today"], ["calendar", "Calendar"], ["gantt", "Gantt"], ["pie", "Time Allocation"]].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className="px-4 py-2 rounded-full text-sm font-medium"
              style={view === key ? { background: NAVY, color: "#fff" } : { background: "#fff", color: INK, border: `1px solid ${BORDER}` }}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={() => (taskEditor ? setTaskEditor(null) : openNewTask())} className="px-4 py-2 rounded-full text-sm font-medium" style={{ background: "#fff", border: `1px solid ${NAVY}`, color: NAVY }}>+ Add Task</button>
          <button onClick={() => (projectEditor ? setProjectEditor(null) : openNewProject())} className="px-4 py-2 rounded-full text-sm font-medium" style={{ background: NAVY, color: "#fff" }}>+ Add Project</button>
        </div>
      </div>

      {taskEditor && (
        <AddTaskForm
          mode={taskEditor === "new" ? "create" : "edit"}
          initialTask={taskEditor === "new" ? null : taskEditor}
          onCancel={() => setTaskEditor(null)}
          onSubmit={handleTaskSubmit}
          onDelete={handleDeleteTask}
        />
      )}
      {projectEditor && (
        <AddProjectForm
          mode={projectEditor === "new" ? "create" : "edit"}
          initialProject={projectEditor === "new" ? null : projectEditor}
          onCancel={() => setProjectEditor(null)}
          onSubmit={handleProjectSubmit}
          onDelete={handleDeleteProject}
        />
      )}

      {loading ? (
        <div className="text-sm py-12 text-center" style={{ color: "#667085" }}>Loading…</div>
      ) : (
        <>
          {view === "list" && (
            <ListView
              tasks={tasks}
              projects={projects}
              activeSegments={listActiveSegments}
              setActiveSegments={setListActiveSegments}
              activePriorities={listActivePriorities}
              setActivePriorities={setListActivePriorities}
              timeFrame={listTimeFrame}
              setTimeFrame={setListTimeFrame}
              onSelectTask={openTask}
              onSelectProject={openProject}
            />
          )}
          {view === "today" && (
            <TodayView items={allItems} onSelectItem={openItem} />
          )}
          {view === "calendar" && (
            <CalendarView items={allItems} granularity={calGranularity} setGranularity={setCalGranularity} refDate={calRefDate} setRefDate={setCalRefDate} />
          )}
          {view === "gantt" && (
            <GanttView projects={projects} activeSegments={ganttActiveSegments} setActiveSegments={setGanttActiveSegments} />
          )}
          {view === "pie" && (
            <PieView items={allItems} period={period} setPeriod={setPeriod} customStart={customStart} setCustomStart={setCustomStart} customEnd={customEnd} setCustomEnd={setCustomEnd} />
          )}
        </>
      )}
    </div>
  );
}
