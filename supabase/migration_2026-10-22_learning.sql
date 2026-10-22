-- Migration: Learning project (4-week defense-tech operations plan).
-- The curriculum lives in src/lib/learningPlan.js; these tables hold only progress.
--  * learning_sessions: per-session progress, plus the link to the calendar task
--    (a normal row in `tasks`) that holds the scheduled slot.
--  * learning_weeks: end-of-week confidence (1-5) and reflection.
--  * learning_insights: the free-form thoughts and insights log.
-- Run once in the Supabase SQL Editor. Safe to re-run.

create table if not exists learning_sessions (
  id text primary key,                                   -- curriculum id, e.g. 'w1a'
  task_id uuid references tasks(id) on delete set null,  -- the scheduled slot
  done boolean not null default false,
  done_at timestamptz,
  actual_hours numeric,
  note text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists learning_weeks (
  week int primary key check (week between 1 and 4),
  confidence int check (confidence between 1 and 5),
  reflection text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists learning_insights (
  id uuid primary key default gen_random_uuid(),
  session_id text,                      -- optional: which session prompted it
  week int check (week between 1 and 4),
  kind text not null default 'Insight', -- 'Insight' | 'Interview story' | 'Open question'
  topic text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists learning_insights_created_idx on learning_insights (created_at desc);

alter table learning_sessions enable row level security;
alter table learning_weeks enable row level security;
alter table learning_insights enable row level security;

drop policy if exists "Allow all on learning_sessions" on learning_sessions;
drop policy if exists "Allow all on learning_weeks" on learning_weeks;
drop policy if exists "Allow all on learning_insights" on learning_insights;
create policy "Allow all on learning_sessions" on learning_sessions for all using (true) with check (true);
create policy "Allow all on learning_weeks" on learning_weeks for all using (true) with check (true);
create policy "Allow all on learning_insights" on learning_insights for all using (true) with check (true);

-- Realtime, so a change on the phone shows on the laptop. The DO block skips
-- tables already in the publication, so re-running is safe.
do $$
declare t text;
begin
  foreach t in array array['learning_sessions', 'learning_weeks', 'learning_insights'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table %I', t);
    end if;
  end loop;
end $$;
