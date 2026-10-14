import Link from "next/link";
import { redirect } from "next/navigation";
import { Icon } from "@/components/ccms/icons";
import { AiBrain01Icon, CheckmarkCircle02Icon, Note01Icon } from "@/components/ccms/icons";
import { currentActor } from "@/ccms/session";
import { homeData, workloadLabel } from "@/ccms/queries";
import { SOURCE_LABELS, STAGES, STAGE_LABELS, type Source } from "@/ccms/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Kpi, KpiStrip } from "@/components/ccms/kpi";
import { BarList, ChartTable, StackedBar } from "@/components/ccms/charts";
import { SlaMeter, STATUS } from "@/components/ccms/sla-meter";
import { PriorityCell } from "@/components/ccms/case-table";
import { ActivityTimeline } from "@/components/ccms/activity-timeline";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

export const dynamic = "force-dynamic";

function greeting(now: Date) {
  const h = Number(now.toLocaleString("en-SG", { hour: "numeric", hour12: false, timeZone: "Asia/Singapore" }));
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

const NOTE_ICON = { system: AiBrain01Icon, work_note: Note01Icon, resolution_log: CheckmarkCircle02Icon } as const;

export default async function HomePage() {
  const actor = await currentActor();
  if (!actor) redirect("/login");
  const now = new Date();
  const d = await homeData(actor, now);
  const k = d.kpis;

  const stageData = STAGES.filter((s) => s !== "closed").map((s) => ({
    label: STAGE_LABELS[s],
    value: d.byStage.find((x) => x.key === s)?.value ?? 0,
  }));
  const intakeData = d.intake.map((x) => ({ label: SOURCE_LABELS[x.key as Source] ?? x.key, value: x.value }));
  const slaData = [
    { label: "On track", value: d.slaHealth.on_track, color: STATUS.good },
    { label: "Near breach", value: d.slaHealth.near_breach, color: STATUS.warning },
    { label: "Breached", value: d.slaHealth.breached, color: STATUS.critical },
    { label: "Paused", value: d.slaHealth.paused, color: "#898781" },
  ];

  return (
    <div className="flex flex-col gap-4 px-6 py-5">
      <div className="flex flex-col gap-0.5">
        <h1 className="text-lg font-semibold">
          {greeting(now)}, {actor.name.split(" ")[0]}
        </h1>
        <p className="text-xs text-muted-foreground">
          {now.toLocaleDateString("en-SG", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Singapore" })} · {workloadLabel(actor)}
        </p>
      </div>

      <KpiStrip>
        <Kpi label="Open cases" value={k.open} context="In your workload" href="/inbox?scope=all" />
        <Kpi label="SLA breached" value={k.breached} context="Needs action now" alert href="/inbox?filter=breached&scope=all" />
        <Kpi label="Near breach" value={k.nearBreach} context="Past the alert threshold" href="/inbox?filter=near_breach&scope=all" />
        <Kpi label="Unacknowledged" value={k.awaitingAck} context="2-working-day ack SLA" href="/inbox?filter=awaiting_ack&scope=all" />
        <Kpi label="To assess" value={k.toAssess} context="AI output awaiting review" href="/inbox?filter=to_assess&scope=all" />
        <Kpi label="Significant" value={k.significant} context={`${k.vulnerable} vulnerable customer${k.vulnerable === 1 ? "" : "s"}`} href="/inbox?filter=significant&scope=all" />
      </KpiStrip>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Needs attention</CardTitle>
              <Button asChild variant="link" size="xs">
                <Link href="/inbox?filter=at_risk&scope=all">View all at-risk cases</Link>
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {d.attention.length === 0 ? (
                <Empty className="py-10">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Icon icon={CheckmarkCircle02Icon} color={STATUS.good} />
                    </EmptyMedia>
                    <EmptyTitle>Nothing at risk</EmptyTitle>
                    <EmptyDescription>Every open case is inside its SLA window.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <ul className="divide-y">
                  {d.attention.map((a) => (
                    <li key={a.id}>
                      <Link
                        href={`/cases/${a.number}`}
                        className="grid grid-cols-[minmax(0,1fr)_9rem] items-center gap-4 px-4 py-2 outline-none hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:grid-cols-[9rem_minmax(0,1fr)_6.5rem_10rem]"
                      >
                        <span className="tabular hidden text-xs text-muted-foreground sm:block">{a.number}</span>
                        <span className="truncate text-sm">{a.subject}</span>
                        <span className="hidden sm:block">
                          <PriorityCell priority={a.priority} />
                        </span>
                        <SlaMeter health={a.sla.health} percent={a.sla.percent} remainingMs={a.sla.remainingMs} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <div className="grid items-start gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Open cases by stage</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <BarList data={stageData} />
                <ChartTable data={stageData} valueLabel="Cases" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Intake by channel</CardTitle>
                <span className="text-xs text-muted-foreground">Last 7 days</span>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {intakeData.length ? <BarList data={intakeData} /> : <p className="py-6 text-center text-sm text-muted-foreground">No cases received this week.</p>}
                {intakeData.length > 0 && <ChartTable data={intakeData} valueLabel="Cases" />}
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>SLA health</CardTitle>
              <span className="text-xs text-muted-foreground">Most urgent running clock</span>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <StackedBar data={slaData} />
              <ChartTable data={slaData} valueLabel="Cases" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Recent activity</CardTitle>
            </CardHeader>
            <CardContent>
              {d.activity.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No activity yet.</p>
              ) : (
                <ActivityTimeline
                  now={now}
                  events={d.activity.map((n) => ({
                    id: n.id,
                    at: n.at,
                    actor: n.author,
                    icon: NOTE_ICON[n.kind as keyof typeof NOTE_ICON] ?? Note01Icon,
                    action: n.kind === "work_note" ? "added a work note on" : "updated",
                    target: (
                      <Link href={`/cases/${n.number}`} className="tabular whitespace-nowrap hover:underline">
                        {n.number}
                      </Link>
                    ),
                    body: <p className="line-clamp-2 text-sm text-muted-foreground">{n.body}</p>,
                  }))}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
