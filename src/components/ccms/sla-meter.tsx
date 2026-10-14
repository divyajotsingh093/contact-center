import { Icon } from "@/components/ccms/icons";
import { Alert02Icon, CheckmarkCircle02Icon, Clock01Icon, PauseIcon } from "@/components/ccms/icons";
import type { ClockHealth } from "@/ccms/sla";
import { cn } from "@/lib/utils";
import { formatDuration } from "./format";

/** Status palette (fixed): good / warning / serious / critical, always with an icon and label. */
export const STATUS = {
  good: "#0ca30c",
  warning: "#fab219",
  serious: "#ec835a",
  critical: "#d03b3b",
} as const;

const META: Record<ClockHealth, { color: string; label: string; icon: typeof Clock01Icon }> = {
  on_track: { color: STATUS.good, label: "On track", icon: Clock01Icon },
  near_breach: { color: STATUS.warning, label: "Near breach", icon: Alert02Icon },
  breached: { color: STATUS.critical, label: "Breached", icon: Alert02Icon },
  paused: { color: "#898781", label: "Paused", icon: PauseIcon },
  met: { color: STATUS.good, label: "Met", icon: CheckmarkCircle02Icon },
  missed: { color: STATUS.critical, label: "Met late", icon: CheckmarkCircle02Icon },
  cancelled: { color: "#898781", label: "Cancelled", icon: Clock01Icon },
};

export function slaMeta(h: ClockHealth) {
  return META[h];
}

/**
 * SLA meter: a thin track showing elapsed share of the window, status icon +
 * label, and time left. Colour never carries the state alone.
 */
export function SlaMeter({
  health,
  percent,
  remainingMs,
  compact,
  className,
}: {
  health: ClockHealth;
  percent: number;
  remainingMs: number;
  compact?: boolean;
  className?: string;
}) {
  const m = META[health];
  const live = health === "on_track" || health === "near_breach" || health === "breached";
  const pct = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)} title={`${m.label}${live ? ` · ${formatDuration(remainingMs)}` : ""}`}>
      <div className="flex items-center gap-1.5 text-xs whitespace-nowrap">
        <Icon icon={m.icon} size={13} color={m.color} className="shrink-0" aria-hidden />
        <span className="font-medium">{m.label}</span>
        {live && (
          <span className="tabular ml-auto truncate text-muted-foreground">
            {remainingMs < 0 || compact ? formatDuration(remainingMs) : `${formatDuration(remainingMs)} left`}
          </span>
        )}
      </div>
      {!compact || live ? (
        <div className="h-1 w-full overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/10" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={`${pct}% of SLA used`}>
          <div className="h-full rounded-full" style={{ width: `${live ? pct : 100}%`, backgroundColor: m.color }} />
        </div>
      ) : null}
    </div>
  );
}
