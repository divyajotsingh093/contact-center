/** Read models for the screens. Access checks and masking happen here. */
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { canEditCase, canReadCase, canReallocate, maskCase, shouldMask, type Actor, type CaseScope } from "./access";
import { elapsedFraction, health, remainingMs, type ClockHealth } from "./sla";
import { ForbiddenError } from "./session";

export type InboxScope = "mine" | "team" | "significant" | "all";

const inboxInclude = {
  slaClocks: true,
  caseManager: { select: { id: true, name: true } },
  team: { select: { id: true, name: true } },
  subTickets: { select: { buId: true } },
} satisfies Prisma.CaseInclude;

type InboxRow = Prisma.CaseGetPayload<{ include: typeof inboxInclude }>;

export function scopeOf(c: {
  caseManagerId: string | null;
  teamId: string | null;
  buId: string | null;
  confidential: boolean;
  vip: boolean;
  vulnerable: boolean;
  subTickets?: { buId: string }[];
}): CaseScope {
  return { ...c, subTicketBuIds: c.subTickets?.map((s) => s.buId) };
}

export interface SlaView {
  kind: string;
  health: ClockHealth;
  remainingMs: number;
  percent: number;
  targetAt: Date;
}

export function slaView(c: Parameters<typeof health>[0] & { kind: string }, now = new Date()): SlaView {
  return {
    kind: c.kind,
    health: health(c, now),
    remainingMs: remainingMs(c, now),
    percent: elapsedFraction(c, now) * 100,
    targetAt: c.targetAt,
  };
}

/** The clock that matters most right now: acknowledgement until it stops, then resolution. */
export function primarySla(clocks: InboxRow["slaClocks"], now = new Date()): SlaView | null {
  const order = ["acknowledgement", "resolution", "closure"];
  const running = clocks
    .filter((c) => c.state === "running" || c.state === "paused")
    .sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
  const c = running[0] ?? clocks.find((c) => c.kind === "resolution");
  if (!c) return null;
  return slaView(c, now);
}

const RISK: Record<ClockHealth, number> = { breached: 0, near_breach: 1, on_track: 2, paused: 3, missed: 4, met: 5, cancelled: 6 };

export async function listInbox(actor: Actor, scope: InboxScope, now = new Date()) {
  const open = { status: { notIn: ["closed", "cancelled"] } };
  const where: Prisma.CaseWhereInput =
    scope === "mine"
      ? { ...open, caseManagerId: actor.id }
      : scope === "team"
        ? { ...open, teamId: { in: actor.ledTeamIds.length ? actor.ledTeamIds : actor.teamId ? [actor.teamId] : [] } }
        : scope === "significant"
          ? { ...open, significant: true }
          : open;

  const rows = await db.case.findMany({ where, include: inboxInclude, orderBy: { receivedAt: "desc" }, take: 200 });
  return rows
    .filter((c) => canReadCase(actor, scopeOf(c)))
    .map((c) => {
      const masked = shouldMask(actor, scopeOf(c));
      const view = masked ? maskCase(c) : c;
      return { ...view, masked, sla: primarySla(c.slaClocks, now) };
    })
    .sort((a, b) => {
      const ra = a.sla ? RISK[a.sla.health] : 9;
      const rb = b.sla ? RISK[b.sla.health] : 9;
      if (ra !== rb) return ra - rb;
      return (a.sla?.remainingMs ?? Infinity) - (b.sla?.remainingMs ?? Infinity);
    });
}

export async function inboxCounts(actor: Actor) {
  const open = { status: { notIn: ["closed", "cancelled"] } };
  const [mine, team, significant] = await Promise.all([
    db.case.count({ where: { ...open, caseManagerId: actor.id } }),
    db.case.count({ where: { ...open, teamId: { in: actor.ledTeamIds } } }),
    db.case.count({ where: { ...open, significant: true } }),
  ]);
  return { mine, team, significant };
}

const case360Include = {
  customer: { include: { policies: true } },
  bu: true,
  team: true,
  caseManager: { select: { id: true, name: true, email: true } },
  assessments: true,
  linksFrom: { include: { toCase: { select: { id: true, number: true, subject: true, status: true, stage: true } } } },
  linksTo: { include: { fromCase: { select: { id: true, number: true, subject: true, status: true, stage: true } } } },
  communications: { orderBy: { createdAt: "desc" } },
  notes: { orderBy: { createdAt: "desc" } },
  attachments: true,
  slaClocks: { orderBy: { createdAt: "asc" } },
  subTickets: { include: { bu: true, assignee: { select: { name: true } } } },
} satisfies Prisma.CaseInclude;

export type Case360 = Prisma.CaseGetPayload<{ include: typeof case360Include }>;

export async function getCase360(number: string, actor: Actor, context: "case_360" | "query_page" = "case_360") {
  const c = await db.case.findUnique({ where: { number }, include: case360Include });
  if (!c) return null;
  const scope = scopeOf(c);
  if (!canReadCase(actor, scope)) throw new ForbiddenError("You don't have access to this case.");
  const masked = shouldMask(actor, scope);
  await db.readLog.create({ data: { caseId: c.id, userId: actor.id, context, masked } });

  const previous = c.customerId
    ? await db.case.findMany({
        where: { customerId: c.customerId, id: { not: c.id } },
        select: { id: true, number: true, subject: true, status: true, stage: true, receivedAt: true, nature: true },
        orderBy: { receivedAt: "desc" },
        take: 10,
      })
    : [];

  // Masked viewers also lose the related records that would reveal the same details.
  const view: Case360 = masked
    ? {
        ...maskCase(c),
        customer: null,
        communications: [],
        notes: [],
        attachments: [],
        extra: {},
        assessments: c.assessments.map((a) => ({ ...a, rationale: null })),
      }
    : c;

  const authorIds = [...new Set([...c.notes.map((n) => n.authorId), ...c.communications.map((m) => m.authorId)].filter(Boolean))] as string[];
  const authors = Object.fromEntries(
    (await db.user.findMany({ where: { id: { in: authorIds } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]),
  );

  return {
    authors: authors as Record<string, string>,
    case: view,
    masked,
    previous,
    can: { edit: canEditCase(actor, scope), reallocate: canReallocate(actor, scope) },
  };
}

// ---------------------------------------------------------------------------
// Workspace home, notifications, search

/** Open cases this persona looks after: own cases, led teams, or everything for CE leadership. */
export function workloadWhere(actor: Actor): Prisma.CaseWhereInput {
  const open: Prisma.CaseWhereInput = { status: { notIn: ["closed", "cancelled"] } };
  const r = actor.roles;
  if (r.includes("admin") || r.includes("head_of_ce") || r.includes("ce_team") || r.includes("frontliner")) return open;
  if (r.includes("team_lead")) return { ...open, OR: [{ teamId: { in: actor.ledTeamIds } }, { caseManagerId: actor.id }] };
  return { ...open, caseManagerId: actor.id };
}

export function workloadLabel(actor: Actor): string {
  const r = actor.roles;
  if (r.includes("admin") || r.includes("head_of_ce") || r.includes("ce_team") || r.includes("frontliner")) return "All open cases";
  if (r.includes("team_lead")) return "Your teams' open cases";
  return "Your open cases";
}

export async function homeData(actor: Actor, now = new Date()) {
  const cases = await db.case.findMany({
    where: workloadWhere(actor),
    include: { slaClocks: true, caseManager: { select: { name: true } }, subTickets: { select: { buId: true } } },
    take: 500,
  });
  const visible = cases.filter((c) => canReadCase(actor, scopeOf(c)));
  const withSla = visible.map((c) => ({ c, sla: primarySla(c.slaClocks, now) }));

  const count = (f: (x: (typeof withSla)[number]) => boolean) => withSla.filter(f).length;
  const kpis = {
    open: visible.length,
    breached: count((x) => x.sla?.health === "breached"),
    nearBreach: count((x) => x.sla?.health === "near_breach"),
    awaitingAck: count((x) => !x.c.acknowledgedAt),
    toAssess: count((x) => x.c.stage === "assessment"),
    significant: count((x) => x.c.significant),
    vulnerable: count((x) => x.c.vulnerable),
  };

  const byStage = new Map<string, number>();
  const byNature = new Map<string, number>();
  for (const { c } of withSla) {
    byStage.set(c.stage, (byStage.get(c.stage) ?? 0) + 1);
    byNature.set(c.nature ?? "unassessed", (byNature.get(c.nature ?? "unassessed") ?? 0) + 1);
  }
  const slaHealth = {
    on_track: count((x) => x.sla?.health === "on_track"),
    near_breach: kpis.nearBreach,
    breached: kpis.breached,
    paused: count((x) => x.sla?.health === "paused"),
  };

  const since = new Date(now.getTime() - 7 * 86_400_000);
  const intake = await db.case.groupBy({ by: ["source"], where: { receivedAt: { gte: since } }, _count: { _all: true } });

  const attention = withSla
    .filter((x) => x.sla && (x.sla.health === "breached" || x.sla.health === "near_breach"))
    .sort((a, b) => a.sla!.remainingMs - b.sla!.remainingMs)
    .slice(0, 6)
    .map(({ c, sla }) => {
      const masked = shouldMask(actor, scopeOf(c));
      return { id: c.id, number: c.number, subject: c.subject, priority: c.priority, nature: c.nature, caseManager: c.caseManager?.name ?? null, sla: sla!, masked, complainantName: masked ? null : c.complainantName };
    });

  const ids = visible.map((c) => c.id);
  const notes = await db.caseNote.findMany({
    where: { caseId: { in: ids } },
    orderBy: { createdAt: "desc" },
    take: 8,
    include: { case: { select: { number: true, subject: true } } },
  });

  return {
    kpis,
    byStage: [...byStage.entries()].map(([k, v]) => ({ key: k, value: v })),
    byNature: [...byNature.entries()].map(([k, v]) => ({ key: k, value: v })),
    slaHealth,
    intake: intake.map((i) => ({ key: i.source, value: i._count._all })).sort((a, b) => b.value - a.value),
    attention,
    activity: notes.map((n) => ({ id: n.id, at: n.createdAt, kind: n.kind, body: n.body, number: n.case.number })),
  };
}

/** SLA alerts for the header bell: breached or near-breach cases in this persona's workload. */
export async function slaAlerts(actor: Actor, now = new Date()) {
  const cases = await db.case.findMany({
    where: { ...workloadWhere(actor), slaClocks: { some: { state: "running", nearBreachAlertedAt: { not: null } } } },
    include: { slaClocks: true, subTickets: { select: { buId: true } } },
    take: 50,
  });
  return cases
    .filter((c) => canReadCase(actor, scopeOf(c)))
    .map((c) => ({ number: c.number, subject: c.subject, sla: primarySla(c.slaClocks, now) }))
    .filter((x) => x.sla && (x.sla.health === "breached" || x.sla.health === "near_breach"))
    .sort((a, b) => a.sla!.remainingMs - b.sla!.remainingMs);
}

export interface FilterRow {
  sla: SlaView | null;
  acknowledgedAt: Date | null;
  stage: string;
  significant: boolean;
  vulnerable: boolean;
}

const atRisk = (r: FilterRow) => r.sla?.health === "breached" || r.sla?.health === "near_breach";

export const INBOX_FILTERS: Record<string, { label: string; test: (r: FilterRow) => boolean }> = {
  all: { label: "All", test: () => true },
  at_risk: { label: "At risk", test: atRisk },
  breached: { label: "Breached", test: (r) => r.sla?.health === "breached" },
  near_breach: { label: "Near breach", test: (r) => r.sla?.health === "near_breach" },
  awaiting_ack: { label: "Awaiting ack", test: (r) => !r.acknowledgedAt },
  to_assess: { label: "To assess", test: (r) => r.stage === "assessment" },
  significant: { label: "Significant", test: (r) => r.significant },
  vulnerable: { label: "Vulnerable", test: (r) => r.vulnerable },
};
export type InboxFilter = keyof typeof INBOX_FILTERS & string;

/** Text match on what this viewer can see: masked rows only match on number and subject. */
export function matchesText(
  r: { number: string; subject: string; complainantName: string | null; policyNo: string | null; claimNo: string | null; masked: boolean },
  q: string,
): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const fields = r.masked ? [r.number, r.subject] : [r.number, r.subject, r.complainantName, r.policyNo, r.claimNo];
  return fields.some((f) => f?.toLowerCase().includes(needle));
}

/** Global search across open and closed cases the viewer may read. */
export async function searchCases(actor: Actor, q: string, now = new Date()) {
  const needle = q.trim();
  if (!needle) return [];
  const rows = await db.case.findMany({
    where: {
      OR: [
        { number: { contains: needle, mode: "insensitive" } },
        { subject: { contains: needle, mode: "insensitive" } },
        { complainantName: { contains: needle, mode: "insensitive" } },
        { policyNo: { contains: needle, mode: "insensitive" } },
        { claimNo: { contains: needle, mode: "insensitive" } },
      ],
    },
    include: inboxInclude,
    orderBy: { receivedAt: "desc" },
    take: 100,
  });
  return rows
    .filter((c) => canReadCase(actor, scopeOf(c)))
    .map((c) => {
      const masked = shouldMask(actor, scopeOf(c));
      return { ...(masked ? maskCase(c) : c), masked, sla: primarySla(c.slaClocks, now) };
    })
    .filter((r) => matchesText(r, needle));
}
