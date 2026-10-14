import Link from "next/link";
import { redirect } from "next/navigation";
import { Icon } from "@/components/ccms/icons";
import { Cancel01Icon, InboxIcon, Search01Icon } from "@/components/ccms/icons";
import { currentActor } from "@/ccms/session";
import { INBOX_FILTERS, listInbox, matchesText, type InboxFilter, type InboxScope } from "@/ccms/queries";
import { Button } from "@/components/ui/button";
import { CaseTable, SORT_KEYS, sortRows, type SortDir, type SortKey } from "@/components/ccms/case-table";
import { cn } from "@/lib/utils";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

export const dynamic = "force-dynamic";

const SCOPES: { key: InboxScope; label: string; roles: string[] }[] = [
  { key: "mine", label: "Assigned to me", roles: ["case_manager"] },
  { key: "team", label: "My teams", roles: ["team_lead"] },
  { key: "significant", label: "Significant", roles: ["ce_team", "head_of_ce"] },
  { key: "all", label: "All open", roles: ["admin", "head_of_ce", "ce_team", "team_lead", "case_manager"] },
];

const listItem = (active: boolean) =>
  cn(
    "flex h-7 items-center gap-1.5 rounded-md px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
    active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/70 hover:text-foreground",
  );

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ scope?: string; filter?: string; q?: string; sort?: string; dir?: string }> }) {
  const actor = await currentActor();
  if (!actor) redirect("/login");
  const sp = await searchParams;
  const available = SCOPES.filter((s) => actor.roles.includes("admin") || s.roles.some((r) => actor.roles.includes(r)));
  const scope = available.find((s) => s.key === sp.scope)?.key ?? available[0]?.key ?? "mine";
    const filter: InboxFilter = sp.filter && sp.filter in INBOX_FILTERS ? (sp.filter as InboxFilter) : "all";
  const q = sp.q ?? "";
  const sortKey: SortKey = SORT_KEYS.includes(sp.sort as SortKey) ? (sp.sort as SortKey) : "sla";
  const sortDir: SortDir = sp.dir === "desc" ? "desc" : "asc";

  const all = await listInbox(actor, scope);
  const searched = all.filter((r) => matchesText(r, q));
  const rows = sortRows(
    searched.filter((r) => INBOX_FILTERS[filter].test(r)),
    sortKey,
    sortDir,
  );

  /** Current view with overrides; an empty string drops that parameter. */
  const href = (over: Record<string, string>) => {
    const p = new URLSearchParams({ scope, filter, q, sort: sortKey, dir: sortDir, ...over });
    if (p.get("filter") === "all") p.delete("filter");
    if (!p.get("q")) p.delete("q");
    if (p.get("sort") === "sla" && p.get("dir") === "asc") p.delete("sort");
    if (p.get("dir") === "asc") p.delete("dir");
    return `/inbox?${p}`;
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <section className="flex min-w-0 flex-1 flex-col gap-3 px-6 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-baseline gap-2">
            <h1 className="text-lg font-semibold">Cases</h1>
            <p className="text-xs text-muted-foreground">
              <span className="tabular">{rows.length}</span> of <span className="tabular">{all.length}</span>
              {sortKey === "sla" && sortDir === "asc" ? ", most urgent SLA first" : ""}
            </p>
          </div>
          <form className="flex items-center" role="search" action="/inbox">
            <input type="hidden" name="scope" value={scope} />
            {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
            <label htmlFor="list-q" className="sr-only">
              Search this list
            </label>
            <div className="relative">
              <Icon icon={Search01Icon} size={14} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <input
                id="list-q"
                name="q"
                defaultValue={q}
                placeholder="Search this list"
                className="h-[30px] w-60 rounded-md border border-input bg-card pr-3 pl-8 text-sm shadow-control outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </form>
        </div>

        <nav aria-label="Lists" className="flex gap-4 border-b">
          {available.map((s) => (
            <Link
              key={s.key}
              href={`/inbox?scope=${s.key}`}
              aria-current={s.key === scope ? "page" : undefined}
              className={cn(
                "-mb-px border-b-2 pb-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
                s.key === scope ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {s.label}
            </Link>
          ))}
        </nav>

        <div className="flex flex-wrap items-center gap-1" aria-label="Filter by">
          {(Object.keys(INBOX_FILTERS) as InboxFilter[]).map((f) => (
            <Link key={f} href={href({ filter: f })} aria-current={f === filter ? "true" : undefined} className={listItem(f === filter)}>
              {INBOX_FILTERS[f].label}
              <span className="tabular text-xs text-muted-foreground">{searched.filter((r) => INBOX_FILTERS[f].test(r)).length}</span>
            </Link>
          ))}
          {(filter !== "all" || q) && (
            <Link href={`/inbox?scope=${scope}`} className="ml-1 flex h-7 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
              <Icon icon={Cancel01Icon} size={12} aria-hidden />
              Clear
            </Link>
          )}
        </div>

        {rows.length === 0 ? (
          <Empty className="py-20">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Icon icon={InboxIcon} />
              </EmptyMedia>
              <EmptyTitle>{all.length ? "No cases match these filters" : "No open cases here"}</EmptyTitle>
              <EmptyDescription>{all.length ? "Clear the filters to see everything in this list." : "New cases appear as soon as intake allocates them."}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              {all.length > 0 ? (
                <Button asChild size="sm" variant="outline">
                  <Link href={`/inbox?scope=${scope}`}>Clear filters</Link>
                </Button>
              ) : (
                <Button asChild size="sm">
                  <Link href="/intake">New case</Link>
                </Button>
              )}
            </EmptyContent>
          </Empty>
        ) : (
          <div className="-mx-6">
          <CaseTable rows={rows} sort={{ key: sortKey, dir: sortDir, href: (k) => href({ sort: k, dir: k === sortKey && sortDir === "asc" ? "desc" : "asc" }) }} />
          </div>
        )}
      </section>
    </div>
  );
}
