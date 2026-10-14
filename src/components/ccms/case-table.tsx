import Link from "next/link";
import { Icon } from "@/components/ccms/icons";
import { Alert02Icon, ArrowDown01Icon, ArrowUp01Icon, EyeIcon, Flag02Icon, LockIcon, Shield01Icon, StarIcon } from "@/components/ccms/icons";
import { SOURCE_LABELS, STAGES, STAGE_LABELS, type Source, type Stage } from "@/ccms/constants";
import type { SlaView } from "@/ccms/queries";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime, formatDay, titleCase } from "./format";
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
    <span className="flex items-center gap-1.5 text-sm whitespace-nowrap">
      <span className="size-2 rounded-full" style={{ backgroundColor: p.color }} aria-hidden />
      <span className="tabular">{priority}</span>
      <span className="text-muted-foreground">{p.label}</span>
    </span>
  );
}

function FlagIcons({ r }: { r: CaseRow }) {
  const flags = [
    r.significant && { icon: Flag02Icon, label: "Significant", color: STATUS.critical },
    r.vulnerable && { icon: Shield01Icon, label: "Vulnerable customer" },
    r.vip && { icon: StarIcon, label: "VVIP" },
    r.confidential && { icon: LockIcon, label: "Confidential" },
    r.regulatoryFlag && r.regulatoryFlag !== "none" && { icon: Alert02Icon, label: `Regulatory: ${r.regulatoryFlag}` },
    r.masked && { icon: EyeIcon, label: "Details masked for your role" },
  ].filter(Boolean) as { icon: typeof Flag02Icon; label: string; color?: string }[];
  if (!flags.length && !r.fidrec) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="flex items-center gap-1.5">
      {flags.map((f) => (
        <span key={f.label} title={f.label} className="grid place-items-center">
          <Icon icon={f.icon} size={15} color={f.color} className={f.color ? undefined : "text-muted-foreground"} aria-label={f.label} />
        </span>
      ))}
      {r.fidrec && <span className="text-[11px] font-semibold text-muted-foreground">FIDREC</span>}
    </span>
  );
}

/** Columns the list can be sorted by. "sla" is the default: breached first, then least time left. */
export const SORT_KEYS = ["number", "subject", "priority", "nature", "stage", "sla", "owner", "received"] as const;
export type SortKey = (typeof SORT_KEYS)[number];
export type SortDir = "asc" | "desc";

const text = (a: string | null | undefined, b: string | null | undefined) => (a ?? "").localeCompare(b ?? "");
const COMPARE: Record<Exclude<SortKey, "sla">, (a: CaseRow, b: CaseRow) => number> = {
  number: (a, b) => text(a.number, b.number),
  subject: (a, b) => text(a.subject, b.subject),
  priority: (a, b) => text(a.priority, b.priority),
  nature: (a, b) => text(a.nature, b.nature),
  stage: (a, b) => STAGES.indexOf(a.stage as Stage) - STAGES.indexOf(b.stage as Stage),
  owner: (a, b) => text(a.caseManager?.name, b.caseManager?.name),
  received: (a, b) => a.receivedAt.getTime() - b.receivedAt.getTime(),
};

/** Rows arrive in SLA-risk order, so "sla" only needs reversing for descending. */
export function sortRows<T extends CaseRow>(rows: T[], key: SortKey, dir: SortDir): T[] {
  if (key === "sla") return dir === "asc" ? rows : [...rows].reverse();
  const sorted = [...rows].sort(COMPARE[key]);
  return dir === "asc" ? sorted : sorted.reverse();
}

export interface TableSort {
  key: SortKey;
  dir: SortDir;
  /** Link that sorts by a column (toggling direction when it is already the sort column). */
  href: (key: SortKey) => string;
}

function Head({ k, label, sort, className }: { k: SortKey; label: string; sort?: TableSort; className?: string }) {
  if (!sort) return <TableHead className={className}>{label}</TableHead>;
  const active = sort.key === k;
  return (
    <TableHead className={className} aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}>
      <Link href={sort.href(k)} className="-mx-1 inline-flex items-center gap-1 rounded-sm px-1 py-0.5 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
        {label}
        {active && <Icon icon={sort.dir === "asc" ? ArrowUp01Icon : ArrowDown01Icon} size={12} className="text-foreground" aria-hidden />}
      </Link>
    </TableHead>
  );
}

/** Dense case grid. Pass `sort` to make the column headers sortable. */
export function CaseTable({ rows, sort }: { rows: CaseRow[]; sort?: TableSort }) {
  return (
    <div className="overflow-hidden border-y bg-card">
      <Table className="min-w-[56rem]">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <Head k="number" label="Number" sort={sort} />
            <Head k="subject" label="Subject" sort={sort} className="w-[34%] min-w-56" />
            <Head k="priority" label="Priority" sort={sort} />
            <Head k="nature" label="Nature" sort={sort} />
            <Head k="stage" label="Stage" sort={sort} />
            <Head k="sla" label="SLA" sort={sort} className="w-32" />
            <Head k="owner" label="Assigned to" sort={sort} />
            <TableHead>Flags</TableHead>
            <Head k="received" label="Received" sort={sort} />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((c) => (
            <TableRow key={c.id} className="relative">
              <TableCell className="whitespace-nowrap">
                <Link
                  href={`/cases/${c.number}`}
                  className="tabular text-sm text-muted-foreground outline-none after:absolute after:inset-0 hover:text-foreground focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-inset"
                >
                  {c.number}
                </Link>
              </TableCell>
              <TableCell className="max-w-0">
                <span className="block truncate font-medium text-foreground" title={c.subject}>
                  {c.subject}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {c.complainantName ? `${c.complainantName} · ` : ""}
                  {SOURCE_LABELS[c.source as Source] ?? c.source}
                </span>
              </TableCell>
              <TableCell>
                <PriorityCell priority={c.priority} />
              </TableCell>
              <TableCell className="whitespace-nowrap">{titleCase(c.nature ?? "unassessed")}</TableCell>
              <TableCell className="whitespace-nowrap">{c.status === "closed" ? "Closed" : (STAGE_LABELS[c.stage as Stage] ?? c.stage)}</TableCell>
              <TableCell>{c.sla ? <SlaMeter health={c.sla.health} percent={c.sla.percent} remainingMs={c.sla.remainingMs} compact /> : <span className="text-muted-foreground">—</span>}</TableCell>
              <TableCell className="whitespace-nowrap">
                {c.caseManager?.name ?? <span className="text-muted-foreground">Unassigned</span>}
              </TableCell>
              <TableCell>
                <FlagIcons r={c} />
              </TableCell>
              <TableCell className="tabular text-xs whitespace-nowrap text-muted-foreground" title={formatDateTime(c.receivedAt)}>
                {formatDay(c.receivedAt)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
