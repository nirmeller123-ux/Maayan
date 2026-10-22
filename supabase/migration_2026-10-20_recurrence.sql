-- Migration: recurring tasks.
-- A recurring task is "materialized" into one real task row per occurrence,
-- all sharing a recurrence_id. This keeps every view (Daily/Gantt/Overview) and
-- the Google Calendar sync working with no special-casing — each occurrence is
-- just a normal task. recurrence_rule is kept for display ("repeats weekly").
-- Run once in the Supabase SQL Editor. Safe to re-run.

alter table tasks add column if not exists recurrence_id uuid;       -- groups a series (null = one-off)
alter table tasks add column if not exists recurrence_rule text;     -- 'daily' | 'weekly' | 'biweekly' | 'monthly'

create index if not exists tasks_recurrence_idx on tasks (recurrence_id);
