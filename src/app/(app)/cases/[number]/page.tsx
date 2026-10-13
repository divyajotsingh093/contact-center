import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
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
} from "@hugeicons/core-free-icons";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { AssessmentPanel } from "./assessment-panel";
import { Composer } from "./composer";
import { ResendButton } from "./resend-button";

export const dynamic = "force-dynamic";

function Field({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  const empty = value === null || value === undefined || value === "";
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("truncate text-[13px]", mono && "tabular", empty && "text-muted-foreground")}>{empty ? "—" : value}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-black/[0.08] bg-card p-4 shadow-xs dark:border-white/10">
      <h3 className="text-[13px] font-semibold">{title}</h3>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3.5 sm:grid-cols-3">{children}</dl>
    </section>
  );
}

/** One cell of the highlighted-values strip under the record header. */
function Highlight({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1 px-4 py-3", className)}>
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      <div className="min-w-0 text-[13px] font-medium">{children}</div>
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
        <div className="flex flex-col items-center gap-2 px-6 py-24 text-center">
          <HugeiconsIcon icon={LockIcon} size={24} className="text-muted-foreground" aria-hidden />
          <p className="text-sm font-medium">You don&apos;t have access to this case</p>
          <p className="text-sm text-muted-foreground">Access follows BSD section 7. Ask the team lead if you need it.</p>
        </div>
      );
    }
    throw e;
  }
  if (!data) notFound();
  const { case: c, masked, previous, can, authors } = data;
  const now = new Date();
  const eds = (c.extra as { eds?: EdsAttributes } | null)?.eds;
  const resolution = c.slaClocks.find((s) => s.kind === "resolution");
  const resolutionView = resolution ? slaView(resolution, now) : null;
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

  return (
    <div className="flex flex-col">
      {/* Record header */}
      <div className="border-b border-black/[0.06] bg-card dark:border-white/[0.08]">
        <div className="flex flex-col gap-3 px-6 pt-4 pb-3">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-muted-foreground">
            <Link href="/inbox" className="hover:text-foreground hover:underline">
              My cases
            </Link>
            <HugeiconsIcon icon={ArrowRight01Icon} size={12} aria-hidden />
            <span className="tabular text-foreground">{c.number}</span>
          </nav>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1.5">
              <h1 className="text-xl font-semibold">{c.subject}</h1>
              <div className="flex flex-wrap items-center gap-1.5">
                <NatureBadge nature={c.nature} />
                <CaseFlags c={c} />
                {masked && (
                  <Badge variant="outline">
                    <HugeiconsIcon icon={LockIcon} aria-hidden />
                    Masked for your role · view logged
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 divide-black/[0.06] border-t border-black/[0.06] sm:grid-cols-4 sm:divide-x xl:grid-cols-7 dark:divide-white/[0.08] dark:border-white/[0.08]">
          <Highlight label="Priority">
            <PriorityCell priority={c.priority} />
          </Highlight>
          <Highlight label="Stage">{c.status === "closed" ? "Closed" : (STAGE_LABELS[c.stage as Stage] ?? c.stage)}</Highlight>
          <Highlight label="Channel">
            <span className="truncate">{SOURCE_LABELS[c.source as Source] ?? c.source}</span>
          </Highlight>
          <Highlight label="Assigned to">
            <Person name={c.caseManager?.name} size="xs" />
          </Highlight>
          <Highlight label="Customer">
            <span className="flex items-center gap-1.5 truncate">
              {c.complainantName ?? "Unknown"}
              {eds?.customerGrade && !masked && <span className="font-normal text-muted-foreground">· {eds.customerGrade}</span>}
            </span>
          </Highlight>
          <Highlight label="Target resolution">
            <span className="tabular">{formatDate(c.targetResolutionAt)}</span>
          </Highlight>
          <Highlight label="Resolution SLA" className="col-span-2 sm:col-span-2 xl:col-span-1">
            {resolutionView ? <SlaMeter health={resolutionView.health} percent={resolutionView.percent} remainingMs={resolutionView.remainingMs} /> : "—"}
          </Highlight>
        </div>
        <div className="border-t border-black/[0.06] px-6 py-3 dark:border-white/[0.08]">
          <StageTracker stage={c.stage} nature={c.nature} />
        </div>
      </div>

      <div className="grid gap-5 px-6 py-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Tabs defaultValue={["intake", "acknowledgement", "assessment"].includes(c.stage) && can.edit ? "assessment" : "activity"}>
          <TabsList>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="assessment">
              Assessment
              {c.assessments.some((a) => a.status === "proposed") && <span className="size-1.5 rounded-full bg-brand" aria-label="awaiting review" />}
            </TabsTrigger>
            <TabsTrigger value="communications">
              Communications <span className="tabular text-xs text-muted-foreground">{c.communications.length}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="activity" className="flex flex-col gap-4">
            {(can.edit || can.reallocate) && !masked && (
              <Composer number={c.number} caseId={c.id} canEmail={can.edit} customerEmail={c.complainantEmail} defaultSubject={`Re: ${c.subject} (${c.number})`} />
            )}
            {activity.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">{masked ? "Activity is hidden for your role." : "No activity yet."}</p>
            ) : (
              <ol className="relative flex flex-col gap-4 before:absolute before:top-2 before:bottom-2 before:left-[15px] before:w-px before:bg-black/[0.08] dark:before:bg-white/10">
                {activity.map((item) => {
                  if (item.type === "note") {
                    const n = item.n;
                    const author = n.authorId ? authors[n.authorId] : null;
                    const system = n.kind === "system";
                    return (
                      <li key={`n-${n.id}`} className="relative flex gap-3">
                        {author ? (
                          <Avatar name={author} size="md" className="relative ring-4 ring-page" />
                        ) : (
                          <span className="relative grid size-8 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground ring-4 ring-page">
                            <HugeiconsIcon icon={AiBrain01Icon} size={15} aria-hidden />
                          </span>
                        )}
                        <div
                          className={cn(
                            "flex min-w-0 flex-1 flex-col gap-1 rounded-xl border px-3.5 py-2.5",
                            system ? "border-transparent bg-transparent px-0" : "border-[#efe3bd] bg-[#fdf9ec] dark:border-[#4d4223] dark:bg-[#24210f]",
                          )}
                        >
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="font-medium text-foreground">{author ?? "System"}</span>
                            {!system && (
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <HugeiconsIcon icon={LockIcon} size={11} aria-hidden />
                                Work note
                              </span>
                            )}
                            <span className="tabular ml-auto text-muted-foreground">{formatDateTime(n.createdAt)}</span>
                          </div>
                          <p className={cn("text-[13px] whitespace-pre-wrap", system && "text-muted-foreground")}>{n.body}</p>
                        </div>
                      </li>
                    );
                  }
                  const m = item.m;
                  const inbound = m.direction === "inbound";
                  return (
                    <li key={`m-${m.id}`} className="relative flex gap-3">
                      <span className={cn("relative grid size-8 shrink-0 place-items-center rounded-full ring-4 ring-page", inbound ? "bg-[#dbe8f8] text-[#1c5cab]" : "bg-muted text-muted-foreground")}>
                        <HugeiconsIcon icon={inbound ? MailReceive01Icon : (CHANNEL_ICON[m.channel as keyof typeof CHANNEL_ICON] ?? SentIcon)} size={15} aria-hidden />
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col gap-1.5 rounded-xl border border-black/[0.08] bg-card px-3.5 py-2.5 shadow-xs dark:border-white/10">
                        <div className="flex flex-wrap items-center gap-1.5 text-xs">
                          <span className="font-medium">{inbound ? (c.complainantName ?? "Customer") : m.authorId ? authors[m.authorId] : "CCMS"}</span>
                          <span className="text-muted-foreground">
                            {inbound ? "replied by" : "sent"} {m.channel}
                            {m.purpose !== "update" && ` · ${titleCase(m.purpose)}`}
                          </span>
                          <Badge variant={m.status === "failed" ? "danger" : m.status === "delivered" ? "success" : "outline"}>{titleCase(m.status)}</Badge>
                          {m.channel === "sms" && <span className="text-muted-foreground">Simulated</span>}
                          <span className="tabular ml-auto text-muted-foreground">{formatDateTime(m.createdAt)}</span>
                        </div>
                        {m.subject && <p className="text-[13px] font-medium">{m.subject}</p>}
                        <p className="line-clamp-4 text-[13px] whitespace-pre-wrap text-muted-foreground">{m.body}</p>
                        {m.status === "failed" && can.edit && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-destructive">{m.error ?? "Send failed"}</span>
                            <ResendButton number={c.number} communicationId={m.id} />
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </TabsContent>

          <TabsContent value="details" className="flex flex-col gap-4">
            <section className="flex flex-col gap-2 rounded-xl border border-black/[0.08] bg-card p-4 shadow-xs dark:border-white/10">
              <h3 className="text-[13px] font-semibold">Description</h3>
              <p className="max-w-[75ch] text-[13px] leading-relaxed whitespace-pre-wrap">{c.description}</p>
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

          <TabsContent value="communications" className="flex flex-col gap-2">
            {c.communications.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No communications yet.</p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-black/[0.08] bg-card shadow-xs dark:border-white/10">
                <ul className="divide-y divide-black/[0.06] dark:divide-white/[0.08]">
                  {c.communications.map((m) => (
                    <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                      <HugeiconsIcon icon={m.direction === "inbound" ? MailReceive01Icon : (CHANNEL_ICON[m.channel as keyof typeof CHANNEL_ICON] ?? SentIcon)} size={16} className="shrink-0 text-muted-foreground" aria-hidden />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-[13px] font-medium">{m.subject ?? titleCase(m.purpose)}</span>
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

        {/* Contextual side panel */}
        <aside className="flex flex-col gap-4">
          {summary && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HugeiconsIcon icon={AiBrain01Icon} size={15} aria-hidden />
                  AI summary
                </CardTitle>
                <SourceBadge source={summarySource} />
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <p className="text-[13px] leading-relaxed">{summary.summary}</p>
                {summary.keyPoints.length > 0 && (
                  <ul className="flex list-disc flex-col gap-1 pl-4 text-[13px] text-muted-foreground">
                    {summary.keyPoints.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                )}
                <div className="rounded-lg bg-muted/60 px-3 py-2 text-[13px]">
                  <span className="text-xs font-medium text-muted-foreground">Suggested next step</span>
                  <p>{summary.suggestedNextStep}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {eds && !masked && (
            <Card>
              <CardHeader>
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={eds.customerName ?? c.complainantName ?? "Customer"} size="lg" />
                  <div className="flex min-w-0 flex-col">
                    <CardTitle className="truncate">{eds.customerName ?? c.complainantName ?? "Unknown customer"}</CardTitle>
                    <span className="tabular truncate text-xs text-muted-foreground">
                      {eds.customerNo ?? "Not matched in EDS"}
                      {eds.customerGrade ? ` · ${eds.customerGrade}` : ""}
                    </span>
                  </div>
                </div>
                <Badge variant="outline">EDS mock</Badge>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {(eds.vulnerable || eds.vip) && (
                  <div className="flex flex-wrap gap-1.5">
                    {eds.vulnerable && (
                      <Badge variant="info">
                        <HugeiconsIcon icon={Shield01Icon} aria-hidden />
                        Vulnerable · {titleCase(eds.vulnerableType ?? "yes")}
                      </Badge>
                    )}
                    {eds.vip && (
                      <Badge variant="brand">
                        <HugeiconsIcon icon={StarIcon} aria-hidden />
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
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>SLA timers</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {c.slaClocks.map((s) => {
                const v = slaView(s, now);
                return (
                  <div key={s.id} className="flex flex-col gap-1.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[13px] font-medium">{titleCase(s.kind)}</span>
                      <span className="tabular text-xs text-muted-foreground">due {formatDateTime(s.targetAt)}</span>
                    </div>
                    <SlaMeter health={v.health} percent={v.percent} remainingMs={v.remainingMs} />
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Linked and previous cases</CardTitle>
              <span className="tabular text-xs text-muted-foreground">{links.length + previous.length}</span>
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
              {links.length === 0 && previous.length === 0 && <p className="text-xs text-muted-foreground">No other cases for this customer.</p>}
              {links.map((l) => (
                <Link key={`${l.kind}-${l.other.id}`} href={`/cases/${l.other.number}`} className="-mx-2 flex flex-col gap-0.5 rounded-md px-2 py-1.5 outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring">
                  <span className="flex items-center gap-1.5 text-[13px]">
                    <HugeiconsIcon icon={Link01Icon} size={14} aria-hidden />
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
                      <span className="tabular text-[13px]">{p.number}</span>
                      <span className="truncate text-xs text-muted-foreground">{p.subject}</span>
                    </span>
                    <Badge variant="secondary">{titleCase(p.status)}</Badge>
                  </Link>
                ))}
            </CardContent>
          </Card>

          {c.attachments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Documents</CardTitle>
                <span className="tabular text-xs text-muted-foreground">{c.attachments.length}</span>
              </CardHeader>
              <CardContent className="flex flex-col gap-1">
                {c.attachments.map((a) => (
                  <div key={a.id} className="-mx-2 flex items-center gap-2.5 rounded-md px-2 py-1.5">
                    <span className="grid size-8 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
                      <HugeiconsIcon icon={Attachment01Icon} size={15} aria-hidden />
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-[13px]">{a.fileName}</span>
                      <span className="truncate text-xs text-muted-foreground">{a.mimeType}</span>
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}
