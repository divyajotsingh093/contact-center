/**
 * Sub-tickets (BSD 3.1.4): during investigation the case manager asks a BU for
 * facts; BU staff answer; the case manager re-requests or closes. Each step is
 * audited and emits an event so n8n can notify the BU and chase overdue requests.
 */
import { db } from "@/lib/db";
import { emit } from "@/integrations/n8n";
import { addWorkingDays } from "@/lib/working-days";
import { appendAudit } from "../audit";
import { canEditCase, isAdmin, type Actor } from "../access";
import { scopeOf } from "../queries";
import { ForbiddenError } from "../session";
import { nextNumber } from "./numbers";

/** Working days a BU has to answer, and to answer a re-request. */
export const SUBTICKET_DUE_DAYS = 3;
export const REREQUEST_DUE_DAYS = 2;
const OPEN_STAGES = ["investigation", "resolution"];

async function caseFor(caseId: string, actor: Actor) {
  const c = await db.case.findUniqueOrThrow({ where: { id: caseId }, include: { subTickets: { select: { buId: true } } } });
  if (!canEditCase(actor, scopeOf(c))) throw new ForbiddenError("Only the assigned case manager can manage sub-tickets.");
  return c;
}

async function ticketFor(subTicketId: string) {
  return db.subTicket.findUniqueOrThrow({ where: { id: subTicketId }, include: { case: { include: { subTickets: { select: { buId: true } } } }, bu: true } });
}

export async function raiseSubTicket(caseId: string, input: { buId: string; request: string }, actor: Actor, now = new Date()) {
  const request = input.request.trim();
  if (!request) throw new Error("Say what you need from the BU.");
  const c = await caseFor(caseId, actor);
  if (!OPEN_STAGES.includes(c.stage)) throw new Error("Sub-tickets can be raised once the assessment is confirmed.");
  const bu = await db.businessUnit.findUniqueOrThrow({ where: { id: input.buId } });
  return db.$transaction(async (tx) => {
    const number = await nextNumber(tx, "subticket", "SUB-");
    const dueAt = addWorkingDays(now, SUBTICKET_DUE_DAYS);
    const t = await tx.subTicket.create({
      data: { number, caseId, buId: bu.id, senderId: actor.id, request, dueAt, messages: { create: { direction: "request", body: request, authorId: actor.id } } },
    });
    await appendAudit(tx, { entity: "sub_ticket", entityId: t.id, action: "create", changes: { caseId, bu: bu.code, dueAt }, actorId: actor.id });
    await emit(tx, "subticket.created", caseId, { number, caseNumber: c.number, buCode: bu.code, dueAt: dueAt.toISOString() });
    return t;
  });
}

/** BU staff of the ticket's BU answer it. */
export async function respondSubTicket(subTicketId: string, body: string, actor: Actor, now = new Date()) {
  const text = body.trim();
  if (!text) throw new Error("Write the response first.");
  const t = await ticketFor(subTicketId);
  if (!isAdmin(actor) && !(actor.roles.includes("bu_staff") && actor.buId === t.buId)) throw new ForbiddenError(`Only ${t.bu.name} staff can answer this sub-ticket.`);
  if (t.status === "closed") throw new Error("This sub-ticket is closed.");
  return db.$transaction(async (tx) => {
    await tx.subTicket.update({
      where: { id: t.id },
      data: { status: "responded", respondedAt: now, assigneeId: t.assigneeId ?? actor.id, messages: { create: { direction: "response", body: text, authorId: actor.id } } },
    });
    await appendAudit(tx, { entity: "sub_ticket", entityId: t.id, action: "respond", changes: {}, actorId: actor.id });
    await emit(tx, "subticket.responded", t.caseId, { number: t.number, caseNumber: t.case.number, buCode: t.bu.code });
  });
}

/** The case manager asks again when the answer isn't enough. */
export async function reRequestSubTicket(subTicketId: string, body: string, actor: Actor, now = new Date()) {
  const text = body.trim();
  if (!text) throw new Error("Say what's still missing.");
  const t = await ticketFor(subTicketId);
  if (!canEditCase(actor, scopeOf(t.case))) throw new ForbiddenError("Only the assigned case manager can re-request.");
  if (t.status === "closed") throw new Error("This sub-ticket is closed.");
  return db.$transaction(async (tx) => {
    const dueAt = addWorkingDays(now, REREQUEST_DUE_DAYS);
    await tx.subTicket.update({
      where: { id: t.id },
      data: { status: "re_requested", dueAt, messages: { create: { direction: "re_request", body: text, authorId: actor.id } } },
    });
    await appendAudit(tx, { entity: "sub_ticket", entityId: t.id, action: "re_request", changes: { dueAt }, actorId: actor.id });
    await emit(tx, "subticket.created", t.caseId, { number: t.number, caseNumber: t.case.number, buCode: t.bu.code, dueAt: dueAt.toISOString(), reRequest: true });
  });
}

export async function closeSubTicket(subTicketId: string, actor: Actor) {
  const t = await ticketFor(subTicketId);
  if (!canEditCase(actor, scopeOf(t.case))) throw new ForbiddenError("Only the assigned case manager can close a sub-ticket.");
  return db.$transaction(async (tx) => {
    await tx.subTicket.update({ where: { id: t.id }, data: { status: "closed" } });
    await appendAudit(tx, { entity: "sub_ticket", entityId: t.id, action: "close", changes: {}, actorId: actor.id });
  });
}

/** Sub-tickets for the Sub-tickets screen: BU staff see their BU's, case managers see those on their cases. */
export async function listSubTickets(actor: Actor) {
  const where = isAdmin(actor)
    ? {}
    : actor.roles.includes("bu_staff") && actor.buId
      ? { buId: actor.buId }
      : { case: { caseManagerId: actor.id } };
  const rows = await db.subTicket.findMany({
    where,
    include: { bu: true, assignee: { select: { name: true } }, case: { select: { number: true, subject: true, priority: true } }, messages: { orderBy: { createdAt: "desc" }, take: 1 } },
    orderBy: [{ status: "asc" }, { dueAt: "asc" }],
    take: 200,
  });
  // Waiting on the BU first, then waiting on the case manager, then closed.
  const rank: Record<string, number> = { open: 0, re_requested: 0, responded: 1, closed: 2 };
  return rows.sort((a, b) => (rank[a.status] ?? 3) - (rank[b.status] ?? 3) || a.dueAt.getTime() - b.dueAt.getTime());
}
