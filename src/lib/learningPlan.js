// The 4-week defense-tech operations learning plan. Progress lives in Supabase
// (learning_sessions / learning_weeks / learning_insights); the curriculum itself
// lives here so it is easy to edit. Session ids (w1a, w2c, ...) are the keys.
export const PLAN_URL = "https://claude.ai/artifact/9emod4KkuV8MkbkqcUqWpE";

export const TOPICS = ["Defense context", "Purchasing", "AI in ops", "Lean and OpEx", "Change leadership", "Interview", "LinkedIn"];
export const KINDS = ["Insight", "Interview story", "Open question"];
export const WEEK_TOPIC = { 1: "Defense context", 2: "Purchasing", 3: "AI in ops", 4: "Lean and OpEx" };

export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Default weekly rhythm, keyed by session code. day: 0 = Sunday. Edit in the
// scheduler dialog; these are only the starting suggestion (about 8.5 to 9 h a week).
export const DEFAULT_PATTERN = {
  A: { day: 0, time: "20:00" },
  B: { day: 2, time: "20:00" },
  C: { day: 4, time: "20:00" },
  D: { day: 5, time: "09:00" },
  E: { day: 5, time: "11:30" },
  LI: { day: 5, time: "12:00" },
};

export const WEEKS = [
  { n: 1, title: "Defense operations context", goal: "Speak the language of defense operations: export control, quality regimes, and why the industry's problem is now delivery at rate.",
    check: "Explain in two minutes what stops a defense hardware company from exporting a new product, and what the board should worry about if tier-2 suppliers cannot scale.",
    sessions: [
      { id: "w1a", code: "A", kind: "Learn", title: "Regulation: Israeli and US export control", h: 2, what: "Read the DECA overview and site, the Defense Export Control Act, then a primer on ITAR and EAR flow-down to suppliers.", out: "One page: licence types, who must register, what flows down." },
      { id: "w1b", code: "B", kind: "Learn", title: "Industry state: delivery at rate", h: 2, what: "Oliver Wyman, The Defense Ramp-up Reality Check, and Deloitte on US defense manufacturing at industrial scale.", out: "Five recurring bottlenecks and how you would test each in a new company." },
      { id: "w1c", code: "C", kind: "Deep dive", title: "Quality regimes", h: 2.5, what: "AS9100D, AS9102 first article, AS5553 counterfeit electronics, IPC-A-610 and J-STD-001 Class 3. How lean and AS9100 coexist.", out: "Audit-readiness checklist: 5 to 7 items to verify in your first 30 days." },
      { id: "w1d", code: "D", kind: "Apply", title: "Company X diagnostic", h: 1.5, what: "Pick a real target company. Infer programs, customers, export exposure, certifications and where it sits on the prototype-to-serial curve.", out: "A one-page diagnostic you reuse every week." },
      { id: "w1e", code: "E", kind: "Review", title: "Friday log", h: 0.5, what: "Five lines on what changed, plus three sharp interview questions on regulation and quality.", out: "Entry in your Operations playbook." },
      { id: "w1l", code: "LI", kind: "LinkedIn", title: "Fix dates and titles, draft headline and About", h: 0, what: "Add the SolarEdge end date, align titles with your CV, draft the new headline and About. State any real defense or aerospace exposure.", out: "Draft text saved." },
    ] },
  { n: 2, title: "Purchasing and subcontractors", goal: "Move from running Tier-1 relationships to designing a defense-grade supply base: segmented, qualified, dual-sourced where it matters, visible down to tier-2/3.",
    check: "Defend a price premium for a dual-sourced critical component to a CFO, and explain to a CEO how you reach tier-3 visibility in 90 days.",
    sessions: [
      { id: "w2a", code: "A", kind: "Learn", title: "Category strategy", h: 2, what: "Kraljic matrix, total cost of ownership, should-cost. Segment your last employer's top 30 spend categories.", out: "Kraljic grid with the defense-specific factors that move a category." },
      { id: "w2b", code: "B", kind: "Learn", title: "Contracts and risk", h: 2, what: "Prioritise suppliers by schedule criticality and qualification lead time. LTAs, VMI, consignment, NCNR, indexation, obsolescence.", out: "One-page contract toolkit: when to use each clause and what it costs." },
      { id: "w2c", code: "C", kind: "Deep dive", title: "Establishing a subcontractor", h: 2.5, what: "Make-vs-buy, RFQ and audit, AS9100 and special processes, counterfeit-prevention rules, pilot, first article, ramp, scorecard, QBR, exit.", out: "Stage-gate flowchart with owners and evidence at each gate." },
      { id: "w2d", code: "D", kind: "Apply", title: "Supply base strategy for company X", h: 2, what: "Make-vs-buy for its top 5 modules, where to dual-source, first 90 days of supplier actions, tier-2/3 mapping for the top 10 critical parts.", out: "Two-page supply base strategy." },
      { id: "w2e", code: "E", kind: "Review", title: "Friday log", h: 0.5, what: "Reframe your COVID shortage story with the defense lens: what changes under export control and qualification lead times?", out: "A two-minute interview story." },
      { id: "w2l", code: "LI", kind: "LinkedIn", title: "Skills, SolarEdge roles, recommendations", h: 0, what: "Pin supply-chain skills, split SolarEdge into two roles with metrics, request two recommendations, post a supplier-segmentation note.", out: "Profile updated, two requests sent." },
    ] },
  { n: 3, title: "AI in manufacturing and operations", goal: "Say what to automate first, what data it needs, how to protect defense-sensitive data, and what ROI to expect.",
    check: "Present three AI pilots for a defense plant, each with a baseline metric, a 90-day target, a data owner and a data-security class.",
    sessions: [
      { id: "w3a", code: "A", kind: "Learn", title: "AI literacy for leaders", h: 2, what: "Andrew Ng's AI for Everyone and the AI Transformation Playbook.", out: "What makes a good first AI project, and what is a trap." },
      { id: "w3b", code: "B", kind: "Learn", title: "Use-case landscape", h: 2, what: "Deloitte on generative AI in manufacturing, the AI points in Deloitte's defense scaling piece, and Oliver Wyman's sober view.", out: "Table of 8 use cases with data needed and a first pilot each." },
      { id: "w3c", code: "C", kind: "Deep dive", title: "Roadmap and governance", h: 2.5, what: "Value x feasibility x data readiness, data foundation, build vs buy, pilot with baseline and stop rule, data classes for restricted data.", out: "One-page AI governance outline: data classes, allowed tools, approval path, owner." },
      { id: "w3d", code: "D", kind: "Apply", title: "Hands-on analysis", h: 2, what: "Analyse an anonymised export (shortages, lead times, scrap) with Claude. Use no confidential data from a past employer.", out: "A demo story with real numbers and what needed human checks." },
      { id: "w3e", code: "E", kind: "Review", title: "Friday log", h: 0.5, what: "Write your 90-second answer: where would you start with AI in our factory, and what would you not do?", out: "Interview answer." },
      { id: "w3l", code: "LI", kind: "LinkedIn", title: "Post on the AI exercise", h: 0, what: "One note on what the analysis showed and what needed human checks.", out: "Post published." },
    ] },
  { n: 4, title: "OpEx, change and synthesis", goal: "Turn your lean experience into an operating system for a high-mix, low-volume defense plant, package it as a 30-60-90 plan, and rehearse it.",
    check: "Present your 90-day plan in 10 minutes, with numbers, risks and the first three decisions you would ask the CEO to make.",
    sessions: [
      { id: "w4a", code: "A", kind: "Learn", title: "OpEx for high-mix, low-volume", h: 2, what: "Factory Physics, Theory of Constraints, Hoshin Kanri, Toyota Kata, MIT Lean Advancement Initiative case studies.", out: "Operating-system sketch: tiered meetings, bottlenecks, WIP rules, KPI tree." },
      { id: "w4b", code: "B", kind: "Learn", title: "Leading significant change", h: 2, what: "Kotter's Leading Change and Watkins' The First 90 Days. Map both to your VPG restructure and SolarEdge greenfield sites.", out: "Before-and-after story from your career, with numbers." },
      { id: "w4c", code: "C", kind: "Deep dive", title: "Your 30-60-90 plan", h: 2.5, what: "Combine weeks 1 to 3 for company X: diagnose, stabilise, launch. Add risks and what you would stop doing.", out: "Two-page plan and a one-slide KPI tree." },
      { id: "w4d", code: "D", kind: "Apply", title: "Mock interviews", h: 2, what: "Five prompts with Claude as a CEO, a board member and a skeptical head of engineering. Record yourself and tighten.", out: "Five two-minute answers and a list of weak spots." },
      { id: "w4e", code: "E", kind: "Review", title: "Final log", h: 0.5, what: "Top five open gaps and a three-month follow-up learning list.", out: "Next-steps list." },
      { id: "w4l", code: "LI", kind: "LinkedIn", title: "Final profile pass", h: 0, what: "Match headline, About and Featured to your 30-60-90 story. Decide on Open to work.", out: "Profile final." },
    ] },
];

export const ALL_SESSIONS = [];
WEEKS.forEach((w) => w.sessions.forEach((s) => ALL_SESSIONS.push({ ...s, week: w.n })));
export const PLANNED_TOTAL = ALL_SESSIONS.reduce((a, s) => a + s.h, 0);

// LinkedIn actions carry no plan hours, but the calendar slot still needs a length.
export function slotHours(s) { return s.h > 0 ? s.h : 0.5; }
// Title used for the calendar task, so a slot is recognisable in the other views.
export function slotTitle(s) { return `${s.kind} W${s.week}·${s.code} — ${s.title}`; }
export const LEARNING_SEGMENT = "career";
