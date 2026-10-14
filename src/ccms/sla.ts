/**
 * SLA clock maths. Pure: the service loads a SlaClock row, calls these, and saves.
 * Paused time doesn't count; re-assignment doesn't touch the clock; a re-open
 * resumes the same clock (the clock "carries on").
 */

export type ClockState = "running" | "paused" | "met" | "breached_met" | "cancelled";

export interface Clock {
  startedAt: Date;
  targetAt: Date;
  nearBreachPct: number;
  state: ClockState | string;
  pausedAt: Date | null;
  pausedMs: number;
  stoppedAt: Date | null;
  nearBreachAlertedAt: Date | null;
  breachedAt: Date | null;
}

export type ClockHealth = "on_track" | "near_breach" | "breached" | "paused" | "met" | "missed" | "cancelled";

export function pause(clock: Clock, now: Date): Clock {
  if (clock.state !== "running") return clock;
  return { ...clock, state: "paused", pausedAt: now };
}

export function resume(clock: Clock, now: Date): Clock {
  if (clock.state !== "paused" || !clock.pausedAt) return clock;
  const pausedFor = now.getTime() - clock.pausedAt.getTime();
  return {
    ...clock,
    state: "running",
    pausedAt: null,
    pausedMs: clock.pausedMs + pausedFor,
    // Paused time pushes the target out.
    targetAt: new Date(clock.targetAt.getTime() + pausedFor),
  };
}

export function stop(clock: Clock, now: Date): Clock {
  if (clock.state !== "running" && clock.state !== "paused") return clock;
  const c = clock.state === "paused" ? resume(clock, now) : clock;
  const late = now.getTime() > c.targetAt.getTime();
  return { ...c, state: late ? "breached_met" : "met", stoppedAt: now, breachedAt: c.breachedAt ?? (late ? c.targetAt : null) };
}

/** Re-open: a stopped clock starts again with its original target. */
export function reopen(clock: Clock): Clock {
  if (clock.state !== "met" && clock.state !== "breached_met") return clock;
  return { ...clock, state: "running", stoppedAt: null };
}

export function extend(clock: Clock, newTarget: Date, now: Date): Clock {
  return {
    ...clock,
    targetAt: newTarget,
    // A fresh window gets fresh alerts.
    nearBreachAlertedAt: null,
    breachedAt: newTarget.getTime() > now.getTime() ? null : clock.breachedAt,
  };
}

export function elapsedFraction(clock: Clock, now: Date): number {
  const end = clock.stoppedAt ?? (clock.state === "paused" && clock.pausedAt ? clock.pausedAt : now);
  const total = clock.targetAt.getTime() - clock.startedAt.getTime() - clock.pausedMs;
  const used = end.getTime() - clock.startedAt.getTime() - clock.pausedMs;
  return total <= 0 ? 1 : used / total;
}

export function health(clock: Clock, now: Date): ClockHealth {
  if (clock.state === "cancelled") return "cancelled";
  if (clock.state === "met") return "met";
  if (clock.state === "breached_met") return "missed";
  if (clock.state === "paused") return "paused";
  const f = elapsedFraction(clock, now);
  if (f >= 1) return "breached";
  if (f * 100 >= clock.nearBreachPct) return "near_breach";
  return "on_track";
}

export type TickAlert = "near_breach" | "breached";

/** What the scheduled tick should raise for this clock right now (each alert fires once). */
export function dueAlerts(clock: Clock, now: Date): TickAlert[] {
  if (clock.state !== "running") return [];
  const h = health(clock, now);
  const alerts: TickAlert[] = [];
  if ((h === "near_breach" || h === "breached") && !clock.nearBreachAlertedAt) alerts.push("near_breach");
  if (h === "breached" && !clock.breachedAt) alerts.push("breached");
  return alerts;
}

export function remainingMs(clock: Clock, now: Date): number {
  const end = clock.state === "paused" && clock.pausedAt ? clock.pausedAt : now;
  return clock.targetAt.getTime() - end.getTime();
}
