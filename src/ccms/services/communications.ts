/**
 * Communication Module (BSD 3.1.2 and 3.1.4). The CCMS records and queues
 * messages; n8n does the actual sending and reports back delivery status.
 * SMS is a logged, simulated send in the POC.
 */
import type { Case, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { emit } from "@/integrations/n8n";
import { appendAudit } from "../audit";
import { stop } from "../sla";

type Tx = Prisma.TransactionClient;

export function renderTemplate(text: string, vars: Record<string, string | null | undefined>): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => vars[k] ?? "");
}

export function templateVars(c: Pick<Case, "number" | "subject" | "complainantName" | "targetResolutionAt">) {
  return {
    number: c.number,
    subject: c.subject,
    name: c.complainantName ?? "Customer",
    targetDate: c.targetResolutionAt
      ? c.targetResolutionAt.toLocaleDateString("en-SG", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Singapore" })
      : "",
  };
}

/** Queues the acknowledgement for the case's nature: email if we have an address, else SMS. */
export async function queueAcknowledgement(tx: Tx, c: Case, actorId: string | null) {
  const channel = c.complainantEmail ? "email" : c.complainantPhone ? "sms" : null;
  if (!channel) {
    await tx.caseNote.create({
      data: { caseId: c.id, kind: "system", body: "No email or phone on the case; acknowledgement must be sent manually." },
    });
    return null;
  }
  const template =
    (await tx.template.findUnique({ where: { key: `ack_${c.nature ?? "enquiry"}_${channel}` } })) ??
    (await tx.template.findUnique({ where: { key: `ack_default_${channel}` } }));
  const vars = templateVars(c);
  const comm = await tx.communication.create({
    data: {
      caseId: c.id,
      channel,
      direction: "outbound",
      purpose: "acknowledgement",
      to: channel === "email" ? c.complainantEmail : c.complainantPhone,
      subject: template?.subject ? renderTemplate(template.subject, vars) : `Your case ${c.number}`,
      body: template ? renderTemplate(template.body, vars) : `We have received your case ${c.number}.`,
      templateKey: template?.key,
      status: "queued",
      authorId: actorId,
    },
  });
  await emit(tx, "communication.queued", c.id, {
    communicationId: comm.id,
    channel,
    purpose: "acknowledgement",
    to: comm.to,
    subject: comm.subject,
    body: comm.body,
    simulated: channel === "sms",
  });
  return comm;
}

export async function queueMessage(
  caseId: string,
  msg: { channel: "email" | "sms"; to: string; subject?: string; body: string; purpose?: string },
  actorId: string,
) {
  return db.$transaction(async (tx) => {
    const comm = await tx.communication.create({
      data: { caseId, direction: "outbound", status: "queued", purpose: msg.purpose ?? "update", authorId: actorId, ...msg },
    });
    await emit(tx, "communication.queued", caseId, {
      communicationId: comm.id,
      channel: msg.channel,
      purpose: comm.purpose,
      to: msg.to,
      subject: msg.subject,
      body: msg.body,
      simulated: msg.channel === "sms",
    });
    await appendAudit(tx, { entity: "communication", entityId: comm.id, action: "queue", changes: { caseId, channel: msg.channel }, actorId });
    return comm;
  });
}

/** n8n reports the outcome of a send (or the SMS simulation). */
export async function recordDelivery(
  communicationId: string,
  status: "sent" | "delivered" | "failed",
  error: string | null,
  actorId: string | null,
) {
  return db.$transaction(async (tx) => {
    const comm = await tx.communication.update({
      where: { id: communicationId },
      data: {
        status,
        error,
        sentAt: status !== "failed" ? new Date() : undefined,
        deliveredAt: status === "delivered" ? new Date() : undefined,
      },
    });
    if (comm.purpose === "acknowledgement" && status !== "failed") await markAcknowledged(tx, comm.caseId, actorId);
    await appendAudit(tx, { entity: "communication", entityId: comm.id, action: `delivery_${status}`, changes: { error }, actorId });
    return comm;
  });
}

async function markAcknowledged(tx: Tx, caseId: string, actorId: string | null) {
  const c = await tx.case.findUniqueOrThrow({ where: { id: caseId } });
  if (c.acknowledgedAt) return;
  const now = new Date();
  await tx.case.update({
    where: { id: caseId },
    data: { acknowledgedAt: now, stage: c.stage === "acknowledgement" ? "assessment" : c.stage, updatedBy: actorId },
  });
  const clock = await tx.slaClock.findUnique({ where: { caseId_kind: { caseId, kind: "acknowledgement" } } });
  if (clock) {
    const s = stop(clock, now);
    await tx.slaClock.update({ where: { id: clock.id }, data: { state: s.state, stoppedAt: s.stoppedAt, breachedAt: s.breachedAt } });
  }
  await emit(tx, "case.stage_changed", caseId, { number: c.number, from: c.stage, to: "assessment" });
}

/** Case manager re-triggers a failed send. */
export async function resend(communicationId: string, actorId: string) {
  return db.$transaction(async (tx) => {
    const old = await tx.communication.findUniqueOrThrow({ where: { id: communicationId } });
    if (old.status !== "failed") throw new Error("Only failed messages can be re-sent.");
    const comm = await tx.communication.create({
      data: {
        caseId: old.caseId,
        channel: old.channel,
        direction: "outbound",
        purpose: old.purpose,
        to: old.to,
        subject: old.subject,
        body: old.body,
        templateKey: old.templateKey,
        status: "queued",
        authorId: actorId,
      },
    });
    await emit(tx, "communication.queued", old.caseId, {
      communicationId: comm.id,
      channel: comm.channel,
      purpose: comm.purpose,
      to: comm.to,
      subject: comm.subject,
      body: comm.body,
      simulated: comm.channel === "sms",
      resendOf: old.id,
    });
    await appendAudit(tx, { entity: "communication", entityId: comm.id, action: "resend", changes: { resendOf: old.id }, actorId });
    return comm;
  });
}

/** Inbound customer reply (from the mailbox poller): log it and alert the case manager. */
export async function recordInbound(caseId: string, msg: { channel: string; from?: string; subject?: string; body: string }, actorId: string | null) {
  return db.$transaction(async (tx) => {
    const c = await tx.case.findUniqueOrThrow({ where: { id: caseId } });
    const comm = await tx.communication.create({
      data: { caseId, channel: msg.channel, direction: "inbound", to: msg.from, subject: msg.subject, body: msg.body, status: "received", authorId: actorId },
    });
    await emit(tx, "case.customer_replied", caseId, { number: c.number, caseManagerId: c.caseManagerId, communicationId: comm.id });
    return comm;
  });
}
