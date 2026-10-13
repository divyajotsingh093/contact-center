import Link from "next/link";
import { redirect } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { FileAddIcon, InboxIcon } from "@hugeicons/core-free-icons";
import { currentActor } from "@/ccms/session";
import { listInbox, type InboxScope } from "@/ccms/queries";
import { STAGE_LABELS, SOURCE_LABELS, type Source, type Stage } from "@/ccms/constants";
import { PageHeader } from "@/components/ccms/page-header";
import { CaseFlags, MaskedNotice, NatureBadge, PriorityBadge, SlaBadge } from "@/components/ccms/badges";
import { formatDateTime } from "@/components/ccms/format";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const SCOPES: { key: InboxScope; label: string; roles: string[] }[] = [
  { key: "mine", label: "Assigned to me", roles: ["case_manager"] },
  { key: "team", label: "My teams", roles: ["team_lead"] },
  { key: "significant", label: "Significant", roles: ["ce_team", "head_of_ce"] },
  { key: "all", label: "All open", roles: ["admin", "head_of_ce", "ce_team"] },
];

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ scope?: string }> }) {
  const actor = await currentActor();
  if (!actor) redirect("/login");
  const available = SCOPES.filter((s) => actor.roles.includes("admin") || s.roles.some((r) => actor.roles.includes(r)));
  const requested = (await searchParams).scope;
  const scope = available.find((s) => s.key === requested)?.key ?? available[0]?.key ?? "mine";
  const rows = await listInbox(actor, scope);
  const atRisk = rows.filter((r) => r.sla && (r.sla.health === "breached" || r.sla.health === "near_breach")).length;

  return (
    <>
      <PageHeader
        title="My cases"
        description={
          <>
            <span className="tabular">{rows.length}</span> open · <span className="tabular">{atRisk}</span> at SLA risk · sorted by SLA risk
          </>
        }
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href="/intake">
              <HugeiconsIcon icon={FileAddIcon} aria-hidden />
              Log a case
            </Link>
          </Button>
        }
      />
      <div className="flex flex-col gap-4 px-6 py-4">
        {available.length > 1 && (
          <div role="tablist" aria-label="Inbox scope" className="flex gap-1">
            {available.map((s) => (
              <Link
                key={s.key}
                role="tab"
                aria-selected={s.key === scope}
                href={`/inbox?scope=${s.key}`}
                className={cn(
                  "rounded-md px-2.5 py-1 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  s.key === scope ? "bg-accent font-medium" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {s.label}
              </Link>
            ))}
          </div>
        )}

        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-black/10 px-6 py-16 text-center dark:border-white/15">
            <HugeiconsIcon icon={InboxIcon} size={24} className="text-muted-foreground" aria-hidden />
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium">No open cases here</p>
              <p className="text-sm text-muted-foreground">New cases appear as soon as intake allocates them.</p>
            </div>
            <Button asChild size="sm">
              <Link href="/intake">Log a case</Link>
            </Button>
          </div>
        ) : (
          <div className="rounded-xl border border-black/[0.08] dark:border-white/10">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Case</TableHead>
                  <TableHead>Nature</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Flags</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>SLA</TableHead>
                  <TableHead>Case manager</TableHead>
                  <TableHead>Received</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((c) => (
                  <TableRow key={c.id} className="relative">
                    <TableCell className="max-w-80">
                      <Link
                        href={`/cases/${c.number}`}
                        className="flex flex-col gap-0.5 outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-ring"
                      >
                        <span className="tabular text-xs text-muted-foreground">{c.number}</span>
                        <span className="truncate font-medium">{c.subject}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          {SOURCE_LABELS[c.source as Source] ?? c.source}
                          {c.complainantName ? ` · ${c.complainantName}` : ""}
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <NatureBadge nature={c.nature} />
                    </TableCell>
                    <TableCell>
                      <PriorityBadge priority={c.priority} />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <CaseFlags c={c} />
                        {c.masked && <MaskedNotice />}
                      </div>
                    </TableCell>
                    <TableCell className="text-[13px] whitespace-nowrap">{STAGE_LABELS[c.stage as Stage] ?? c.stage}</TableCell>
                    <TableCell>{c.sla ? <SlaBadge health={c.sla.health} remainingMs={c.sla.remainingMs} kind={c.sla.kind} /> : "—"}</TableCell>
                    <TableCell className="text-[13px] whitespace-nowrap">{c.caseManager?.name ?? <span className="text-muted-foreground">Unassigned</span>}</TableCell>
                    <TableCell className="tabular text-xs whitespace-nowrap text-muted-foreground">{formatDateTime(c.receivedAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </>
  );
}
