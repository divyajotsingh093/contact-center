/**
 * Outbox for n8n. Every state change records an event in the same transaction
 * as the change; delivery to the n8n webhook happens afterwards and is retried
 * by the next flush (or n8n polls /api/events instead).
 */
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export type EventType =
  | "case.created"
  | "case.acknowledgement_due"
  | "case.assessed"
  | "case.assigned"
  | "case.stage_changed"
  | "case.customer_replied"
  | "case.bu_notification_prompt"
  | "case.escalated"
  | "case.closed"
  | "case.reopened"
  | "communication.queued"
  | "subticket.created"
  | "subticket.responded"
  | "subticket.overdue"
  | "sla.near_breach"
  | "sla.breached"
  | "approval.requested"
  | "rca.created"
  | "qa.sampled";

type Client = Prisma.TransactionClient | typeof db;

export async function emit(client: Client, type: EventType, caseId: string | null, payload: Record<string, unknown>) {
  await client.outboxEvent.create({ data: { type, caseId, payload: payload as Prisma.InputJsonValue } });
}

/** Push undelivered events to n8n. Safe to call often; no-op without a webhook URL. */
export async function flushOutbox(limit = 50): Promise<{ delivered: number; failed: number }> {
  const url = process.env.N8N_EVENT_WEBHOOK_URL;
  if (!url) return { delivered: 0, failed: 0 };
  const events = await db.outboxEvent.findMany({
    where: { deliveredAt: null, attempts: { lt: 10 } },
    orderBy: { seq: "asc" },
    take: limit,
  });
  let delivered = 0;
  let failed = 0;
  for (const e of events) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(process.env.N8N_WEBHOOK_SECRET ? { "x-ccms-secret": process.env.N8N_WEBHOOK_SECRET } : {}),
        },
        body: JSON.stringify({ id: e.id, seq: e.seq, type: e.type, caseId: e.caseId, payload: e.payload, at: e.createdAt }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await db.outboxEvent.update({ where: { id: e.id }, data: { deliveredAt: new Date(), attempts: { increment: 1 } } });
      delivered++;
    } catch (err) {
      await db.outboxEvent.update({
        where: { id: e.id },
        data: { attempts: { increment: 1 }, lastError: String(err) },
      });
      failed++;
    }
  }
  return { delivered, failed };
}
