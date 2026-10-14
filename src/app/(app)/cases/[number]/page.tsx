import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Icon } from "@/components/ccms/icons";
import {
  AiBrain01Icon,
  ArrowRight01Icon,
  Attachment01Icon,
  Call02Icon,
  Link01Icon,
  LockIcon,
  Mail01Icon,
  MailReceive01Icon,
  Note01Icon,
  SentIcon,
  Shield01Icon,
  SmartPhone01Icon,
  StarIcon,
} from "@/components/ccms/icons";
import { currentActor, ForbiddenError } from "@/ccms/session";
import { getCase360, slaView } from "@/ccms/queries";
import { SOURCE_LABELS, STAGE_LABELS, type Source, type Stage } from "@/ccms/constants";
import type { EdsAttributes } from "@/integrations/eds";
import { kamios } from "@/integrations/kamios";
import { CaseFlags, NatureBadge, SourceBadge } from "@/components/ccms/badges";
import { StageTracker } from "@/components/ccms/stage-tracker";
import { formatDate, formatDateTime, titleCase } from "@/components/ccms/format";
import { Avatar, Person } from "@/components/ccms/avatar";
import { PriorityCell } from "@/components/ccms/case-table";
import { SlaMeter } from "@/components/ccms/sla-meter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { AssessmentPanel } from "./assessment-panel";
import { Composer } from "./composer";
import { ConfirmAssessmentButton } from "./confirm-button";
import { ResendButton } from "./resend-button";
import { OpenCaseTab } from "@/components/ccms/workspace-tabs";
import { db } from "@/lib/db";
import { SubTicketsPanel } from "./subtickets-panel";
import { ActivityTimeline, type TimelineEvent } from "@/components/ccms/activity-timeline";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

export const dynamic = "force-dynamic";

function Field({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  const empty = value === null || value === undefined || value === "";
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("truncate text-sm", mono && "tabular", empty && "text-muted-foreground")}>{empty ? "—" : value}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-lg bg-card shadow-card">
      <h3 className="border-b px-4 py-2 text-xs font-medium text-muted-foreground">{title}</h3>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 p-4 sm:grid-cols-3">{children}</dl>
    </section>
  );
}

/** One label / value row in the property panel. */
function Prop({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid min-h-8 grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-2">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate text-sm">{children}</dd>
    </div>
  );
}

const yesNo = (b: boolean) => (b ? "Yes" : "No");
const CHANNEL_ICON = { email: Mail01Icon, sms: SmartPhone01Icon, call: Call02Icon, letter: Note01Icon } as const;

export default async function Case360Page({ params }: { params: Promise<{ number: string }> }) {
  const actor = await currentActor();
  if (!actor) redirect("/login");
  const { number } = await params;

  let data: Awaited<ReturnType<typeof getCase360>>;
  try {
    data = await getCase360(decodeURIComponent(number), actor);
  } catch (e) {
    if (e instanceof ForbiddenError) {
      return (
        <Empty className="py-24">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Icon icon={LockIcon} />
            </EmptyMedia>
            <EmptyTitle>You don&apos;t have access to this case</EmptyTitle>
            <EmptyDescription>Access follows BSD section 7. Ask your team lead if you need it.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild size="sm" variant="outline">
              <Link href="/inbox">Back to cases</Link>
            </Button>
          </EmptyContent>
        </Empty>
      );
    }
    throw e;
  }
  if (!data) notFound();
  const { case: c, masked, previous, can, authors } = data;
  const now = new Date();
  const eds = (c.extra as { eds?: EdsAttributes } | null)?.eds;
  const links = [
    ...c.linksFrom.map((l) => ({ kind: l.kind, reason: l.reason, other: l.toCase })),
    ...c.linksTo.map((l) => ({ kind: l.kind, reason: l.reason, other: l.fromCase })),
  ];
  const flags = [c.significant && "significant", c.vulnerable && "vulnerable customer", c.vip && "VVIP", c.regulatoryFlag && c.regulatoryFlag !== "none" && `regulatory (${c.regulatoryFlag})`, c.fidrec && "FIDREC"].filter(Boolean) as string[];
  const { result: summary, source: summarySource } = masked
    ? { result: null, source: "local" }
    : await kamios.summarize({
        number: c.number,
        nature: c.nature,
        subject: c.subject,
        description: c.description,
        desiredOutcome: c.desiredOutcome,
        stage: c.stage,
        flags,
        recentNotes: c.notes.filter((n) => n.kind === "work_note").slice(0, 2).map((n) => n.body),
      });

  // Activity stream: notes and communications, newest first.
  const activity = [
    ...c.notes.map((n) => ({ type: "note" as const, at: n.createdAt, n })),
    ...c.communications.map((m) => ({ type: "comm" as const, at: m.createdAt, m })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  const awaitingAssessment = ["intake", "acknowledgement", "assessment"].includes(c.stage);
  const openSubTickets = c.subTickets.filter((t) => t.status !== "closed").length;
  const bus = can.edit ? await db.businessUnit.findMany({ where: { code: { not: "CE" } }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : [];

  return (
    <div className="flex flex-col">
      <OpenCaseTab number={c.number} />
      {/* Record header */}
      <div className="border-b bg-card">
        <div className="flex flex-wrap items-start justify-between gap-3 px-6 pt-4 pb-4">
          <div className="flex min-w-0 flex-col gap-1.5">
            <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-muted-foreground">
              <Link href="/inbox" className="rounded-sm outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring">
                Cases
              </Link>
              <Icon icon={ArrowRight01Icon} size={12} aria-hidden />
              <span className="tabular text-foreground">{c.number}</span>
            </nav>
            <h1 className="text-xl leading-snug font-semibold">{c.subject}</h1>
            <div className="flex flex-wrap items-center gap-1.5">
              <NatureBadge nature={c.nature} />
              <CaseFlags c={c} />
              {masked && (
                <Badge variant="outline">
                  <Icon icon={LockIcon} aria-hidden />
                  Masked for your role · view logged
                </Badge>
              )}
            </div>
          </div>
          {can.edit && awaitingAssessment && !masked && <ConfirmAssessmentButton number={c.number} caseId={c.id} />}
        </div>
        <div className="border-t px-6 py-3">
          <StageTracker stage={c.stage} nature={c.nature} />
        </div>
      </div>

      {/* Record (tabs | activity) beside a flush property panel; the panel drops below under the wide breakpoint. */}
      <div className="flex flex-1 flex-col wide:flex-row">
      <div className="grid min-w-0 flex-1 items-start gap-6 px-6 py-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <Tabs defaultValue={actor.roles.includes("bu_staff") ? "subtickets" : awaitingAssessment && can.edit ? "assessment" : "details"}>
          <TabsList>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="assessment">
              Assessment
              {c.assessments.some((a) => a.status === "proposed") && <span className="size-1.5 rounded-full bg-brand" aria-label="awaiting review" />}
            </TabsTrigger>
            <TabsTrigger value="subtickets">
              Sub-tickets {openSubTickets > 0 && <span className="tabular text-xs text-muted-foreground">{openSubTickets}</span>}
            </TabsTrigger>
            <TabsTrigger value="communications">
              Communications <span className="tabular text-xs text-muted-foreground">{c.communications.length}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="flex flex-col gap-3">
            <section className="overflow-hidden rounded-lg bg-card shadow-card">
              <h3 className="border-b px-4 py-2 text-xs font-medium text-muted-foreground">Description</h3>
              <p className="max-w-[75ch] p-4 text-sm leading-relaxed whitespace-pre-wrap">{c.description}</p>
            </section>
            <Section title="Case information">
              <Field label="Nature" value={titleCase(c.nature)} />
              <Field label="Sub-type" value={c.subType ? titleCase(c.subType) : null} />
              <Field label="Source" value={SOURCE_LABELS[c.source as Source] ?? c.source} />
              <Field label="Received" value={formatDateTime(c.receivedAt)} mono />
              <Field label="Acknowledged" value={c.acknowledgedAt ? formatDateTime(c.acknowledgedAt) : null} mono />
            </Section>
            <Section title="Customer">
              <Field label="Name" value={c.complainantName} />
              <Field label="Email" value={c.complainantEmail} />
              <Field label="Phone" value={c.complainantPhone} mono />
              <Field label="Desired outcome" value={c.desiredOutcome} />
            </Section>
            <Section title="Policy, claim and agent">
              <Field label="Policy no." value={c.policyNo} mono />
              <Field label="Line of business" value={c.lineOfBusiness ? titleCase(c.lineOfBusiness) : null} />
              <Field label="Product" value={c.product} />
              <Field label="Claim no." value={c.claimNo} mono />
              <Field label="Agent code" value={c.agentCode} mono />
              <Field label="Agent involved" value={yesNo(c.agentInvolved)} />
            </Section>
            <Section title="Regulatory and classification">
              <Field label="Regulatory flag" value={c.regulatoryFlag} />
              <Field label="FIDREC" value={yesNo(c.fidrec)} />
              <Field label="Data classification" value={titleCase(c.dataClassification)} />
              <Field label="Potential CHR" value={yesNo(c.potentialChr)} />
              <Field label="Significant" value={yesNo(c.significant)} />
              <Field label="Re-opened" value={yesNo(c.reopened)} />
            </Section>
            <Section title="Assignment">
              <Field label="Business unit" value={c.bu?.name} />
              <Field label="Team" value={c.team?.name} />
              <Field label="Case manager" value={c.caseManager?.name} />
            </Section>
          </TabsContent>

          <TabsContent value="assessment">
            <AssessmentPanel
              number={c.number}
              caseId={c.id}
              stage={c.stage}
              canEdit={can.edit}
              rows={c.assessments.map((a) => ({
                output: a.output,
                aiValue: a.aiValue,
                finalValue: a.finalValue,
                confidence: a.confidence,
                rationale: a.rationale,
                source: a.source,
                status: a.status,
              }))}
            />
          </TabsContent>

          <TabsContent value="subtickets">
            <SubTicketsPanel
              number={c.number}
              caseId={c.id}
              canManage={can.edit}
              canRaise={can.edit && ["investigation", "resolution"].includes(c.stage)}
              viewerBuId={actor.roles.includes("bu_staff") ? actor.buId : null}
              bus={bus}
              tickets={c.subTickets.map((t) => ({
                id: t.id,
                number: t.number,
                buId: t.buId,
                buName: t.bu.name,
                status: t.status,
                dueAt: t.dueAt.toISOString(),
                assignee: t.assignee?.name ?? null,
                messages: t.messages.map((m) => ({ id: m.id, direction: m.direction, body: m.body, author: m.authorId ? (authors[m.authorId] ?? null) : null, at: m.createdAt.toISOString() })),
              }))}
            />
          </TabsContent>

          <TabsContent value="communications" className="flex flex-col gap-2">
            {c.communications.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No communications yet.</p>
            ) : (
              <div className="overflow-hidden rounded-lg bg-card shadow-card">
                <ul className="divide-y">
                  {c.communications.map((m) => (
                    <li key={m.id} className="flex items-center gap-3 px-4 py-2">
                      <Icon icon={m.direction === "inbound" ? MailReceive01Icon : (CHANNEL_ICON[m.channel as keyof typeof CHANNEL_ICON] ?? SentIcon)} size={16} className="shrink-0 text-muted-foreground" aria-hidden />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-medium">{m.subject ?? titleCase(m.purpose)}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          {m.direction === "inbound" ? "From" : "To"} {m.to ?? "—"} · {titleCase(m.purpose)}
                        </span>
                      </span>
                      <Badge variant={m.status === "failed" ? "danger" : m.status === "delivered" ? "success" : "outline"}>{titleCase(m.status)}</Badge>
                      <span className="tabular w-28 text-right text-xs text-muted-foreground">{formatDateTime(m.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <section aria-label="Activity" className="flex min-w-0 flex-col gap-3">
          <h2 className="flex h-9 items-center border-b text-sm font-medium">Activity</h2>
            {(can.edit || can.reallocate) && !masked && (
              <Composer number={c.number} caseId={c.id} canEmail={can.edit} customerEmail={c.complainantEmail} defaultSubject={`Re: ${c.subject} (${c.number})`} />
            )}
            {activity.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">{masked ? "Activity is hidden for your role." : "No activity yet."}</p>
            ) : (
              <ActivityTimeline
                now={now}
                events={activity.map((item): TimelineEvent => {
                  if (item.type === "note") {
                    const n = item.n;
                    const system = n.kind === "system";
                    return {
                      id: `n-${n.id}`,
                      at: n.createdAt,
                      actor: n.authorId ? (authors[n.authorId] ?? null) : null,
                      icon: system ? AiBrain01Icon : LockIcon,
                      action: system ? undefined : "added a work note",
                      body: system ? (
                        <p className="text-sm whitespace-pre-wrap text-muted-foreground">{n.body}</p>
                      ) : (
                        <p className="rounded-lg border border-[#efe3bd] bg-[#fdf9ec] px-3 py-2 text-sm whitespace-pre-wrap dark:border-[#4d4223] dark:bg-[#24210f]">{n.body}</p>
                      ),
                    };
                  }
                  const m = item.m;
                  const inbound = m.direction === "inbound";
                  return {
                    id: `m-${m.id}`,
                    at: m.createdAt,
                    actor: inbound ? (c.complainantName ?? "Customer") : m.authorId ? (authors[m.authorId] ?? "CCMS") : "CCMS",
                    icon: inbound ? MailReceive01Icon : (CHANNEL_ICON[m.channel as keyof typeof CHANNEL_ICON] ?? SentIcon),
                    action: `${inbound ? "replied by" : "sent"} ${m.channel}${m.purpose !== "update" ? ` · ${titleCase(m.purpose)}` : ""}`,
                    body: (
                      <div className="flex flex-col gap-1.5 rounded-lg bg-card px-3 py-2.5 shadow-card">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {m.subject && <span className="min-w-0 flex-1 truncate text-sm text-foreground">{m.subject}</span>}
                          <Badge variant={m.status === "failed" ? "danger" : m.status === "delivered" ? "success" : "outline"}>{titleCase(m.status)}</Badge>
                          {m.channel === "sms" && <span className="text-xs text-muted-foreground">Simulated</span>}
                        </div>
                        <p className="line-clamp-3 text-sm whitespace-pre-wrap text-muted-foreground">{m.body}</p>
                        {m.status === "failed" && can.edit && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-destructive">{m.error ?? "Send failed"}</span>
                            <ResendButton number={c.number} communicationId={m.id} />
                          </div>
                        )}
                      </div>
                    ),
                  };
                })}
              />
            )}
          </section>
      </div>

        {/* Property panel */}
        <aside aria-label="Case properties" className="border-t bg-background wide:w-80 wide:shrink-0 wide:border-t-0 wide:border-l">
          <section className="border-b px-5 py-4">
            <h3 className="mb-2 text-xs font-medium text-muted-foreground">Details</h3>
            <dl className="flex flex-col">
              <Prop label="Priority">
                <PriorityCell priority={c.priority} />
              </Prop>
              <Prop label="Stage">{c.status === "closed" ? "Closed" : (STAGE_LABELS[c.stage as Stage] ?? c.stage)}</Prop>
              <Prop label="Channel">{SOURCE_LABELS[c.source as Source] ?? c.source}</Prop>
              <Prop label="Assigned to">
                <Person name={c.caseManager?.name} size="xs" />
              </Prop>
              <Prop label="Team">{c.team?.name ?? "—"}</Prop>
              <Prop label="Target date">
                <span className="tabular">{formatDate(c.targetResolutionAt)}</span>
              </Prop>
              <Prop label="Received">
                <span className="tabular">{formatDateTime(c.receivedAt)}</span>
              </Prop>
            </dl>
          </section>
          {summary && (
            <section className="border-b px-5 py-4 last:border-b-0">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Icon icon={AiBrain01Icon} size={15} aria-hidden />
                  AI summary
                </h3>
                <SourceBadge source={summarySource} />
              </div>
              <div className="flex flex-col gap-3">
                <p className="text-sm leading-relaxed">{summary.summary}</p>
                {summary.keyPoints.length > 0 && (
                  <ul className="flex list-disc flex-col gap-1 pl-4 text-sm text-muted-foreground">
                    {summary.keyPoints.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                )}
                <div className="rounded-md bg-muted px-3 py-2 text-sm">
                  <span className="text-xs font-medium text-muted-foreground">Suggested next step</span>
                  <p>{summary.suggestedNextStep}</p>
                </div>
              </div>
            </section>
          )}

          {eds && !masked && (
            <section className="border-b px-5 py-4 last:border-b-0">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={eds.customerName ?? c.complainantName ?? "Customer"} size="md" />
                  <div className="flex min-w-0 flex-col">
                    <h3 className="truncate text-sm font-medium text-foreground">{eds.customerName ?? c.complainantName ?? "Unknown customer"}</h3>
                    <span className="tabular truncate text-xs text-muted-foreground">
                      {eds.customerNo ?? "Not matched in EDS"}
                      {eds.customerGrade ? ` · ${eds.customerGrade}` : ""}
                    </span>
                  </div>
                </div>
                <Badge variant="outline">EDS mock</Badge>
              </div>
              <div className="flex flex-col gap-3">
                {(eds.vulnerable || eds.vip) && (
                  <div className="flex flex-wrap gap-1.5">
                    {eds.vulnerable && (
                      <Badge variant="outline">
                        <Icon icon={Shield01Icon} aria-hidden />
                        Vulnerable · {titleCase(eds.vulnerableType ?? "yes")}
                      </Badge>
                    )}
                    {eds.vip && (
                      <Badge variant="outline">
                        <Icon icon={StarIcon} aria-hidden />
                        VVIP
                      </Badge>
                    )}
                  </div>
                )}
                <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5">
                  <Field label="Policy" value={eds.policyNo} mono />
                  <Field label="Product" value={eds.product} />
                  <Field label="Claim" value={eds.claimNo} mono />
                  <Field label="Agent" value={eds.agentCode} mono />
                </dl>
              </div>
            </section>
          )}

          <section className="border-b px-5 py-4 last:border-b-0">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">SLA timers</h3>
            </div>
            <div className="flex flex-col gap-4">
              {c.slaClocks.map((s) => {
                const v = slaView(s, now);
                return (
                  <div key={s.id} className="flex flex-col gap-1.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-medium">{titleCase(s.kind)}</span>
                      <span className="tabular text-xs text-muted-foreground">due {formatDateTime(s.targetAt)}</span>
                    </div>
                    <SlaMeter health={v.health} percent={v.percent} remainingMs={v.remainingMs} />
                  </div>
                );
              })}
            </div>
          </section>

          <section className="border-b px-5 py-4 last:border-b-0">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">Linked and previous cases</h3>
              <span className="tabular text-xs text-muted-foreground">{links.length + previous.length}</span>
            </div>
            <div className="flex flex-col gap-1">
              {links.length === 0 && previous.length === 0 && <p className="text-xs text-muted-foreground">No other cases for this customer.</p>}
              {links.map((l) => (
                <Link key={`${l.kind}-${l.other.id}`} href={`/cases/${l.other.number}`} className="-mx-2 flex flex-col gap-0.5 rounded-md px-2 py-1.5 outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring">
                  <span className="flex items-center gap-1.5 text-sm">
                    <Icon icon={Link01Icon} size={14} aria-hidden />
                    <span className="tabular">{l.other.number}</span>
                    <Badge variant="outline">{titleCase(l.kind)}</Badge>
                  </span>
                  <span className="truncate text-xs text-muted-foreground">{l.reason ?? l.other.subject}</span>
                </Link>
              ))}
              {previous
                .filter((p) => !links.some((l) => l.other.id === p.id))
                .map((p) => (
                  <Link key={p.id} href={`/cases/${p.number}`} className="-mx-2 flex items-center justify-between gap-2 rounded-md px-2 py-1.5 outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring">
                    <span className="flex min-w-0 flex-col">
                      <span className="tabular text-sm">{p.number}</span>
                      <span className="truncate text-xs text-muted-foreground">{p.subject}</span>
                    </span>
                    <Badge variant="secondary">{titleCase(p.status)}</Badge>
                  </Link>
                ))}
            </div>
          </section>

          {c.attachments.length > 0 && (
            <section className="border-b px-5 py-4 last:border-b-0">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">Documents</h3>
                <span className="tabular text-xs text-muted-foreground">{c.attachments.length}</span>
              </div>
              <div className="flex flex-col gap-1">
                {c.attachments.map((a) => (
                  <div key={a.id} className="-mx-2 flex items-center gap-2.5 rounded-md px-2 py-1.5">
                    <span className="grid size-8 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
                      <Icon icon={Attachment01Icon} size={15} aria-hidden />
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-sm">{a.fileName}</span>
                      <span className="truncate text-xs text-muted-foreground">{a.mimeType}</span>
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
