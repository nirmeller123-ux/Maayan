import { getSync } from "../_google.js";

// Lightweight connection check for the app to show Connected / Not connected.
export default async function handler(req, res) {
  try {
    const sync = await getSync();
    res.status(200).json({ connected: !!(sync && sync.refresh_token), calendarId: sync?.calendar_id || null });
  } catch {
    res.status(200).json({ connected: false });
  }
}
