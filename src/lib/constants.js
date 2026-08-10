export const SEGMENTS = [
  { id: "family", name: "Family", color: "#B5574B" },
  { id: "career", name: "Career Search", color: "#2E5395" },
  { id: "ai", name: "AI Learning", color: "#6B4FA0" },
  { id: "income", name: "Passive Income", color: "#2F855A" },
  { id: "other", name: "Others", color: "#6B7280" },
];

export const PRIORITIES = ["High", "Medium", "Low"];

export const STATUSES = ["Not Started", "In Progress", "On Hold", "Done"];

// Badge colors per status (bg + text), reused by StatusBadge and pills.
export const STATUS_STYLES = {
  "Not Started": { bg: "#F0EEE9", color: "#6B7280", dot: "#9CA3AF" },
  "In Progress": { bg: "#EAF2FE", color: "#1E4B8F", dot: "#2E5395" },
  "On Hold": { bg: "#FFF4E0", color: "#8A5A00", dot: "#C08A2E" },
  Done: { bg: "#E7F4EC", color: "#2F855A", dot: "#2F855A" },
};

export function statusStyle(s) {
  return STATUS_STYLES[s] || STATUS_STYLES["Not Started"];
}

export const NAVY = "#1F3864";
export const BG = "#F6F4F0";
export const INK = "#22303F";
export const MUTED = "#667085";
export const BORDER = "#E2DFD8";

export function segColor(id) {
  return (SEGMENTS.find((s) => s.id === id) || {}).color || "#6B7280";
}
export function segName(id) {
  return (SEGMENTS.find((s) => s.id === id) || {}).name || id;
}
