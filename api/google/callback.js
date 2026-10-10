import { REDIRECT_URI, APP_URL, CAL_TIMEZONE, getSync, saveSync, parseCookies } from "../_google.js";

function back(res, q) {
  res.setHeader("Set-Cookie", "g_state=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0");
  res.writeHead(302, { Location: `${APP_URL}/?${q}` });
  res.end();
}

// Google redirects here with ?code. Exchange it for tokens, create (or reuse)
// the dedicated "Renesance" calendar, store everything privately, and bounce
// back to the app.
export default async function handler(req, res) {
  const { code, state } = req.query;
  const cookies = parseCookies(req.headers.cookie);
  if (!state || state !== cookies.g_state) return back(res, "gcal=error&reason=state");
  if (!code) return back(res, "gcal=error&reason=nocode");

  try {
    const tokRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });
    const tok = await tokRes.json();
    if (!tok.access_token) return back(res, "gcal=error&reason=token");

    // Reuse an existing dedicated calendar if it still exists; else create one.
    const existing = await getSync();
    let calendarId = existing?.calendar_id || null;
    if (calendarId) {
      const check = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}`, {
        headers: { authorization: `Bearer ${tok.access_token}` },
      });
      if (!check.ok) calendarId = null;
    }
    if (!calendarId) {
      const calRes = await fetch("https://www.googleapis.com/calendar/v3/calendars", {
        method: "POST",
        headers: { authorization: `Bearer ${tok.access_token}`, "content-type": "application/json" },
        body: JSON.stringify({ summary: "Renesance", description: "Tasks synced from the Renesance app.", timeZone: CAL_TIMEZONE }),
      });
      const cal = await calRes.json();
      if (!cal.id) return back(res, "gcal=error&reason=calendar");
      calendarId = cal.id;
    }

    await saveSync({
      refresh_token: tok.refresh_token, // omitted-if-undefined keeps the existing one
      access_token: tok.access_token,
      token_expiry: new Date(Date.now() + tok.expires_in * 1000).toISOString(),
      calendar_id: calendarId,
      sync_token: null,
    });

    back(res, "gcal=connected");
  } catch {
    back(res, "gcal=error&reason=server");
  }
}
