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