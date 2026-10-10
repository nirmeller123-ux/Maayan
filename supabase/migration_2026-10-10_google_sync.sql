-- Migration: two-way Google Calendar sync (standalone tasks, dedicated calendar)
-- Run once in the Supabase SQL Editor. Safe to re-run.

-- Private store: OAuth tokens + sync state. RLS is enabled with NO policies, so
-- the public anon key gets zero rows. Only the service role (used server-side by
-- the Vercel functions) bypasses RLS and can read/write this.
create table if not exists google_sync (
  id text primary key default 'me',
  refresh_token text,
  access_token text,
  token_expiry timestamptz,
  calendar_id text,
  sync_token text,
  connected_email text,
  updated_at timestamptz not null default now()
);
alter table google_sync enable row level security;
-- Extra belt-and-suspenders: drop the public roles' table privileges entirely.
revoke all on table google_sync from anon, authenticated;

-- Mapping + change-tracking columns on tasks (not secret; fine for the client to read).
alter table tasks add column if not exists gcal_event_id text;   -- linked Google event
alter table tasks add column if not exists gcal_updated timestamptz; -- event.updated last reconciled
alter table tasks add column if not exists gcal_synced_at timestamptz; -- when we last pushed/pulled
alter table tasks add column if not exists updated_at timestamptz not null default now();

-- Keep tasks.updated_at current so the sync can tell when the app changed a task.
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists tasks_set_updated_at on tasks;
create trigger tasks_set_updated_at
  before update on tasks
  for each row execute function set_updated_at();
