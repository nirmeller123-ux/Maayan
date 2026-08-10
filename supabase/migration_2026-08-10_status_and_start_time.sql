-- Migration: add task status + hourly start time
-- Run once in the Supabase SQL Editor. Safe to re-run (each statement is
-- guarded by "if not exists"). Existing rows backfill to 'Not Started' and
-- a null start_time (treated as "untimed").

-- Feature 1: status on standalone tasks and project steps.
alter table tasks
  add column if not exists status text not null default 'Not Started'
  check (status in ('Not Started', 'In Progress', 'On Hold', 'Done'));

alter table project_tasks
  add column if not exists status text not null default 'Not Started'
  check (status in ('Not Started', 'In Progress', 'On Hold', 'Done'));

-- Feature 2: optional hour-by-hour start time.
alter table tasks        add column if not exists start_time time;
alter table project_tasks add column if not exists start_time time;
