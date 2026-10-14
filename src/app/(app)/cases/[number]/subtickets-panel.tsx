"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Icon, Add01Icon, SentIcon, Task01Icon } from "@/components/ccms/icons";
import { Avatar } from "@/components/ccms/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { cn } from "@/lib/utils";
import { closeSubTicketAction, raiseSubTicketAction, reRequestSubTicketAction, respondSubTicketAction } from "./actions";

export interface SubTicketView {
  id: string;
  number: string;
  buId: string;
  buName: string;
  status: string;
  dueAt: string;
  assignee: string | null;
  messages: { id: string; direction: string; body: string; author: string | null; at: string }[];
}

const STATUS: Record<string, { label: string; variant: "warning" | "success" | "info" | "outline" }> = {
  open: { label: "Waiting on BU", variant: "warning" },
  re_requested: { label: "Re-requested", variant: "warning" },
  responded: { label: "Responded", variant: "success" },
  closed: { label: "Closed", variant: "outline" },
};
const VERB: Record<string, string> = { request: "requested", response: "responded", re_request: "re-requested", reminder: "sent a reminder" };

const when = (iso: string) => new Date(iso).toLocaleString("en-SG", { day: "2-digit", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Singapore" });

function Reply({ label, placeholder, onSend }: { label: string; placeholder: string; onSend: (text: string) => Promise<boolean> }) {
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          if (await onSend(text)) setText("");
        });
      }}
    >
      <Textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} aria-label={label} />
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={pending || !text.trim()}>
          <Icon icon={SentIcon} aria-hidden />
          {pending ? "Sending…" : label}
        </Button>
      </div>
    </form>
  );
}

export function SubTicketsPanel({
  number,
  caseId,
  tickets,
  canManage,
  canRaise,
  viewerBuId,
  bus,
}: {
  number: string;
  caseId: string;
  tickets: SubTicketView[];
  /** Assigned case manager: may re-request and close. */
  canManage: boolean;
  /** Case is in investigation or resolution and the viewer manages it. */
  canRaise: boolean;
  /** BU staff viewing: may answer their BU's tickets. */
  viewerBuId: string | null;
  bus: { id: string; name: string }[];
}) {
  const [buId, setBuId] = useState(bus[0]?.id ?? "");
  const [request, setRequest] = useState("");
  const [raising, startRaise] = useTransition();
  const [closing, startClose] = useTransition();
  const done = (r: { ok: true; message?: string } | { ok: false; error: string }) => {
    if (r.ok) toast.success(r.message);
    else toast.error(r.error);
    return r.ok;
  };
  const now = Date.now();

  return (
    <div className="flex flex-col gap-4">
      {canRaise && (
        <form
          className="flex flex-col gap-3 rounded-lg bg-card p-4 shadow-card"
          onSubmit={(e) => {
            e.preventDefault();
            startRaise(async () => {
              if (done(await raiseSubTicketAction(number, caseId, buId, request))) setRequest("");
            });
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Ask a business unit</h3>
            <span className="text-xs text-muted-foreground">Due in 3 working days</span>
          </div>
          <div className="flex flex-col gap-2">
            <NativeSelect aria-label="Business unit" className="sm:max-w-64" value={buId} onChange={(e) => setBuId(e.target.value)}>
              {bus.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </NativeSelect>
            <Textarea rows={2} value={request} onChange={(e) => setRequest(e.target.value)} placeholder="What do you need from them? e.g. Confirm when the invoice request was sent and why the claim is pending." aria-label="Request" />
          </div>
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={raising || !request.trim() || !buId}>
              <Icon icon={Add01Icon} aria-hidden />
              {raising ? "Sending…" : "Send sub-ticket"}
            </Button>
          </div>
        </form>
      )}

      {tickets.length === 0 ? (
        <Empty className="rounded-lg bg-card py-12 shadow-card">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Icon icon={Task01Icon} />
            </EmptyMedia>
            <EmptyTitle>No sub-tickets yet</EmptyTitle>
            <EmptyDescription>{canRaise ? "Ask a business unit for the facts you need to investigate." : "Sub-tickets open once the assessment is confirmed."}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        tickets.map((t) => {
          const s = STATUS[t.status] ?? STATUS.open;
          const waiting = t.status === "open" || t.status === "re_requested";
          const overdue = waiting && new Date(t.dueAt).getTime() < now;
          const mine = viewerBuId === t.buId;
          return (
            <section key={t.id} className="overflow-hidden rounded-lg bg-card shadow-card">
              <header className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
                <span className="tabular text-sm text-muted-foreground">{t.number}</span>
                <span className="text-sm font-semibold">{t.buName}</span>
                <Badge variant={overdue ? "danger" : s.variant}>{overdue ? "Overdue" : s.label}</Badge>
                <span className={cn("ml-auto text-xs", overdue ? "text-destructive" : "text-muted-foreground")}>
                  {waiting ? `Due ${when(t.dueAt)}` : t.assignee ? `Answered by ${t.assignee}` : ""}
                </span>
              </header>
              <ol className="flex flex-col gap-3 px-4 py-3">
                {t.messages.map((m) => (
                  <li key={m.id} className="flex gap-2.5">
                    <Avatar name={m.author ?? "System"} size="sm" />
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <p className="text-xs text-muted-foreground">
                        <span className="text-foreground">{m.author ?? "System"}</span> {VERB[m.direction] ?? m.direction} · {when(m.at)}
                      </p>
                      <p className="text-sm whitespace-pre-wrap">{m.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
              {t.status !== "closed" && (mine || canManage) && (
                <div className="flex flex-col gap-2 border-t bg-muted/50 px-4 py-3">
                  {mine && waiting && <Reply label="Send response" placeholder={`Answer for ${t.buName}…`} onSend={async (text) => done(await respondSubTicketAction(number, t.id, text))} />}
                  {canManage && t.status === "responded" && (
                    <>
                      <Reply label="Re-request" placeholder="Still missing something? Ask again…" onSend={async (text) => done(await reRequestSubTicketAction(number, t.id, text))} />
                      <div className="flex justify-end">
                        <Button size="sm" variant="outline" disabled={closing} onClick={() => startClose(async () => void done(await closeSubTicketAction(number, t.id)))}>
                          Close sub-ticket
                        </Button>
                      </div>
                    </>
                  )}
                  {canManage && waiting && !mine && <p className="text-xs text-muted-foreground">Waiting for {t.buName} to respond. n8n reminds them when it&apos;s due.</p>}
                </div>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}
