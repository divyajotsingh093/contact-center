import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { Attachment01Icon, Link01Icon, LockIcon } from "@hugeicons/core-free-icons";
import { currentActor, ForbiddenError } from "@/ccms/session";
import { getCase360 } from "@/ccms/queries";
import { health, remainingMs } from "@/ccms/sla";
import { SOURCE_LABELS, type Source } from "@/ccms/constants";
import type { EdsAttributes } from "@/integrations/eds";
import { PageHeader } from "@/components/ccms/page-header";
import { CaseFlags, NatureBadge, PriorityBadge, SlaBadge } from "@/components/ccms/badges";
import { StageTracker } from "@/components/ccms/stage-tracker";
import { formatDate, formatDateTime, titleCase } from "@/components/ccms/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AssessmentPanel } from "./assessment-panel";
import { ResendButton } from "./resend-button";

export const dynamic = "force-dynamic";

function Field({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={mono ? "tabular truncate text-[13px]" : "truncate text-[13px]"}>{value === null || value === undefined || value === "" ? "—" : value}</dd>
    </div>
  );
}

function FieldGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-medium text-muted-foreground">{title}</h3>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">{children}</dl>
    </section>
  );
}

const yesNo = (b: boolean) => (b ? "Yes" : "No");

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
  const { case: c, masked, previous, can } = data;
  const now = new Date();
  const eds = (c.extra as { eds?: EdsAttributes } | null)?.eds;
  const links = [
    ...c.linksFrom.map((l) => ({ kind: l.kind, reason: l.reason, other: l.toCase })),
    ...c.linksTo.map((l) => ({ kind: l.kind, reason: l.reason, other: l.fromCase })),
  ];

  return (
    <>
      <PageHeader
        title={c.subject}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span className="tabular">{c.number}</span>
            <span aria-hidden>·</span>
            <span>{SOURCE_LABELS[c.source as Source] ?? c.source}</span>
            <span aria-hidden>·</span>
            <span>Received {formatDateTime(c.receivedAt)}</span>
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center gap-1.5">
            <NatureBadge nature={c.nature} />
            <PriorityBadge priority={c.priority} />
            <CaseFlags c={c} />
          </div>
        }
      />

      <div className="flex flex-col gap-5 px-6 py-5">
        {masked && (
          <div className="flex items-center gap-2 rounded-lg border border-black/[0.08] bg-muted/50 px-3 py-2 text-sm text-muted-foreground dark:border-white/10">
            <HugeiconsIcon icon={LockIcon} size={16} aria-hidden />
            Sensitive details are masked for your role. This view has been logged.
          </div>
        )}
        <StageTracker stage={c.stage} nature={c.nature} />

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <Tabs defaultValue="details">
            <TabsList>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="assessment">Assessment</TabsTrigger>
              <TabsTrigger value="communications">
                Communications <span className="tabular text-xs text-muted-foreground">{c.communications.length}</span>
              </TabsTrigger>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="flex flex-col gap-6">
              <section className="flex flex-col gap-2">
                <h3 className="text-xs font-medium text-muted-foreground">Description</h3>
                <p className="max-w-[75ch] text-sm leading-relaxed whitespace-pre-wrap">{c.description}</p>
              </section>
              <FieldGroup title="Case information">
                <Field label="Nature" value={titleCase(c.nature)} />
                <Field label="Sub-type" value={titleCase(c.subType)} />
                <Field label="Source" value={SOURCE_LABELS[c.source as Source] ?? c.source} />
              </FieldGroup>
              <FieldGroup title="Customer">
                <Field label="Name" value={c.complainantName} />
                <Field label="Email" value={c.complainantEmail} />
                <Field label="Phone" value={c.complainantPhone} mono />
              </FieldGroup>
              <FieldGroup title="Policy, claim and agent">
                <Field label="Policy no." value={c.policyNo} mono />
                <Field label="Line of business" value={titleCase(c.lineOfBusiness)} />
                <Field label="Product" value={c.product} />
                <Field label="Claim no." value={c.claimNo} mono />
                <Field label="Agent code" value={c.agentCode} mono />
                <Field label="Agent involved" value={yesNo(c.agentInvolved)} />
              </FieldGroup>
              <FieldGroup title="Customer expectation">
                <Field label="Desired outcome" value={c.desiredOutcome} />
              </FieldGroup>
              <FieldGroup title="Regulatory and classification">
                <Field label="Regulatory flag" value={c.regulatoryFlag} />
                <Field label="FIDREC" value={yesNo(c.fidrec)} />
                <Field label="Data classification" value={titleCase(c.dataClassification)} />
                <Field label="Potential CHR" value={yesNo(c.potentialChr)} />
                <Field label="Significant" value={yesNo(c.significant)} />
                <Field label="Re-opened" value={yesNo(c.reopened)} />
              </FieldGroup>
              <FieldGroup title="Assignment">
                <Field label="Business unit" value={c.bu?.name} />
                <Field label="Team" value={c.team?.name} />
                <Field label="Case manager" value={c.caseManager?.name} />
                <Field label="Target resolution" value={formatDate(c.targetResolutionAt)} mono />
                <Field label="Acknowledged" value={formatDateTime(c.acknowledgedAt)} mono />
              </FieldGroup>
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
                c.communications.map((m) => (
                  <article key={m.id} className="flex flex-col gap-2 rounded-xl border border-black/[0.08] px-4 py-3 dark:border-white/10">
                    <header className="flex flex-wrap items-center gap-2">
                      <Badge variant={m.direction === "inbound" ? "info" : "outline"}>{m.direction === "inbound" ? "Inbound" : "Outbound"}</Badge>
                      <Badge variant="secondary">{titleCase(m.channel)}</Badge>
                      <Badge variant="secondary">{titleCase(m.purpose)}</Badge>
                      <Badge variant={m.status === "failed" ? "danger" : m.status === "delivered" ? "success" : "outline"}>{titleCase(m.status)}</Badge>
                      {m.channel === "sms" && <span className="text-xs text-muted-foreground">Simulated send</span>}
                      <span className="tabular ml-auto text-xs text-muted-foreground">{formatDateTime(m.createdAt)}</span>
                    </header>
                    {m.subject && <p className="text-sm font-medium">{m.subject}</p>}
                    <p className="max-w-[75ch] text-[13px] whitespace-pre-wrap text-muted-foreground">{m.body}</p>
                    {m.status === "failed" && can.edit && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-destructive">{m.error ?? "Send failed"}</span>
                        <ResendButton number={c.number} communicationId={m.id} />
                      </div>
                    )}
                  </article>
                ))
              )}
            </TabsContent>

            <TabsContent value="timeline">
              <ol className="flex flex-col gap-3 border-l border-black/[0.08] pl-4 dark:border-white/10">
                {c.notes.map((n) => (
                  <li key={n.id} className="flex flex-col gap-0.5">
                    <span className="tabular text-xs text-muted-foreground">
                      {formatDateTime(n.createdAt)} · {titleCase(n.kind)}
                    </span>
                    <span className="text-[13px]">{n.body}</span>
                  </li>
                ))}
                {c.notes.length === 0 && <li className="text-sm text-muted-foreground">Nothing yet.</li>}
              </ol>
            </TabsContent>
          </Tabs>

          <aside className="flex flex-col gap-4">
            <Card>
              <CardHeader>
                <CardTitle>SLA</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {c.slaClocks.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-2">
                    <div className="flex flex-col">
                      <span className="text-[13px]">{titleCase(s.kind)}</span>
                      <span className="tabular text-xs text-muted-foreground">due {formatDateTime(s.targetAt)}</span>
                    </div>
                    <SlaBadge health={health(s, now)} remainingMs={remainingMs(s, now)} />
                  </div>
                ))}
              </CardContent>
            </Card>

            {eds && (
              <Card>
                <CardHeader>
                  <CardTitle>EDS data</CardTitle>
                  <Badge variant="outline">Mock API</Badge>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5">
                    <Field label="Customer no." value={eds.customerNo} mono />
                    <Field label="Grade" value={eds.customerGrade} />
                    <Field label="Vulnerable" value={eds.vulnerable ? titleCase(eds.vulnerableType ?? "yes") : "No"} />
                    <Field label="VVIP" value={yesNo(eds.vip)} />
                    <Field label="Policy" value={eds.policyNo} mono />
                    <Field label="Claim" value={eds.claimNo} mono />
                    <Field label="Agent" value={eds.agentCode} mono />
                    <Field label="LOB" value={titleCase(eds.lineOfBusiness)} />
                  </dl>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Linked and previous cases</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {links.length === 0 && previous.length === 0 && <p className="text-xs text-muted-foreground">None for this customer.</p>}
                {links.map((l) => (
                  <Link key={`${l.kind}-${l.other.id}`} href={`/cases/${l.other.number}`} className="flex flex-col gap-0.5 rounded-md px-1 py-1 outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring">
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
                    <Link key={p.id} href={`/cases/${p.number}`} className="flex items-center justify-between gap-2 rounded-md px-1 py-1 outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring">
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
                </CardHeader>
                <CardContent className="flex flex-col gap-1.5">
                  {c.attachments.map((a) => (
                    <div key={a.id} className="flex items-center gap-2 text-[13px]">
                      <HugeiconsIcon icon={Attachment01Icon} size={14} aria-hidden />
                      <span className="truncate">{a.fileName}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </aside>
        </div>
      </div>
    </>
  );
}
