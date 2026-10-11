-- Refine the updated_at trigger: only bump tasks.updated_at when a user-facing
-- field actually changes. This way the Google sync writing its bookkeeping
-- columns (gcal_event_id / gcal_updated / gcal_synced_at) doesn't look like an
-- edit and cause needless re-syncs or loops. The trigger created earlier stays;
-- this just replaces the function it calls.
create or replace function set_updated_at() returns trigger as $$
begin
  if row(new.title, new.start_date, new.due_date, new.start_time, new.priority, new.status, new.hours, new.segment)
     is distinct from
     row(old.title, old.start_date, old.due_date, old.start_time, old.priority, old.status, old.hours, old.segment)
  then
    new.updated_at = now();
  end if;
  return new;
end;
$$ language plpgsql;
