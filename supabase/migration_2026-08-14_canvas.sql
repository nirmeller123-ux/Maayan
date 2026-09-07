-- Migration: Canvas — per-day free writing, free-hand sketch, and file attachments.
-- Run once in the Supabase SQL Editor. Safe to re-run (guards below).

-- One row per day: the notes text and a pointer to the day's sketch image.
create table if not exists canvas_days (
  date date primary key,
  notes text not null default '',
  sketch_path text,
  updated_at timestamptz not null default now()
);

-- Attachments uploaded to a given day.
create table if not exists canvas_files (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  name text not null,
  path text not null,
  mime text,
  size bigint,
  created_at timestamptz not null default now()
);

alter table canvas_days enable row level security;
alter table canvas_files enable row level security;

drop policy if exists "Allow all on canvas_days" on canvas_days;
create policy "Allow all on canvas_days" on canvas_days for all using (true) with check (true);
drop policy if exists "Allow all on canvas_files" on canvas_files;
create policy "Allow all on canvas_files" on canvas_files for all using (true) with check (true);

-- Private storage bucket for sketch images + attachments (served via signed URLs).
insert into storage.buckets (id, name, public)
  values ('canvas', 'canvas', false)
  on conflict (id) do nothing;

-- Let the app's key manage objects in the 'canvas' bucket only.
drop policy if exists "canvas read" on storage.objects;
create policy "canvas read"   on storage.objects for select using (bucket_id = 'canvas');
drop policy if exists "canvas insert" on storage.objects;
create policy "canvas insert" on storage.objects for insert with check (bucket_id = 'canvas');
drop policy if exists "canvas update" on storage.objects;
create policy "canvas update" on storage.objects for update using (bucket_id = 'canvas') with check (bucket_id = 'canvas');
drop policy if exists "canvas delete" on storage.objects;
create policy "canvas delete" on storage.objects for delete using (bucket_id = 'canvas');
