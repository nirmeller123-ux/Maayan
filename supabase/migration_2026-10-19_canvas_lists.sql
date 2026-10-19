-- Migration: Canvas multiple lists.
-- Each day can hold several titled lists, and there are also "general" lists
-- not tied to any date (date is null). Run once in the Supabase SQL Editor.
-- Safe to re-run (guards below).

create table if not exists canvas_lists (
  id uuid primary key default gen_random_uuid(),
  date date,                         -- null = general (date-independent) list
  title text,                        -- null/empty = "Untitled list"
  body text not null default '',     -- same markdown convention as canvas_days.notes
  position int not null default 0,   -- order within a day / within general
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists canvas_lists_date_idx on canvas_lists (date, position, created_at);

alter table canvas_lists enable row level security;
drop policy if exists "Allow all on canvas_lists" on canvas_lists;
create policy "Allow all on canvas_lists" on canvas_lists for all using (true) with check (true);

-- One-time: carry each day's existing notes across as its first (untitled) list,
-- so nothing written before this feature disappears. Only for days that have
-- non-empty notes and don't already have a list.
insert into canvas_lists (date, title, body, position)
select d.date, null, d.notes, 0
from canvas_days d
where coalesce(trim(d.notes), '') <> ''
  and not exists (select 1 from canvas_lists l where l.date = d.date);
