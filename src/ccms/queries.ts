/** Read models for the screens. Access checks and masking happen here. */
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { canEditCase, canReadCase, canReallocate, maskCase, shouldMask, type Actor, type CaseScope } from "./access";
import { health, remainingMs, type ClockHealth } from "./sla";
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
  targetAt: Date;
}

/** The clock that matters most right now: acknowledgement until it stops, then resolution. */
export function primarySla(clocks: InboxRow["slaClocks"], now = new Date()): SlaView | null {
  const order = ["acknowledgement", "resolution", "closure"];
  const running = clocks
    .filter((c) => c.state === "running" || c.state === "paused")
    .sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
  const c = running[0] ?? clocks.find((c) => c.kind === "resolution");
  if (!c) return null;
  return { kind: c.kind, health: health(c, now), remainingMs: remainingMs(c, now), targetAt: c.targetAt };
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

  return {
    case: view,
    masked,
    previous,
    can: { edit: canEditCase(actor, scope), reallocate: canReallocate(actor, scope) },
  };
}
