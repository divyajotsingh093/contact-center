/**
 * Runs against the local Postgres (DATABASE_URL). Exercises the full intake
 * pipeline with the local Kamios / Reels fallbacks.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { intakeCase } from "@/ccms/services/intake";
import { recordDelivery } from "@/ccms/services/communications";
import { slaTick } from "@/ccms/services/sla-service";
import { verifyAuditChain } from "@/ccms/audit";

const RUN = `itest-${Date.now()}`;

beforeAll(async () => {
  for (const k of Object.keys(process.env)) if (k.startsWith("KAMIOS_") || k.startsWith("REELS_")) delete process.env[k];
});

afterAll(async () => {
  await db.case.deleteMany({ where: { channelRef: { startsWith: RUN } } });
  await db.$disconnect();
});

describe("intake pipeline", () => {
  it("logs a significant MAS complaint, assesses all ten outputs, allocates and queues the acknowledgement", async () => {
    const r = await intakeCase(
      {
        source: "email",
        channelRef: `${RUN}-1`,
        subject: "Unacceptable delay on my claim",
        sender: "Tan Mei Ling <meiling.tan@example.com>",
        text:
          "My claim no CL1234567 has been pending for 3 months and I have had to pay $12,000 in hospital bills out of pocket. " +
          "My agent AG1234 never replied. I want my claim paid this week or I will write to MAS and the Straits Times.\n\nRegards,\nTan Mei Ling",
      },
      null,
    );
    expect(r.sources).toEqual({ extraction: "local", assessment: "local", decisions: "local" });

    const c = await db.case.findUniqueOrThrow({
      where: { id: r.caseId },
      include: { assessments: true, slaClocks: true, communications: true, caseManager: true, team: true },
    });
    expect(c.nature).toBe("complaint");
    expect(c.regulatoryFlag).toBe("MAS");
    expect(c.significant).toBe(true);
    expect(c.priority).toBe("P1");
    expect(c.policyNo).toBe("LF12345678"); // filled from EDS via the email address
    expect(c.team?.name).toBe("CE Significant");
    expect(c.caseManager?.email).toBe("grace.cm@income.demo"); // the senior manager
    expect(c.assessments).toHaveLength(10);
    for (const a of c.assessments) {
      expect(a.confidence).toBeGreaterThan(0);
      expect(a.rationale).toBeTruthy();
    }
    expect(c.slaClocks.map((s) => s.kind).sort()).toEqual(["acknowledgement", "resolution"]);
    expect(c.communications).toHaveLength(1);
    expect(c.communications[0]).toMatchObject({ purpose: "acknowledgement", channel: "email", status: "queued" });
    expect(c.communications[0].body).toContain(c.number);

    const events = await db.outboxEvent.findMany({ where: { caseId: c.id } });
    expect(events.map((e) => e.type)).toEqual(
      expect.arrayContaining(["case.created", "case.assessed", "case.assigned", "case.bu_notification_prompt", "communication.queued"]),
    );

    // n8n reports delivery: the ack SLA stops and the case moves to assessment.
    await recordDelivery(c.communications[0].id, "delivered", null, null);
    const after = await db.case.findUniqueOrThrow({ where: { id: c.id }, include: { slaClocks: true } });
    expect(after.stage).toBe("assessment");
    expect(after.acknowledgedAt).not.toBeNull();
    expect(after.slaClocks.find((s) => s.kind === "acknowledgement")?.state).toBe("met");
  });

  it("routes a vulnerable customer's health appeal to the owning BU with confidential handling", async () => {
    const r = await intakeCase(
      {
        source: "letter",
        channelRef: `${RUN}-2`,
        subject: "Appeal against claim decision",
        text: "I would like to appeal the decision on my hospital claim under policy HS20001111. Please reconsider.\nMy name is Lim Ah Huat",
      },
      null,
    );
    const c = await db.case.findUniqueOrThrow({ where: { id: r.caseId }, include: { bu: true } });
    expect(c.nature).toBe("appeal");
    expect(c.bu?.code).toBe("HEALTH");
    expect(c.vulnerable).toBe(true);
    expect(c.confidential).toBe(true);
  });

  it("raises near-breach and breach alerts exactly once", async () => {
    const r = await intakeCase({ source: "web_form", channelRef: `${RUN}-3`, subject: "Question", text: "How do I update my address?" }, null);
    const clock = await db.slaClock.findUniqueOrThrow({ where: { caseId_kind: { caseId: r.caseId, kind: "acknowledgement" } } });
    const late = new Date(clock.targetAt.getTime() + 60_000);
    const first = await slaTick(late, { caseIds: [r.caseId] });
    expect(first.breached).toBeGreaterThanOrEqual(1);
    const types = (await db.outboxEvent.findMany({ where: { caseId: r.caseId, type: { startsWith: "sla." } } })).map((e) => e.type);
    expect(types.sort()).toEqual(["sla.breached", "sla.near_breach"]);
    await slaTick(late, { caseIds: [r.caseId] });
    expect(await db.outboxEvent.count({ where: { caseId: r.caseId, type: { startsWith: "sla." } } })).toBe(2);
  });

  it("keeps the audit chain verifiable", async () => {
    expect((await verifyAuditChain()).ok).toBe(true);
  });
});
