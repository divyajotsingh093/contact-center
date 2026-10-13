import { HugeiconsIcon } from "@hugeicons/react";
import { Alert02Icon, Clock01Icon, EyeIcon, Flag02Icon, LockIcon, Shield01Icon, StarIcon } from "@hugeicons/core-free-icons";
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
      <HugeiconsIcon icon={Clock01Icon} aria-hidden />
      {s.label}
      {showTime && <span className="tabular opacity-80">· {formatDuration(remainingMs!)}</span>}
    </Badge>
  );
}

const NATURE_VARIANT: Record<string, "danger" | "info" | "secondary" | "warning"> = {
  complaint: "danger",
  appeal: "warning",
  enquiry: "info",
  feedback: "secondary",
};

export function NatureBadge({ nature }: { nature: string | null }) {
  return <Badge variant={NATURE_VARIANT[nature ?? ""] ?? "secondary"}>{titleCase(nature ?? "unassessed")}</Badge>;
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
        <Badge variant="danger">
          <HugeiconsIcon icon={Flag02Icon} aria-hidden />
          Significant
        </Badge>
      )}
      {c.vulnerable && (
        <Badge variant="info">
          <HugeiconsIcon icon={Shield01Icon} aria-hidden />
          Vulnerable
        </Badge>
      )}
      {c.vip && (
        <Badge variant="brand">
          <HugeiconsIcon icon={StarIcon} aria-hidden />
          VVIP
        </Badge>
      )}
      {c.confidential && (
        <Badge variant="outline">
          <HugeiconsIcon icon={LockIcon} aria-hidden />
          Confidential
        </Badge>
      )}
      {c.fidrec && <Badge variant="warning">FIDREC</Badge>}
      {c.regulatoryFlag && c.regulatoryFlag !== "none" && (
        <Badge variant="warning">
          <HugeiconsIcon icon={Alert02Icon} aria-hidden />
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
      <HugeiconsIcon icon={EyeIcon} aria-hidden />
      Masked
    </Badge>
  );
}

export function SourceBadge({ source }: { source: string }) {
  const label = source === "kamios" ? "Kamios" : source === "reels" ? "Reels" : "Local fallback";
  const variant = source === "local" ? "outline" : "brand";
  return (
    <Badge variant={variant} title={source === "local" ? "Computed by the local stand-in until the platform is connected" : undefined}>
      {label}
    </Badge>
  );
}
