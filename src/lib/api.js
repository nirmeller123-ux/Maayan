import { supabase } from "./supabaseClient";

export async function fetchTasks() {
  const { data, error } = await supabase.from("tasks").select("*").order("due_date");
  if (error) throw error;
  return data;
}

export async function createTask(task) {
  const { data, error } = await supabase.from("tasks").insert(task).select().single();
  if (error) throw error;
  return data;
}

// Insert a whole recurring series at once: every occurrence shares a new
// recurrence_id so it can be identified (and deleted) as a series.
export async function createRecurringTasks(base, occurrences, rule) {
  const recurrence_id = (crypto.randomUUID && crypto.randomUUID()) || String(Date.now());
  const rows = occurrences.map((o) => ({
    ...base,
    start_date: o.start_date,
    due_date: o.due_date,
    recurrence_id,
    recurrence_rule: rule,
  }));
  const { data, error } = await supabase.from("tasks").insert(rows).select();
  if (error) throw error;
  return data;
}

export async function deleteRecurringSeries(recurrenceId) {
  const { error } = await supabase.from("tasks").delete().eq("recurrence_id", recurrenceId);
  if (error) throw error;
}

export async function fetchProjects() {
  const { data: projects, error: pErr } = await supabase
    .from("projects")
    .select("*")
    .order("created_at");
  if (pErr) throw pErr;

  const { data: allTasks, error: tErr } = await supabase
    .from("project_tasks")
    .select("*")
    .order("position");
  if (tErr) throw tErr;

  return projects.map((p) => ({
    ...p,
    tasks: allTasks.filter((t) => t.project_id === p.id),
  }));
}

// Creates a project plus its steps, wiring each step's depends_on to the
// previous step's real database id (a simple linear chain).
export async function createProject({ name, segment, steps }) {
  const { data: project, error: pErr } = await supabase
    .from("projects")
    .insert({ name, segment })
    .select()
    .single();
  if (pErr) throw pErr;

  let previousId = null;
  const inserted = [];
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const { data: row, error: rowErr } = await supabase
      .from("project_tasks")
      .insert({
        project_id: project.id,
        title: step.title,
        start_date: step.start_date,
        due_date: step.due_date,
        start_time: step.start_time ?? null,
        hours: step.hours,
        priority: step.priority,
        status: step.status || "Not Started",
        depends_on: previousId,
        position: i,
      })
      .select()
      .single();
    if (rowErr) throw rowErr;
    inserted.push(row);
    previousId = row.id;
  }

  return { ...project, tasks: inserted };
}

export async function updateTask(id, patch) {
  const { data, error } = await supabase.from("tasks").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteTask(id) {
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) throw error;
}

export async function deleteProject(id) {
  // project_tasks rows cascade-delete automatically (see schema.sql FK).
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw error;
}

// Updates a project's core fields and reconciles its steps against the
// submitted list: existing steps (have an id) are updated in place, steps
// no longer present are deleted, and new steps (no id) are inserted. The
// depends_on chain is then rebuilt in submitted order so it stays a valid
// linear chain regardless of edits, additions, or removals.
export async function updateProject({ id, name, segment, steps }) {
  const { error: pErr } = await supabase.from("projects").update({ name, segment }).eq("id", id);
  if (pErr) throw pErr;

  for (const step of steps) {
    if (step.id) {
      const { error } = await supabase
        .from("project_tasks")
        .update({
          title: step.title,
          start_date: step.start_date,
          due_date: step.due_date,
          start_time: step.start_time ?? null,
          hours: step.hours,
          priority: step.priority,
          status: step.status || "Not Started",
        })
        .eq("id", step.id);
      if (error) throw error;
    }
  }

  const { data: existingRows, error: fetchErr } = await supabase
    .from("project_tasks")
    .select("id")
    .eq("project_id", id);
  if (fetchErr) throw fetchErr;
  const keepIds = new Set(steps.filter((s) => s.id).map((s) => s.id));
  const toDelete = existingRows.filter((r) => !keepIds.has(r.id)).map((r) => r.id);
  if (toDelete.length > 0) {
    const { error: delErr } = await supabase.from("project_tasks").delete().in("id", toDelete);
    if (delErr) throw delErr;
  }

  let previousId = null;
  const finalSteps = [];
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (step.id) {
      finalSteps.push(step);
    } else {
      const { data: row, error } = await supabase
        .from("project_tasks")
        .insert({
          project_id: id,
          title: step.title,
          start_date: step.start_date,
          due_date: step.due_date,
          start_time: step.start_time ?? null,
          hours: step.hours,
          priority: step.priority,
          status: step.status || "Not Started",
          depends_on: previousId,
          position: i,
        })
        .select()
        .single();
      if (error) throw error;
      finalSteps.push(row);
    }
    previousId = finalSteps[finalSteps.length - 1].id;
  }

  previousId = null;
  for (let i = 0; i < finalSteps.length; i++) {
    const s = finalSteps[i];
    const { error } = await supabase
      .from("project_tasks")
      .update({ depends_on: previousId, position: i })
      .eq("id", s.id);
    if (error) throw error;
    previousId = s.id;
  }

  return true;
}

// ---- Canvas: per-day notes, sketch, and file attachments ------------------

export async function fetchCanvasDay(date) {
  const { data, error } = await supabase.from("canvas_days").select("*").eq("date", date).maybeSingle();
  if (error) throw error;
  return data; // null if the day has no canvas yet
}

export async function saveCanvasDay(date, patch) {
  const { error } = await supabase
    .from("canvas_days")
    .upsert({ date, ...patch, updated_at: new Date().toISOString() });
  if (error) throw error;
}

// Canvas lists: several titled lists per day, plus general (date-null) lists.
export async function fetchCanvasLists(date) {
  let q = supabase.from("canvas_lists").select("*");
  q = date == null ? q.is("date", null) : q.eq("date", date);
  const { data, error } = await q.order("position").order("created_at");
  if (error) throw error;
  return data;
}

export async function createCanvasList(row) {
  const { data, error } = await supabase.from("canvas_lists").insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function updateCanvasList(id, patch) {
  const { error } = await supabase
    .from("canvas_lists")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteCanvasList(id) {
  const { error } = await supabase.from("canvas_lists").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchCanvasFiles(date) {
  const { data, error } = await supabase
    .from("canvas_files")
    .select("*")
    .eq("date", date)
    .order("created_at");
  if (error) throw error;
  return data;
}

export async function addCanvasFileRow(row) {
  const { data, error } = await supabase.from("canvas_files").insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function deleteCanvasFileRow(id) {
  const { error } = await supabase.from("canvas_files").delete().eq("id", id);
  if (error) throw error;
}

// Storage (private "canvas" bucket) — reads go through short-lived signed URLs.
export async function uploadCanvasObject(path, body, contentType) {
  const { error } = await supabase.storage
    .from("canvas")
    .upload(path, body, { upsert: true, contentType });
  if (error) throw error;
  return path;
}

export async function signedCanvasUrl(path, expiresIn = 3600) {
  const { data, error } = await supabase.storage.from("canvas").createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}

export async function removeCanvasObject(path) {
  const { error } = await supabase.storage.from("canvas").remove([path]);
  if (error) throw error;
}

// Subscribes to changes on all three tables so the UI can refetch and stay
// in sync across devices. Returns an unsubscribe function.
export function subscribeToChanges(onChange) {
  const channel = supabase
    .channel("renesance-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "project_tasks" }, onChange)
    .subscribe();

  return () => supabase.removeChannel(channel);
}
// ---- Learning project: scheduled slots, progress, insights -----------------
// Scheduled slots are ordinary rows in `tasks` (so Daily, Calendar and Google
// sync show them). These tables hold only progress and the thoughts log.

export async function createTasks(rows) {
  const { data, error } = await supabase.from("tasks").insert(rows).select();
  if (error) throw error;
  return data;
}

export async function fetchLearning() {
  const [s, w, i] = await Promise.all([
    supabase.from("learning_sessions").select("*"),
    supabase.from("learning_weeks").select("*"),
    supabase.from("learning_insights").select("*").order("created_at", { ascending: false }),
  ]);
  if (s.error) throw s.error;
  if (w.error) throw w.error;
  if (i.error) throw i.error;
  return { sessions: s.data || [], weeks: w.data || [], insights: i.data || [] };
}

// Upsert one session's progress. Only the fields in `patch` are written.
export async function upsertLearningSession(id, patch) {
  const { error } = await supabase
    .from("learning_sessions")
    .upsert({ id, ...patch, updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (error) throw error;
}

// Link many sessions to their calendar tasks at once. Every row must carry the
// same keys (id, task_id) so no column is overwritten with null.
export async function linkLearningSessions(pairs) {
  const rows = pairs.map(({ id, task_id }) => ({ id, task_id, updated_at: new Date().toISOString() }));
  const { error } = await supabase.from("learning_sessions").upsert(rows, { onConflict: "id" });
  if (error) throw error;
}

export async function upsertLearningWeek(week, patch) {
  const { error } = await supabase
    .from("learning_weeks")
    .upsert({ week, ...patch, updated_at: new Date().toISOString() }, { onConflict: "week" });
  if (error) throw error;
}

export async function createLearningInsight(row) {
  const { data, error } = await supabase.from("learning_insights").insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function deleteLearningInsight(id) {
  const { error } = await supabase.from("learning_insights").delete().eq("id", id);
  if (error) throw error;
}

// Separate channel from subscribeToChanges so the Learning view can refetch
// only its own tables.
export function subscribeToLearning(onChange) {
  const channel = supabase
    .channel("renesance-learning")
    .on("postgres_changes", { event: "*", schema: "public", table: "learning_sessions" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "learning_weeks" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "learning_insights" }, onChange)
    .subscribe();
  return () => supabase.removeChannel(channel);
}
