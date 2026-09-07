import Anthropic from "@anthropic-ai/sdk";

// Turns a short spoken instruction (Hebrew or English) into a structured task
// (or a small project) for the Renesance planner. Runs server-side on Vercel so
// the Anthropic API key never reaches the browser. Uses Haiku — this is a tiny
// extraction, ~a tenth of a cent per call.
function extractJson(text) {
  if (!text) return null;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "missing_key" });
    return;
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const { transcript, today, weekday, segments } = body || {};
  if (!transcript || !String(transcript).trim()) {
    res.status(400).json({ error: "no_transcript" });
    return;
  }

  const segList = Array.isArray(segments) && segments.length
    ? segments.map((s) => `${s.id} (${s.name})`).join(", ")
    : "family, career, ai, income, other";

  const system = `You convert one short spoken instruction (Hebrew or English) into a task for a personal planner. Today is ${today}${weekday ? ` (${weekday})` : ""}. Resolve relative dates ("next Tuesday", "מחר", "בעוד שבוע", "ראשון הבא") to absolute YYYY-MM-DD.

Choose the best segment id from: ${segList}.

Return ONLY a JSON object — no prose, no code fences. Shape for a single task:
{"kind":"task","title":string,"start_date":"YYYY-MM-DD"|null,"due_date":"YYYY-MM-DD","start_time":"HH:MM"|null,"priority":"High"|"Medium"|"Low","hours":number,"segment":"<id>"}

If (and only if) the user clearly describes a multi-step project, return instead:
{"kind":"project","name":string,"segment":"<id>","steps":[{"title":string,"start_date":"YYYY-MM-DD","due_date":"YYYY-MM-DD","start_time":"HH:MM"|null,"priority":"High"|"Medium"|"Low","hours":number}]}

Rules:
- due_date is required. If no date is mentioned, use today (${today}).
- start_date is null for a normal single-day task; set it only for an explicitly multi-day task.
- start_time only if a clock time was said (24h "HH:MM"), else null.
- Defaults: priority "Medium", hours 1, segment "other".
- Keep the title concise and in the language the user spoke.`;

  try {
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 600,
      system,
      messages: [{ role: "user", content: String(transcript) }],
    });
    const text = (msg.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    const item = extractJson(text);
    if (!item || !item.kind) {
      res.status(422).json({ error: "parse_failed" });
      return;
    }
    res.status(200).json({ item });
  } catch (e) {
    res.status(502).json({ error: "api_error", detail: String(e?.message || e) });
  }
}
