import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert02Icon, EyeIcon, Flag02Icon, LockIcon, Shield01Icon, StarIcon } from "@hugeicons/core-free-icons";
import { SOURCE_LABELS, STAGE_LABELS, type Source, type Stage } from "@/ccms/constants";
import type { SlaView } from "@/ccms/queries";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Person } from "./avatar";
import { NatureBadge } from "./badges";
import { formatDateTime } from "./format";
import { SlaMeter, STATUS } from "./sla-meter";

export interface CaseRow {
  id: string;
  number: string;
  subject: string;
  source: string;
  complainantName: string | null;
  nature: string | null;
  priority: string;
  stage: string;
  status: string;
  significant: boolean;
  vulnerable: boolean;
  confidential: boolean;
  vip: boolean;
  fidrec: boolean;
  regulatoryFlag: string | null;
  receivedAt: Date;
  caseManager: { name: string } | null;
  team: { name: string } | null;
  masked: boolean;
  sla: SlaView | null;
}

const PRIORITY: Record<string, { color: string; label: string }> = {
  P1: { color: STATUS.critical, label: "Critical" },
  P2: { color: STATUS.serious, label: "High" },
  P3: { color: STATUS.warning, label: "Moderate" },
  P4: { color: "#898781", label: "Low" },
};

export function PriorityCell({ priority }: { priority: string }) {
  const p = PRIORITY[priority] ?? PRIORITY.P4;
  return (
    <span className="flex items-center gap-1.5 text-[13px] whitespace-nowrap">
      <span className="size-2 rounded-full" style={{ backgroundColor: p.color }} aria-hidden />
      <span className="tabular font-medium">{priority}</span>
      <span className="text-muted-foreground">{p.label}</span>
    </span>
  );
}

function FlagIcons({ r }: { r: CaseRow }) {
  const flags = [
    r.significant && { icon: Flag02Icon, label: "Significant", color: STATUS.critical },
    r.vulnerable && { icon: Shield01Icon, label: "Vulnerable customer", color: "#2a78d6" },
    r.vip && { icon: StarIcon, label: "VVIP", color: "#c98500" },
    r.confidential && { icon: LockIcon, label: "Confidential", color: undefined },
    r.regulatoryFlag && r.regulatoryFlag !== "none" && { icon: Alert02Icon, label: `Regulatory: ${r.regulatoryFlag}`, color: STATUS.serious },
    r.masked && { icon: EyeIcon, label: "Details masked for your role", color: undefined },
  ].filter(Boolean) as { icon: typeof Flag02Icon; label: string; color?: string }[];
  return (
    <span className="flex items-center gap-1">
      {flags.map((f) => (
        <span key={f.label} title={f.label} className="grid size-6 place-items-center rounded-md bg-muted/70">
          <HugeiconsIcon icon={f.icon} size={13} color={f.color} className={f.color ? undefined : "text-muted-foreground"} aria-label={f.label} />
        </span>
      ))}
      {r.fidrec && (
        <span title="FIDREC" className="rounded-md bg-muted/70 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
          FIDREC
        </span>
      )}
    </span>
  );
}

export function CaseTable({ rows }: { rows: CaseRow[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-black/[0.08] bg-card shadow-xs dark:border-white/10">
      <Table>
        <TableHeader className="bg-muted/40">
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[34%]">Case</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Nature</TableHead>
            <TableHead>Stage</TableHead>
            <TableHead className="w-44">SLA</TableHead>
            <TableHead>Assigned to</TableHead>
            <TableHead>Flags</TableHead>
            <TableHead>Received</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((c) => (
            <TableRow key={c.id} className="relative">
              <TableCell className="max-w-0">
                <Link
                  href={`/cases/${c.number}`}
                  className="flex min-w-0 flex-col gap-0.5 outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-inset"
                >
                  <span className="tabular text-xs text-muted-foreground">{c.number}</span>
                  <span className="truncate text-[13px] font-medium">{c.subject}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {SOURCE_LABELS[c.source as Source] ?? c.source}
                    {c.complainantName ? ` · ${c.complainantName}` : ""}
                  </span>
                </Link>
              </TableCell>
              <TableCell>
                <PriorityCell priority={c.priority} />
              </TableCell>
              <TableCell>
                <NatureBadge nature={c.nature} />
              </TableCell>
              <TableCell className="text-[13px] whitespace-nowrap">{c.status === "closed" ? "Closed" : (STAGE_LABELS[c.stage as Stage] ?? c.stage)}</TableCell>
              <TableCell>{c.sla ? <SlaMeter health={c.sla.health} percent={c.sla.percent} remainingMs={c.sla.remainingMs} compact /> : "—"}</TableCell>
              <TableCell>
                <Person name={c.caseManager?.name} sub={c.team?.name} size="xs" />
              </TableCell>
              <TableCell>
                <FlagIcons r={c} />
              </TableCell>
              <TableCell className="tabular text-xs whitespace-nowrap text-muted-foreground">{formatDateTime(c.receivedAt)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
