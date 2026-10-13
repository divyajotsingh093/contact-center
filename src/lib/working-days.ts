/**
 * Working-day arithmetic for SLAs ("2 working days" acknowledgement).
 * Weekends are Saturday and Sunday; public holidays come from settings.
 */

export const SG_PUBLIC_HOLIDAYS_2026 = [
  "2026-01-01",
  "2026-02-17",
  "2026-02-18",
  "2026-03-21",
  "2026-04-03",
  "2026-05-01",
  "2026-05-27",
  "2026-05-31",
  "2026-06-01",
  "2026-08-09",
  "2026-08-10",
  "2026-11-08",
  "2026-11-09",
  "2026-12-25",
];

function ymd(d: Date): string {
  // Singapore time (UTC+8, no DST) decides which calendar day it is.
  return new Date(d.getTime() + 8 * 3600_000).toISOString().slice(0, 10);
}

export function isWorkingDay(d: Date, holidays: string[] = SG_PUBLIC_HOLIDAYS_2026): boolean {
  const day = new Date(d.getTime() + 8 * 3600_000).getUTCDay();
  return day !== 0 && day !== 6 && !holidays.includes(ymd(d));
}

/**
 * Adds whole working days, keeping the time of day. Starting on a non-working
 * day counts from the next working day (a Saturday email is due as if received Monday).
 */
export function addWorkingDays(start: Date, days: number, holidays: string[] = SG_PUBLIC_HOLIDAYS_2026): Date {
  const DAY = 86_400_000;
  let d = new Date(start);
  while (!isWorkingDay(d, holidays)) d = new Date(d.getTime() + DAY);
  let added = 0;
  while (added < days) {
    d = new Date(d.getTime() + DAY);
    if (isWorkingDay(d, holidays)) added++;
  }
  return d;
}
