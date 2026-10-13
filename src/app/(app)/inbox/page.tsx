import Link from "next/link";
import { redirect } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { FileAddIcon, InboxIcon, Search01Icon } from "@hugeicons/core-free-icons";
import { currentActor } from "@/ccms/session";
import { INBOX_FILTERS, listInbox, matchesText, type InboxFilter, type InboxScope } from "@/ccms/queries";
import { Button } from "@/components/ui/button";
import { CaseTable } from "@/components/ccms/case-table";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const SCOPES: { key: InboxScope; label: string; roles: string[] }[] = [
  { key: "mine", label: "Assigned to me", roles: ["case_manager"] },
  { key: "team", label: "My teams", roles: ["team_lead"] },
  { key: "significant", label: "Significant", roles: ["ce_team", "head_of_ce"] },
  { key: "all", label: "All open", roles: ["admin", "head_of_ce", "ce_team", "team_lead", "case_manager"] },
];

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ scope?: string; filter?: string; q?: string }> }) {
  const actor = await currentActor();
  if (!actor) redirect("/login");
  const sp = await searchParams;
  const available = SCOPES.filter((s) => actor.roles.includes("admin") || s.roles.some((r) => actor.roles.includes(r)));
  const scope = available.find((s) => s.key === sp.scope)?.key ?? available[0]?.key ?? "mine";
  const filter: InboxFilter = sp.filter && sp.filter in INBOX_FILTERS ? (sp.filter as InboxFilter) : "all";
  const q = sp.q ?? "";

  const all = await listInbox(actor, scope);
  const searched = all.filter((r) => matchesText(r, q));
  const rows = searched.filter((r) => INBOX_FILTERS[filter].test(r));
  const href = (over: Record<string, string>) => {
    const p = new URLSearchParams({ scope, ...(filter !== "all" ? { filter } : {}), ...(q ? { q } : {}), ...over });
    if (p.get("filter") === "all") p.delete("filter");
    return `/inbox?${p}`;
  };

  return (
    <div className="flex flex-col gap-4 px-6 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">My cases</h1>
          <p className="text-sm text-muted-foreground">Sorted by SLA risk: breached first, then the least time left.</p>
        </div>
        <Button asChild size="sm">
          <Link href="/intake">
            <HugeiconsIcon icon={FileAddIcon} aria-hidden />
            Log a case
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/[0.08] dark:border-white/10">
        <nav aria-label="Inbox scope" className="flex gap-1">
          {available.map((s) => (
            <Link
              key={s.key}
              href={`/inbox?scope=${s.key}`}
              aria-current={s.key === scope ? "page" : undefined}
              className={cn(
                "-mb-px border-b-2 px-2.5 pb-2.5 text-[13px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring",
                s.key === scope ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {s.label}
            </Link>
          ))}
        </nav>
        <form className="mb-2 flex items-center" role="search" action="/inbox">
          <input type="hidden" name="scope" value={scope} />
          {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
          <label htmlFor="list-q" className="sr-only">
            Filter this list
          </label>
          <div className="relative">
            <HugeiconsIcon icon={Search01Icon} size={14} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              id="list-q"
              name="q"
              defaultValue={q}
              placeholder="Filter by number, subject, customer…"
              className="h-8 w-72 rounded-md border border-input bg-card pr-3 pl-8 text-[13px] shadow-xs outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </form>
      </div>

      <div className="flex flex-wrap gap-1.5" aria-label="Quick filters">
        {(Object.keys(INBOX_FILTERS) as InboxFilter[]).map((f) => {
          const n = searched.filter((r) => INBOX_FILTERS[f].test(r)).length;
          const active = f === filter;
          return (
            <Link
              key={f}
              href={href({ filter: f })}
              aria-current={active ? "true" : undefined}
              className={cn(
                "pressable flex h-7 items-center gap-1.5 rounded-full border px-3 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "border-foreground bg-foreground text-background"
                  : "border-black/[0.1] bg-card text-foreground hover:border-black/20 dark:border-white/15",
              )}
            >
              {INBOX_FILTERS[f].label}
              <span className={cn("tabular", active ? "text-background/70" : "text-muted-foreground")}>{n}</span>
            </Link>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-black/10 bg-card px-6 py-16 text-center dark:border-white/15">
          <HugeiconsIcon icon={InboxIcon} size={24} className="text-muted-foreground" aria-hidden />
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">{all.length ? "No cases match these filters" : "No open cases here"}</p>
            <p className="text-sm text-muted-foreground">{all.length ? "Clear the filter to see everything in this view." : "New cases appear as soon as intake allocates them."}</p>
          </div>
          {all.length ? (
            <Button asChild size="sm" variant="outline">
              <Link href={`/inbox?scope=${scope}`}>Clear filters</Link>
            </Button>
          ) : (
            <Button asChild size="sm">
              <Link href="/intake">Log a case</Link>
            </Button>
          )}
        </div>
      ) : (
        <>
          <CaseTable rows={rows} />
          <p className="text-xs text-muted-foreground">
            Showing <span className="tabular">{rows.length}</span> of <span className="tabular">{all.length}</span> cases in this view
          </p>
        </>
      )}
    </div>
  );
}
