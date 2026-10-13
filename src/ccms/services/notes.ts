/** Activity-stream composer: internal work notes and customer emails. */
import { db } from "@/lib/db";
import { appendAudit } from "../audit";
import { canEditCase, canReallocate, type Actor } from "../access";
import { scopeOf } from "../queries";
import { ForbiddenError } from "../session";
import { queueMessage } from "./communications";

async function scopeFor(caseId: string) {
  return db.case.findUniqueOrThrow({ where: { id: caseId }, include: { subTickets: { select: { buId: true } } } });
}

/** Case manager, or the team lead / Head of CE who can re-allocate it. */
export async function addWorkNote(caseId: string, body: string, actor: Actor) {
  const text = body.trim();
  if (!text) throw new Error("Write a note first.");
  const c = await scopeFor(caseId);
  const scope = scopeOf(c);
  if (!canEditCase(actor, scope) && !canReallocate(actor, scope)) throw new ForbiddenError("You can't add notes to this case.");
  return db.$transaction(async (tx) => {
    const note = await tx.caseNote.create({ data: { caseId, kind: "work_note", body: text, authorId: actor.id } });
    await appendAudit(tx, { entity: "case_note", entityId: note.id, action: "create", changes: { caseId }, actorId: actor.id });
    return note;
  });
}

/** Customer-visible email from the case manager, sent by n8n. */
export async function emailCustomer(caseId: string, subject: string, body: string, actor: Actor) {
  const c = await scopeFor(caseId);
  if (!canEditCase(actor, scopeOf(c))) throw new ForbiddenError("Only the assigned case manager can email the customer.");
  if (!c.complainantEmail) throw new Error("There's no customer email on this case.");
  if (!body.trim()) throw new Error("Write the message first.");
  return queueMessage(caseId, { channel: "email", to: c.complainantEmail, subject: subject.trim() || `Re: your case ${c.number}`, body: body.trim() }, actor.id);
}
