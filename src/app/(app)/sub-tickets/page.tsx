import Link from "next/link";
import { redirect } from "next/navigation";
import { currentActor } from "@/ccms/session";
import { listSubTickets } from "@/ccms/services/subtickets";
import { Icon, Task01Icon } from "@/components/ccms/icons";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PriorityCell } from "@/components/ccms/case-table";
import { formatDateTime } from "@/components/ccms/format";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; variant: "warning" | "success" | "outline" }> = {
  open: { label: "Waiting on BU", variant: "warning" },
  re_requested: { label: "Re-requested", variant: "warning" },
  responded: { label: "Responded", variant: "success" },
  closed: { label: "Closed", variant: "outline" },
};

export default async function SubTicketsPage() {
  const actor = await currentActor();
  if (!actor) redirect("/login");
  const rows = await listSubTickets(actor);
  const bu = actor.roles.includes("bu_staff");
  const now = new Date();
  const waiting = rows.filter((r) => r.status === "open" || r.status === "re_requested").length;

  return (
    <div className="flex flex-col gap-3 px-6 py-5">
      <div className="flex items-baseline gap-2">
        <h1 className="text-lg font-semibold">Sub-tickets</h1>
        <p className="text-xs text-muted-foreground">
          {bu ? (
            <>
              <span className="tabular">{waiting}</span> waiting for your BU&apos;s answer
            </>
          ) : (
            <>
              <span className="tabular">{rows.length}</span> on your cases, <span className="tabular">{waiting}</span> waiting on a BU
            </>
          )}
        </p>
      </div>

      {rows.length === 0 ? (
        <Empty className="py-20">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Icon icon={Task01Icon} />
            </EmptyMedia>
            <EmptyTitle>No sub-tickets</EmptyTitle>
            <EmptyDescription>{bu ? "Requests from case managers to your BU appear here." : "Raise one from a case in investigation to ask a BU for facts."}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="-mx-6 overflow-hidden border-y bg-card">
          <Table className="min-w-[56rem]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Sub-ticket</TableHead>
                <TableHead className="w-[34%]">Case</TableHead>
                <TableHead>Priority</TableHead>
                {!bu && <TableHead>BU</TableHead>}
                <TableHead>Status</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Latest</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const s = STATUS[r.status] ?? STATUS.open;
                const overdue = (r.status === "open" || r.status === "re_requested") && r.dueAt < now;
                return (
                  <TableRow key={r.id} className="relative">
                    <TableCell className="whitespace-nowrap">
                      <Link
                        href={`/cases/${r.case.number}`}
                        className="tabular text-sm text-muted-foreground outline-none after:absolute after:inset-0 hover:text-foreground focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-inset"
                      >
                        {r.number}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-0">
                      <span className="block truncate font-medium">{r.case.subject}</span>
                      <span className="tabular block text-xs text-muted-foreground">{r.case.number}</span>
                    </TableCell>
                    <TableCell>
                      <PriorityCell priority={r.case.priority} />
                    </TableCell>
                    {!bu && <TableCell className="whitespace-nowrap">{r.bu.name}</TableCell>}
                    <TableCell>
                      <Badge variant={overdue ? "danger" : s.variant}>{overdue ? "Overdue" : s.label}</Badge>
                    </TableCell>
                    <TableCell className="tabular text-xs whitespace-nowrap text-muted-foreground">{formatDateTime(r.dueAt)}</TableCell>
                    <TableCell className="max-w-56 truncate text-muted-foreground">{r.messages[0]?.body ?? r.request}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
