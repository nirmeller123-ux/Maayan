import { getSync, getAccessToken, admin, taskToEvent, markSynced } from "../_google.js";

// Stage 2: push tasks -> Google (create/update events on the dedicated calendar).
// Does NOT pull from Google or delete anything yet. Optional ?limit=N syncs only
// the first N tasks (used for a one-task test before the full run).
async function createEvent(calId, token, t) {
  const r = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(taskToEvent(t)),
  });
  return r.json();
}

export default async function handler(req, res) {
  try {
    const sync = await getSync();
    if (!sync?.refresh_token || !sync?.calendar_id) {
      res.status(400).json({ error: "not_connected" });
      return;
    }
    const token = await getAccessToken();
    const calId = sync.calendar_id;
    const limit = req.query?.limit ? parseInt(req.query.limit, 10) : null;

    const { data: tasks } = await admin().from("tasks").select("*").order("due_date");
    let list = tasks || [];
    if (limit && limit > 0) list = list.slice(0, limit);

    let created = 0, updated = 0, skipped = 0, errors = 0;
    for (const t of list) {
      try {
        const appChanged = !t.gcal_synced_at || new Date(t.updated_at) > new Date(t.gcal_synced_at);
        if (t.gcal_event_id) {
          if (!appChanged) { skipped++; continue; }
          const r = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events/${encodeURIComponent(t.gcal_event_id)}`,
            { method: "PUT", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(taskToEvent(t)) }
          );
          if (r.status === 404 || r.status === 410) {
            const cr = await createEvent(calId, token, t);
            if (cr?.id) { await markSynced(t.id, cr); created++; } else errors++;
            continue;
          }
          const got = await r.json();
          if (got?.id) { await markSynced(t.id, got); updated++; } else errors++;
        } else {
          const cr = await createEvent(calId, token, t);
          if (cr?.id) { await markSynced(t.id, cr); created++; } else errors++;
        }
      } catch {
        errors++;
      }
    }

    res.status(200).json({ ok: true, total: list.length, created, updated, skipped, errors });
  } catch (e) {
    res.status(500).json({ error: "server", detail: String(e?.message || e) });
  }
}
