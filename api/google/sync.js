import { getSync, saveSync, getAccessToken, admin, taskToEvent, eventToTaskPatch, markSynced } from "../_google.js";

// Give the full two-way reconcile room to finish on larger calendars.
export const config = { maxDuration: 60 };

// Two-way sync for the dedicated calendar:
//   PUSH  app -> Google   (create/update events for changed tasks)
//   PULL  Google -> app   (apply user edits made in Calendar back to tasks)
// Push runs first so that if a task changed in both places, the app wins and the
// pull sees the event already matching (no ping-pong). Deletions are NOT handled
// yet (Stage 4). Optional ?limit=N limits the push to the first N tasks.

async function createEvent(calId, token, t) {
  const r = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(taskToEvent(t)),
  });
  return r.json();
}

async function pushPhase(calId, token, limit) {
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
  return { total: list.length, created, updated, skipped, errors };
}

async function listEventsPage(calId, token, params) {
  const qs = new URLSearchParams(params).toString();
  const r = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events?${qs}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  return { status: r.status, body: await r.json() };
}

async function pullPhase(calId, token, storedSyncToken) {
  // Fresh snapshot of tasks that already have an event, keyed by event id.
  const { data: tasks } = await admin().from("tasks").select("*").not("gcal_event_id", "is", null);
  const byEvent = new Map((tasks || []).map((t) => [t.gcal_event_id, t]));

  let syncToken = storedSyncToken || null;
  let pageToken = null;
  let nextSyncToken = null;
  let pulled = 0, pullErrors = 0, deletedSeen = 0;
  let didFullRescan = false;

  for (let guard = 0; guard < 50; guard++) {
    const params = { singleEvents: "true", showDeleted: "true", maxResults: "250" };
    if (syncToken) params.syncToken = syncToken;
    else params.timeMin = "2020-01-01T00:00:00Z";
    if (pageToken) params.pageToken = pageToken;

    const { status, body } = await listEventsPage(calId, token, params);

    // A stale/expired sync token → Google returns 410. Drop it and do one full rescan.
    if (status === 410 && syncToken && !didFullRescan) {
      syncToken = null;
      pageToken = null;
      didFullRescan = true;
      continue;
    }
    if (status >= 400) { pullErrors++; break; }

    for (const ev of body.items || []) {
      const taskId = ev.extendedProperties?.private?.taskId;
      if (!taskId) continue; // not one of ours
      if (ev.status === "cancelled") { deletedSeen++; continue; } // deletions = Stage 4

      const task = byEvent.get(ev.id);
      if (!task) continue; // event with no matching task (task deleted app-side); Stage 4

      // Did Google actually change since we last pushed/saw this event?
      if (ev.updated && ev.updated === task.gcal_updated) continue;
      // App edited more recently than our last sync → push already handled it; app wins.
      const appChanged = task.updated_at && task.gcal_synced_at && new Date(task.updated_at) > new Date(task.gcal_synced_at);
      if (appChanged) continue;

      const patch = eventToTaskPatch(ev);
      if (!patch) continue;
      try {
        // Step 1: apply the user-facing fields. The trigger bumps updated_at.
        const { data: row } = await admin()
          .from("tasks").update({ ...patch, gcal_updated: ev.updated }).eq("id", task.id).select("updated_at").single();
        // Step 2: set gcal_synced_at = that new updated_at so this change doesn't
        // look app-newer and get re-pushed on the next run.
        if (row?.updated_at) {
          await admin().from("tasks").update({ gcal_synced_at: row.updated_at }).eq("id", task.id);
        }
        pulled++;
      } catch {
        pullErrors++;
      }
    }

    if (body.nextPageToken) { pageToken = body.nextPageToken; continue; }
    if (body.nextSyncToken) nextSyncToken = body.nextSyncToken;
    break;
  }

  if (nextSyncToken) await saveSync({ sync_token: nextSyncToken });
  return { pulled, pullErrors, deletedSeen };
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

    const push = await pushPhase(calId, token, limit);
    // Skip the pull on a limited test run (it would full-scan the calendar).
    const pull = limit ? { pulled: 0, pullErrors: 0, deletedSeen: 0 } : await pullPhase(calId, token, sync.sync_token);

    res.status(200).json({ ok: true, push, pull });
  } catch (e) {
    res.status(500).json({ error: "server", detail: String(e?.message || e) });
  }
}
