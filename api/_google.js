// Shared server-side helpers for Google Calendar sync. The leading underscore
// tells Vercel this is shared code, not a serverless function/route.
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://fkgxsjxtivlribwrfaik.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Trimmed so a stray space/newline pasted into the Vercel env var can't break OAuth.
export const GOOGLE_CLIENT_ID = (process.env.GOOGLE_CLIENT_ID || "").trim();
export const GOOGLE_CLIENT_SECRET = (process.env.GOOGLE_CLIENT_SECRET || "").trim();

export const APP_URL = "https://maayan-roan.vercel.app";
export const REDIRECT_URI = `${APP_URL}/api/google/callback`;
export const SCOPE = "https://www.googleapis.com/auth/calendar.app.created";
export const CAL_TIMEZONE = "Asia/Jerusalem";

// Service-role client — bypasses RLS, so it can read/write the locked-down
// google_sync table and the tasks' sync columns. Only ever runs server-side.
export function admin() {
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
}

export async function getSync() {
  const { data } = await admin().from("google_sync").select("*").eq("id", "me").maybeSingle();
  return data;
}

export async function saveSync(patch) {
  await admin().from("google_sync").upsert({ id: "me", ...patch, updated_at: new Date().toISOString() });
}

// A valid access token, refreshing via the stored refresh_token when expired.
export async function getAccessToken() {
  const sync = await getSync();
  if (!sync || !sync.refresh_token) throw new Error("not_connected");
  const now = Date.now();
  if (sync.access_token && sync.token_expiry && new Date(sync.token_expiry).getTime() - 60000 > now) {
    return sync.access_token;
  }
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: sync.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const tok = await r.json();
  if (!tok.access_token) throw new Error("refresh_failed");
  await saveSync({ access_token: tok.access_token, token_expiry: new Date(now + tok.expires_in * 1000).toISOString() });
  return tok.access_token;
}

// Thin wrapper over the Calendar API.
export async function gcal(path, opts = {}, accessToken) {
  const token = accessToken || (await getAccessToken());
  return fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    ...opts,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(opts.headers || {}) },
  });
}

// --- task <-> event mapping -------------------------------------------------

const SEG_COLOR = { family: "11", career: "9", ai: "3", income: "10", other: "8" };
const pad = (n) => String(n).padStart(2, "0");
export function addDaysIso(iso, n) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

// Build a Google Calendar event body from a task. Timed tasks become timed
// events sized by their `hours`; otherwise an all-day (optionally multi-day) event.
export function taskToEvent(t) {
  const desc = [];
  if (t.segment) desc.push(`Segment: ${t.segment}`);
  if (t.priority) desc.push(`Priority: ${t.priority}`);
  if (t.status) desc.push(`Status: ${t.status}`);
  const ev = {
    summary: (t.status === "Done" ? "✓ " : "") + (t.title || "(untitled)"),
    description: `${desc.join(" · ")}\n\n(Synced from Renesance — edit the task in the app)`,
    colorId: SEG_COLOR[t.segment] || "8",
    extendedProperties: { private: { taskId: String(t.id), source: "renesance" } },
  };
  if (t.start_time) {
    const [h, mi] = String(t.start_time).split(":").map(Number);
    const startMin = h * 60 + mi;
    const durMin = Math.max(15, Math.round((Number(t.hours) || 1) * 60));
    let endTotal = startMin + durMin;
    const extraDays = Math.floor(endTotal / 1440);
    endTotal %= 1440;
    const endDate = extraDays > 0 ? addDaysIso(t.due_date, extraDays) : t.due_date;
    ev.start = { dateTime: `${t.due_date}T${pad(h)}:${pad(mi)}:00`, timeZone: CAL_TIMEZONE };
    ev.end = { dateTime: `${endDate}T${pad(Math.floor(endTotal / 60))}:${pad(endTotal % 60)}:00`, timeZone: CAL_TIMEZONE };
  } else {
    ev.start = { date: t.start_date || t.due_date };
    ev.end = { date: addDaysIso(t.due_date, 1) }; // all-day end date is exclusive
  }
  return ev;
}

// Build a task patch from a Google event that a user changed in Calendar.
// Maps title + date/time/duration back. We only touch the fields the user can
// meaningfully change in Calendar (title, when, how long) — segment/priority/
// status stay owned by the app. Returns null for events we can't map.
export function eventToTaskPatch(ev) {
  const patch = {};
  if (typeof ev.summary === "string") {
    patch.title = ev.summary.replace(/^✓\s*/, "").trim() || "(untitled)";
  }
  if (ev.start?.dateTime) {
    // Timed event. The dateTime string carries the wall-clock in the event's
    // own timezone (e.g. "2026-10-20T09:00:00+03:00"); the date + HH:MM in that
    // string are exactly what we want to store.
    const m = String(ev.start.dateTime).match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
    if (!m) return null;
    patch.due_date = m[1];
    patch.start_time = `${m[2]}:${m[3]}`;
    patch.start_date = null;
    if (ev.end?.dateTime) {
      const ms = new Date(ev.end.dateTime).getTime() - new Date(ev.start.dateTime).getTime();
      if (ms > 0) patch.hours = Math.round((ms / 3600000) * 100) / 100;
    }
  } else if (ev.start?.date) {
    // All-day (possibly multi-day). end.date is exclusive.
    patch.start_time = null;
    const s = ev.start.date;
    const due = ev.end?.date ? addDaysIso(ev.end.date, -1) : s;
    patch.due_date = due;
    patch.start_date = s && s !== due ? s : null;
  } else {
    return null;
  }
  return patch;
}

// Record that a task is synced to a given event (bookkeeping only — the trigger
// won't treat this as a user edit).
export async function markSynced(taskId, event) {
  await admin()
    .from("tasks")
    .update({ gcal_event_id: event.id, gcal_updated: event.updated, gcal_synced_at: new Date().toISOString() })
    .eq("id", taskId);
}

export function parseCookies(header) {
  const out = {};
  (header || "").split(";").forEach((c) => {
    const i = c.indexOf("=");
    if (i > -1) out[c.slice(0, i).trim()] = decodeURIComponent(c.slice(i + 1).trim());
  });
  return out;
}
