-- Renesance app schema
-- Run this once in the Supabase SQL Editor (Project -> SQL Editor -> New query).

create extension if not exists "pgcrypto";

-- Standalone tasks: title, due date, priority, hours, segment, status, start time.
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  due_date date not null,
  priority text not null check (priority in ('High', 'Medium', 'Low')),
  hours numeric not null default 0,
  segment text not null check (segment in ('family', 'career', 'ai', 'income', 'other')),
  status text not null default 'Not Started'
    check (status in ('Not Started', 'In Progress', 'On Hold', 'Done')),
  -- Optional hour-by-hour start time. Null means "untimed" (shown in the
  -- Calendar Day view's all-day strip rather than on the timeline).
  start_time time,
  created_at timestamptz not null default now()
);

-- Projects: a named container tagged to one segment.
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  segment text not null check (segment in ('family', 'career', 'ai', 'income', 'other')),
  created_at timestamptz not null default now()
);

-- Project tasks: the steps inside a project. depends_on models a simple
-- linear chain (step N depends on step N-1), matching the current UI.
-- To support a fuller dependency graph later (a step depending on more than
-- one predecessor), replace depends_on with a join table
-- project_task_dependencies(task_id, depends_on_task_id).
create table if not exists project_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  title text not null,
  start_date date not null,
  due_date date not null,
  hours numeric not null default 0,
  priority text not null check (priority in ('High', 'Medium', 'Low')),
  status text not null default 'Not Started'
    check (status in ('Not Started', 'In Progress', 'On Hold', 'Done')),
  -- Optional hour-by-hour start time, same semantics as tasks.start_time.
  start_time time,
  depends_on uuid references project_tasks(id) on delete set null,
  position int not null default 0,
  created_at timestamptz not null default now()
);

-- Row Level Security -----------------------------------------------------
-- This is a personal, single-user app using Supabase's public "anon" key,
-- so we enable RLS but allow all operations. This keeps the database from
-- being silently locked down while still going through RLS rather than
-- bypassing it entirely. If you ever add real user accounts (Supabase Auth)
-- and expose this to more than yourself, replace these policies with ones
-- scoped to auth.uid().

alter table tasks enable row level security;
alter table projects enable row level security;
alter table project_tasks enable row level security;

create policy "Allow all on tasks" on tasks
  for all using (true) with check (true);

create policy "Allow all on projects" on projects
  for all using (true) with check (true);

create policy "Allow all on project_tasks" on project_tasks
  for all using (true) with check (true);

-- Realtime -----------------------------------------------------------------
-- Enable realtime so changes made on one device show up on another.
alter publication supabase_realtime add table tasks;
alter publication supabase_realtime add table projects;
alter publication supabase_realtime add table project_tasks;
