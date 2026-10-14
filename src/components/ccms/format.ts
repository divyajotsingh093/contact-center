export function formatDuration(ms: number): string {
  const abs = Math.abs(ms);
  const m = Math.round(abs / 60_000);
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  const mm = m % 60;
  const s = d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${mm}m` : `${mm}m`;
  return ms < 0 ? `${s} over` : s;
}

const SGT = "Asia/Singapore";

export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-SG", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: SGT });
}

/** Day and month only, for dense lists. */
export function formatDay(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-SG", { day: "2-digit", month: "short", timeZone: SGT });
}

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-SG", { day: "2-digit", month: "short", year: "numeric", timeZone: SGT });
}

export function titleCase(s: string | null | undefined): string {
  if (!s) return "—";
  return s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}
