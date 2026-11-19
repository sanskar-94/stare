/**
 * Parse an API timestamp. The server sends UTC with a zone ("...Z"); an older build sent naive UTC strings,
 * which browsers read as local time (5.5 hours off in India), so a string without a zone is taken as UTC.
 */
export function parseTs(s?: string | null): Date | null {
  if (!s) return null;
  const iso = /[zZ]|[+-]\d\d:?\d\d$/.test(s) || !/^\d{4}-\d\d-\d\dT/.test(s) ? s : `${s}Z`;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}
export function tsMs(s?: string | null): number | null {
  return parseTs(s)?.getTime() ?? null;
}
export function fmtDate(s?: string | null): string {
  if (!s) return "";
  const d = parseTs(s);
  return d ? d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : s;
}
export function fmtDay(s?: string | null): string {
  if (!s) return "";
  const d = parseTs(s);
  return d ? d.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" }) : s;
}
export function fmtTime(s?: string | null): string {
  if (!s) return "";
  const d = parseTs(s);
  return d ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : s;
}
export function fmtAgo(s?: string | null, now = Date.now()): string {
  const t = tsMs(s);
  if (t == null) return "";
  const sec = Math.max(0, Math.round((now - t) / 1000));
  if (sec < 60) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  return fmtDay(s);
}
export function fmtSecs(ms?: number | null): string {
  if (ms == null) return "";
  return `${(ms / 1000).toFixed(1)} s`;
}
export const STATUTE_LABEL: Record<string, string> = { title_vii: "Title VII", ada: "ADA", adea: "ADEA" };
export function claimLabel(c: { statute?: string; theory?: string }): string {
  const s = STATUTE_LABEL[c.statute ?? ""] ?? c.statute ?? "";
  const t = (c.theory ?? "").replace(/_/g, " ");
  return [s, t].filter(Boolean).join(" ");
}
const PH = /(\[[A-Z][A-Z_]*(?:_\d+)?\])/g;
export function splitPlaceholders(text: string): { t: string; ph: boolean }[] {
  return text.split(PH).filter((x) => x !== "").map((t) => ({ t, ph: /^\[[A-Z][A-Z_]*(?:_\d+)?\]$/.test(t) }));
}
export function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
export function initials(name?: string | null): string {
  return (name ?? "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";
}
