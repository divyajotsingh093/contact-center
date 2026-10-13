import Link from "next/link";
import { redirect } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Alert02Icon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  FileAddIcon,
  Flag02Icon,
  InboxIcon,
  Mail01Icon,
  AiBrain01Icon,
  Note01Icon,
} from "@hugeicons/core-free-icons";
import { currentActor } from "@/ccms/session";
import { homeData, workloadLabel } from "@/ccms/queries";
import { SOURCE_LABELS, STAGES, STAGE_LABELS, type Source } from "@/ccms/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Kpi } from "@/components/ccms/kpi";
import { BarList, ChartTable, StackedBar } from "@/components/ccms/charts";
import { SlaMeter, STATUS } from "@/components/ccms/sla-meter";
import { PriorityBadge } from "@/components/ccms/badges";
import { formatDateTime, titleCase } from "@/components/ccms/format";

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
    <div className="flex flex-col gap-5 px-6 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-xs text-muted-foreground">
            {now.toLocaleDateString("en-SG", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Singapore" })}
          </p>
          <h1 className="text-xl font-semibold">
            {greeting(now)}, {actor.name.split(" ")[0]}
          </h1>
          <p className="text-sm text-muted-foreground">{workloadLabel(actor)} at a glance.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/inbox">
              <HugeiconsIcon icon={InboxIcon} aria-hidden />
              Open my cases
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/intake">
              <HugeiconsIcon icon={FileAddIcon} aria-hidden />
              Log a case
            </Link>
          </Button>
        </div>
      </div>

      <section aria-label="Key figures" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Open cases" value={k.open} context="In your workload" icon={InboxIcon} href="/inbox?scope=all" />
        <Kpi label="SLA breached" value={k.breached} context="Needs action now" icon={Alert02Icon} iconColor={STATUS.critical} emphasis href="/inbox?filter=breached&scope=all" />
        <Kpi label="Near breach" value={k.nearBreach} context="Past the alert threshold" icon={Clock01Icon} iconColor={STATUS.warning} href="/inbox?filter=near_breach&scope=all" />
        <Kpi label="Unacknowledged" value={k.awaitingAck} context="2-working-day ack SLA" icon={Mail01Icon} href="/inbox?filter=awaiting_ack&scope=all" />
        <Kpi label="To assess" value={k.toAssess} context="AI output awaiting review" icon={AiBrain01Icon} href="/inbox?filter=to_assess&scope=all" />
        <Kpi label="Significant" value={k.significant} context={`${k.vulnerable} vulnerable customer${k.vulnerable === 1 ? "" : "s"}`} icon={Flag02Icon} href="/inbox?filter=significant&scope=all" />
      </section>

      <section className="grid items-start gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-1">
              <CardTitle>SLA health</CardTitle>
              <CardDescription>Open cases by their most urgent running clock</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <StackedBar data={slaData} />
            <ChartTable data={slaData} valueLabel="Cases" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-1">
              <CardTitle>Open cases by stage</CardTitle>
              <CardDescription>Where work sits in the seven-stage lifecycle</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <BarList data={stageData} />
            <ChartTable data={stageData} valueLabel="Cases" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-1">
              <CardTitle>Intake by channel</CardTitle>
              <CardDescription>Cases received in the last 7 days</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {intakeData.length ? <BarList data={intakeData} /> : <p className="py-6 text-center text-sm text-muted-foreground">No cases received this week.</p>}
            {intakeData.length > 0 && <ChartTable data={intakeData} valueLabel="Cases" />}
          </CardContent>
        </Card>
      </section>

      <section className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-1">
              <CardTitle>Needs attention</CardTitle>
              <CardDescription>Breached and near-breach cases, most urgent first</CardDescription>
            </div>
            <Button asChild variant="ghost" size="xs">
              <Link href="/inbox?filter=at_risk&scope=all">View all</Link>
            </Button>
          </CardHeader>
          <CardContent className="px-0 pb-1">
            {d.attention.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                <HugeiconsIcon icon={CheckmarkCircle02Icon} size={22} color={STATUS.good} aria-hidden />
                <p className="text-sm font-medium">Nothing at risk</p>
                <p className="text-sm text-muted-foreground">Every open case is inside its SLA window.</p>
              </div>
            ) : (
              <ul className="divide-y divide-black/[0.06] dark:divide-white/[0.08]">
                {d.attention.map((a) => (
                  <li key={a.id}>
                    <Link href={`/cases/${a.number}`} className="grid grid-cols-[minmax(0,1fr)_10rem] items-center gap-4 px-4 py-3 outline-none hover:bg-muted/50 focus-visible:bg-muted/50">
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="flex items-center gap-2">
                          <span className="tabular text-xs text-muted-foreground">{a.number}</span>
                          <PriorityBadge priority={a.priority} />
                        </span>
                        <span className="truncate text-[13px] font-medium">{a.subject}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          {titleCase(a.nature)} · {a.caseManager ?? "Unassigned"}
                        </span>
                      </span>
                      <SlaMeter health={a.sla.health} percent={a.sla.percent} remainingMs={a.sla.remainingMs} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-1">
              <CardTitle>Recent activity</CardTitle>
              <CardDescription>Latest notes on cases in your workload</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {d.activity.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <ol className="flex flex-col gap-3.5">
                {d.activity.map((n) => (
                  <li key={n.id} className="flex gap-3">
                    <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                      <HugeiconsIcon icon={NOTE_ICON[n.kind as keyof typeof NOTE_ICON] ?? Note01Icon} size={13} aria-hidden />
                    </span>
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="line-clamp-2 text-[13px]">{n.body}</span>
                      <span className="tabular text-xs text-muted-foreground">
                        <Link href={`/cases/${n.number}`} className="hover:text-foreground hover:underline">
                          {n.number}
                        </Link>{" "}
                        · {formatDateTime(n.at)}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

