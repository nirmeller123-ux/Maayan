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

export function parseCookies(header) {
  const out = {};
  (header || "").split(";").forEach((c) => {
    const i = c.indexOf("=");
    if (i > -1) out[c.slice(0, i).trim()] = decodeURIComponent(c.slice(i + 1).trim());
  });
  return out;
}
