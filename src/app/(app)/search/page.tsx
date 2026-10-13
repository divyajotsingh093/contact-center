import { redirect } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon } from "@hugeicons/core-free-icons";
import { currentActor } from "@/ccms/session";
import { searchCases } from "@/ccms/queries";
import { CaseTable } from "@/components/ccms/case-table";

export const dynamic = "force-dynamic";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const actor = await currentActor();
  if (!actor) redirect("/login");
  const q = ((await searchParams).q ?? "").trim();
  const rows = q ? await searchCases(actor, q) : [];
  return (
    <div className="flex flex-col gap-4 px-6 py-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Search</h1>
        <p className="text-sm text-muted-foreground">
          {q ? (
            <>
              <span className="tabular">{rows.length}</span> result{rows.length === 1 ? "" : "s"} for &ldquo;{q}&rdquo;, open and closed
            </>
          ) : (
            "Search by case number, subject, customer, policy or claim number from the bar above."
          )}
        </p>
      </div>
      {q && rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-black/10 bg-card px-6 py-16 text-center dark:border-white/15">
          <HugeiconsIcon icon={Search01Icon} size={22} className="text-muted-foreground" aria-hidden />
          <p className="text-sm font-medium">No cases found</p>
          <p className="text-sm text-muted-foreground">Check the number, or try the customer&apos;s name or policy number.</p>
        </div>
      ) : rows.length > 0 ? (
        <CaseTable rows={rows} />
      ) : null}
    </div>
  );
}
