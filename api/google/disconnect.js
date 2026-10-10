import { getSync, saveSync } from "../_google.js";

// Revokes Google access and clears the stored tokens. Keeps calendar_id so a
// later reconnect reuses the same dedicated calendar instead of making a new one.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }
  try {
    const sync = await getSync();
    if (sync?.refresh_token) {
      try {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(sync.refresh_token)}`, {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
        });
      } catch { /* best effort */ }
    }
    await saveSync({ refresh_token: null, access_token: null, token_expiry: null, sync_token: null });
    res.status(200).json({ ok: true });
  } catch {
    res.status(500).json({ error: "server" });
  }
}
