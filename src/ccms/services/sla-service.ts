/**
 * The SLA tick (run by n8n every few minutes) plus extension requests.
 */
import { db } from "@/lib/db";
import { addWorkingDays } from "@/lib/working-days";
import { decide } from "@/integrations/reels";
import { emit } from "@/integrations/n8n";
import { appendAudit } from "../audit";
import { dueAlerts, extend } from "../sla";

export async function slaTick(now = new Date()) {
  const clocks = await db.slaClock.findMany({
    where: { state: "running", OR: [{ nearBreachAlertedAt: null }, { breachedAt: null }] },
    include: { case: { select: { id: true, number: true, nature: true, priority: true, caseManagerId: true, teamId: true, bu: { select: { code: true } } } } },
  });
  let nearBreach = 0;
  let breached = 0;
  for (const clock of clocks) {
    const alerts = dueAlerts(clock, now);
    if (!alerts.length) continue;
    const thresholds = await decide<{ breachNotify: string }>("sla_thresholds", {
      nature: clock.case.nature,
      priority: clock.case.priority,
      buCode: clock.case.bu?.code,
    });
    await db.$transaction(async (tx) => {
      const base = { number: clock.case.number, kind: clock.kind, targetAt: clock.targetAt, caseManagerId: clock.case.caseManagerId, teamId: clock.case.teamId };
      if (alerts.includes("near_breach")) {
        await tx.slaClock.update({ where: { id: clock.id }, data: { nearBreachAlertedAt: now } });
        await emit(tx, "sla.near_breach", clock.caseId, { ...base, nearBreachPct: clock.nearBreachPct });
        nearBreach++;
      }
      if (alerts.includes("breached")) {
        await tx.slaClock.update({ where: { id: clock.id }, data: { breachedAt: now } });
        await emit(tx, "sla.breached", clock.caseId, { ...base, notify: String(thresholds.outputs.breachNotify ?? "").split(",").filter(Boolean) });
        await tx.caseNote.create({ data: { caseId: clock.caseId, kind: "system", body: `${clock.kind} SLA breached.` } });
        breached++;
      }
    });
  }
  return { checked: clocks.length, nearBreach, breached };
}

export async function requestExtension(caseId: string, kind: string, extraWorkingDays: number, reason: string, actorId: string) {
  return db.$transaction(async (tx) => {
    const clock = await tx.slaClock.findUniqueOrThrow({ where: { caseId_kind: { caseId, kind } } });
    const ext = await tx.slaExtension.create({
      data: { slaClockId: clock.id, requestedById: actorId, reason, extraWorkingDays },
    });
    await tx.approval.create({ data: { kind: "sla_extension", slaExtensionId: ext.id, approverRole: "team_lead" } });
    await emit(tx, "approval.requested", caseId, { kind: "sla_extension", extensionId: ext.id, extraWorkingDays });
    await appendAudit(tx, { entity: "sla_extension", entityId: ext.id, action: "request", changes: { kind, extraWorkingDays, reason }, actorId });
    return ext;
  });
}

export async function decideExtension(approvalId: string, approve: boolean, comment: string | null, actorId: string) {
  return db.$transaction(async (tx) => {
    const approval = await tx.approval.findUniqueOrThrow({
      where: { id: approvalId },
      include: { slaExtension: { include: { slaClock: true } } },
    });
    if (approval.kind !== "sla_extension" || !approval.slaExtension) throw new Error("Not an SLA extension approval.");
    if (approval.status !== "pending") throw new Error("Already decided.");
    const now = new Date();
    await tx.approval.update({
      where: { id: approvalId },
      data: { status: approve ? "approved" : "rejected", approverId: actorId, comment, decidedAt: now },
    });
    const ext = approval.slaExtension;
    await tx.slaExtension.update({ where: { id: ext.id }, data: { status: approve ? "approved" : "rejected" } });
    if (approve) {
      const clock = ext.slaClock;
      const next = extend(clock, addWorkingDays(clock.targetAt, ext.extraWorkingDays), now);
      await tx.slaClock.update({
        where: { id: clock.id },
        data: { targetAt: next.targetAt, nearBreachAlertedAt: next.nearBreachAlertedAt, breachedAt: next.breachedAt },
      });
      if (clock.kind === "resolution") {
        await tx.case.update({ where: { id: clock.caseId }, data: { targetResolutionAt: next.targetAt } });
      }
    }
    await appendAudit(tx, { entity: "sla_extension", entityId: ext.id, action: approve ? "approve" : "reject", changes: { comment }, actorId });
    return { approved: approve };
  });
}
