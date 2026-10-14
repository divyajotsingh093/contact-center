import { Icon } from "@/components/ccms/icons";
import { Alert02Icon, Clock01Icon, EyeIcon, Flag02Icon, LockIcon, Shield01Icon, StarIcon } from "@/components/ccms/icons";
import { Badge } from "@/components/ui/badge";
import type { ClockHealth } from "@/ccms/sla";
import { formatDuration, titleCase } from "./format";

const SLA_STYLE: Record<ClockHealth, { variant: "danger" | "warning" | "success" | "secondary" | "info"; label: string }> = {
  breached: { variant: "danger", label: "Breached" },
  near_breach: { variant: "warning", label: "Near breach" },
  on_track: { variant: "success", label: "On track" },
  paused: { variant: "info", label: "Paused" },
  met: { variant: "secondary", label: "Met" },
  missed: { variant: "danger", label: "Missed" },
  cancelled: { variant: "secondary", label: "Cancelled" },
};

export function SlaBadge({ health, remainingMs, kind }: { health: ClockHealth; remainingMs?: number; kind?: string }) {
  const s = SLA_STYLE[health];
  const showTime = remainingMs !== undefined && (health === "on_track" || health === "near_breach" || health === "breached");
  return (
    <Badge variant={s.variant} title={kind ? `${titleCase(kind)} SLA` : undefined}>
      <Icon icon={Clock01Icon} aria-hidden />
      {s.label}
      {showTime && <span className="tabular opacity-80">· {formatDuration(remainingMs!)}</span>}
    </Badge>
  );
}

export function NatureBadge({ nature }: { nature: string | null }) {
  return <Badge variant="outline">{titleCase(nature ?? "unassessed")}</Badge>;
}

export function PriorityBadge({ priority }: { priority: string }) {
  const variant = priority === "P1" ? "danger" : priority === "P2" ? "warning" : "outline";
  return (
    <Badge variant={variant} className="tabular">
      {priority}
    </Badge>
  );
}

/** Flags called out in the inbox: significant, vulnerable, confidential, VVIP, FIDREC, regulator. */
export function CaseFlags({
  c,
}: {
  c: { significant: boolean; vulnerable: boolean; confidential: boolean; vip: boolean; fidrec: boolean; regulatoryFlag: string | null; reopened?: boolean };
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {c.significant && (
        <Badge variant="outline">
          <Icon icon={Flag02Icon} className="text-destructive" aria-hidden />
          Significant
        </Badge>
      )}
      {c.vulnerable && (
        <Badge variant="outline">
          <Icon icon={Shield01Icon} aria-hidden />
          Vulnerable
        </Badge>
      )}
      {c.vip && (
        <Badge variant="outline">
          <Icon icon={StarIcon} aria-hidden />
          VVIP
        </Badge>
      )}
      {c.confidential && (
        <Badge variant="outline">
          <Icon icon={LockIcon} aria-hidden />
          Confidential
        </Badge>
      )}
      {c.fidrec && <Badge variant="outline">FIDREC</Badge>}
      {c.regulatoryFlag && c.regulatoryFlag !== "none" && (
        <Badge variant="outline">
          <Icon icon={Alert02Icon} aria-hidden />
          {c.regulatoryFlag}
        </Badge>
      )}
      {c.reopened && <Badge variant="outline">Re-opened</Badge>}
    </div>
  );
}

export function MaskedNotice() {
  return (
    <Badge variant="outline" className="text-muted-foreground">
      <Icon icon={EyeIcon} aria-hidden />
      Masked
    </Badge>
  );
}

export function SourceBadge({ source }: { source: string }) {
  const label = source === "kamios" ? "Kamios" : source === "reels" ? "Reels" : "Local fallback";
  return (
    <Badge variant={source === "local" ? "outline" : "secondary"} title={source === "local" ? "Computed by the local stand-in until the platform is connected" : undefined}>
      {label}
    </Badge>
  );
}
