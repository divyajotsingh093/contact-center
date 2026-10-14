import { redirect } from "next/navigation";
import { Icon } from "@/components/ccms/icons";
import { Search01Icon } from "@/components/ccms/icons";
import { currentActor } from "@/ccms/session";
import { searchCases } from "@/ccms/queries";
import { CaseTable } from "@/components/ccms/case-table";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

export const dynamic = "force-dynamic";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const actor = await currentActor();
  if (!actor) redirect("/login");
  const q = ((await searchParams).q ?? "").trim();
  const rows = q ? await searchCases(actor, q) : [];
  return (
    <div className="flex flex-col gap-3 px-6 py-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold">Search</h1>
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
        <Empty className="py-20">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Icon icon={Search01Icon} />
            </EmptyMedia>
            <EmptyTitle>No cases found</EmptyTitle>
            <EmptyDescription>Check the number, or try the customer&apos;s name, policy or claim number.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : rows.length > 0 ? (
        <div className="-mx-6">
          <CaseTable rows={rows} />
        </div>
      ) : null}
    </div>
  );
}
