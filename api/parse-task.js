import Anthropic from "@anthropic-ai/sdk";

// Turns a short spoken instruction (Hebrew or English) into a structured task
// (or a small project) for the Renesance planner. Runs server-side on Vercel so
// the Anthropic API key never reaches the browser. Uses Haiku with a forced
// tool call, so the model returns structured fields directly — reliable across
// languages (plain "return JSON" prompting is flaky for Hebrew). ~a tenth of a
// cent per call.

const SEGMENT_IDS = ["family", "career", "ai", "income", "other"];

const TOOL = {
  name: "emit_item",
  description: "Return the parsed task or (only if clearly multi-step) project.",
  input_schema: {
    type: "object",
    properties: {
      kind: { type: "string", enum: ["task", "project"] },
      title: { type: "string", description: "Task title, or project name. Concise, in the language spoken." },
      segment: { type: "string", enum: SEGMENT_IDS },
      start_date: { type: ["string", "null"], description: "YYYY-MM-DD. Only for an explicitly multi-day task; else null." },
      due_date: { type: ["string", "null"], description: "YYYY-MM-DD the task is due/happens. Required for a task." },
      start_time: { type: ["string", "null"], description: "24h HH:MM if a clock time was said; else null." },
      priority: { type: "string", enum: ["High", "Medium", "Low"] },
      hours: { type: "number" },
      steps: {
        type: "array",
        description: "Only when kind is project.",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            start_date: { type: ["string", "null"] },
            due_date: { type: "string" },
            start_time: { type: ["string", "null"] },
            priority: { type: "string", enum: ["High", "Medium", "Low"] },
            hours: { type: "number" },
          },
          required: ["title", "due_date"],
        },
      },
    },
    required: ["kind", "title", "segment", "priority", "hours"],
  },
};

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
    : SEGMENT_IDS.join(", ");

  const system = `You convert one short spoken instruction (Hebrew or English) into a planner item, then call emit_item with the result. Today is ${today}${weekday ? ` (${weekday})` : ""}. Resolve relative dates ("next Tuesday", "מחר", "בעוד שבוע", "ראשון הבא") to absolute YYYY-MM-DD.

Segment ids: ${segList}. Pick the best fit.

Rules:
- kind is "task" unless the user clearly describes a multi-step project (then "project" with steps).
- due_date is required for a task; if no date is mentioned use today (${today}).
- start_date is null for a normal single-day task; set it only for an explicitly multi-day task.
- start_time only if a clock time was said (24h "HH:MM"), else null.
- Defaults: priority "Medium", hours 1, segment "other".
- Title stays concise and in the language the user spoke.`;

  try {
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      // Sonnet handles Hebrew/free-form extraction reliably (Haiku mis-parsed
      // Hebrew). Still ~a fifth of a cent per spoken task.
      model: "claude-sonnet-5",
      max_tokens: 600,
      system,
      tools: [TOOL],
      tool_choice: { type: "tool", name: "emit_item" },
      messages: [{ role: "user", content: String(transcript) }],
    });
    const block = (msg.content || []).find((b) => b.type === "tool_use");
    const item = block && block.input;
    if (!item || !item.kind) {
      res.status(422).json({ error: "parse_failed" });
      return;
    }
    res.status(200).json({ item });
  } catch (e) {
    res.status(502).json({ error: "api_error", detail: String(e?.message || e) });
  }
}
