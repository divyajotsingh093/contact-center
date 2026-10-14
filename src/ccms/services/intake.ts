/**
 * BSD 3.1.1 to 3.1.3: intake, acknowledgement, data gathering, preliminary
 * assessment, duplicate linking and assignment, as one pipeline.
 *
 * AI and rules calls happen before the database transaction (they may be slow
 * network calls); everything they produce is then written atomically.
 */
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { addWorkingDays } from "@/lib/working-days";
import { kamios, type DuplicateMatch, type ExtractedFields } from "@/integrations/kamios";
import { decide } from "@/integrations/reels";
import { lookupEds } from "@/integrations/eds";
import { emit } from "@/integrations/n8n";
import { appendAudit } from "../audit";
import { pickCaseManager } from "../allocation";
import { SOURCE_LABELS, type AssessmentOutput, type Source } from "../constants";
import { nextNumber } from "./numbers";
import { queueAcknowledgement } from "./communications";

export interface IntakeInput {
  source: string;
  text: string;
  subject?: string;
  sender?: string;
  channelRef?: string;
  receivedAt?: Date;
  attachments?: { fileName: string; mimeType: string; sizeBytes?: number; extractedText?: string }[];
  /** Values keyed in on the web form or by a frontliner; they win over AI extraction. */
  overrides?: Partial<Record<keyof ExtractedFields, unknown>>;
}

export interface IntakeResult {
  caseId: string;
  number: string;
  duplicates: DuplicateMatch[];
  reopenedFrom: string | null;
  sources: { extraction: string; assessment: string; decisions: string };
}

type AssessmentRow = { output: AssessmentOutput; value: string; confidence: number; rationale: string; source: string };

const yes = (b: boolean) => (b ? "yes" : "no");

export async function intakeCase(input: IntakeInput, actorId: string | null): Promise<IntakeResult> {
  const receivedAt = input.receivedAt ?? new Date();

  // 1. Extraction (Kamios)
  const { result: ex, source: extractionSource } = await kamios.extract({
    source: input.source,
    text: input.text,
    subject: input.subject,
    sender: input.sender,
    attachments: input.attachments,
  });
  const o = input.overrides ?? {};
  const pick = <K extends keyof ExtractedFields>(k: K): ExtractedFields[K]["value"] =>
    (o[k] !== undefined && o[k] !== "" ? o[k] : ex[k].value) as ExtractedFields[K]["value"];

  // 2. Data gathering (EDS mock)
  const eds = await lookupEds({
    email: pick("complainantEmail"),
    phone: pick("complainantPhone"),
    policyNo: pick("policyNo"),
  });
  const attrs = eds.attributes;

  // 3. Earlier cases by the same customer, for linking and the reopen check.
  const email = pick("complainantEmail");
  const prior = await db.case.findMany({
    where: {
      OR: [
        ...(eds.customerId ? [{ customerId: eds.customerId }] : []),
        ...(email ? [{ complainantEmail: { equals: email, mode: "insensitive" as const } }] : []),
      ],
    },
    orderBy: { receivedAt: "desc" },
    take: 20,
  });
  const { result: dupes } = prior.length
    ? await kamios.findDuplicates({
        subject: pick("subject"),
        description: pick("description"),
        candidates: prior.map((c) => ({
          id: c.id,
          number: c.number,
          subject: c.subject,
          description: c.description,
          status: c.status,
          closedAt: c.closedAt?.toISOString() ?? null,
        })),
        now: receivedAt.toISOString(),
      })
    : { result: [] as DuplicateMatch[] };

  // A message on a closed case after its closure window opens a new linked case
  // for the same case manager (BSD 3.1.3, demo scenario 3).
  const closedMatch = dupes.find((d) => d.action === "new_linked");
  const closedCase = closedMatch ? prior.find((p) => p.id === closedMatch.caseId) : undefined;
  const reopenedFrom =
    closedCase && (!closedCase.closureSlaAt || closedCase.closureSlaAt < receivedAt) ? closedCase : undefined;

  // 4. Preliminary assessment: AI parts (Kamios) + rules parts (Reels)
  const { result: ai, source: assessmentSource } = await kamios.assess({
    subject: pick("subject"),
    description: pick("description"),
    nature: pick("nature"),
    agentInvolved: Boolean(pick("agentInvolved")),
    agentCode: (pick("agentCode") as string | null) ?? null,
    customer: eds.customerId
      ? { vulnerable: attrs.vulnerable, vulnerableType: attrs.vulnerableType, grade: attrs.customerGrade, vip: attrs.vip }
      : null,
    priorCases: prior.map((p) => ({ number: p.number, status: p.status, subject: p.subject, closedAt: p.closedAt?.toISOString() ?? null })),
  });

  const nature = String(o.nature ?? ai.case_nature.value ?? "enquiry");
  const lineOfBusiness = (pick("lineOfBusiness") as string | null) ?? attrs.lineOfBusiness;
  const significant = nature === "complaint" && Boolean(ai.potential_significant.value);
  const vulnerable = attrs.vulnerable;
  const vip = attrs.vip;

  const classification = await decide<{ regulatoryFlag: string; fidrec: boolean; dataClassification: string }>(
    "case_classification",
    {
      regulatorHint: pick("regulatorHint"),
      lineOfBusiness,
      mentionsFidrec: pick("mentionsFidrec"),
      vulnerable,
      vip,
      sensitiveHealth: lineOfBusiness === "health",
    },
  );
  const { regulatoryFlag, fidrec, dataClassification } = classification.outputs;

  const pt = await decide<{ priority: string; targetWorkingDays: number }>("priority_target", {
    nature,
    significant,
    regulatoryFlag,
    fidrec,
    vulnerable,
  });
  const targetResolutionAt = addWorkingDays(receivedAt, Number(pt.outputs.targetWorkingDays));

  const alloc = await decide<{ buCode: string; teamName: string; requiredSkill: string }>("allocation", {
    nature,
    lineOfBusiness,
    significant,
    fidrec,
    vulnerable,
    subType: pick("subType"),
  });
  const sla = await decide<{ ackWorkingDays: number; nearBreachPct: number }>("sla_thresholds", {
    nature,
    priority: pt.outputs.priority,
    buCode: alloc.outputs.buCode,
  });
  const notify = await decide<{ notifyDistribution: boolean; notifyCompliance: boolean }>("bu_notification", {
    agentInvolved: pick("agentInvolved"),
    regulatoryFlag,
    nature,
  });
  const decisionSource = [classification, pt, alloc, sla].some((d) => d.source === "reels") ? "reels" : "local";

  const openLinks = dupes.filter((d) => d.action !== "new_linked");
  const assessments: AssessmentRow[] = [
    { output: "case_nature", value: nature, confidence: ai.case_nature.confidence, rationale: ai.case_nature.rationale, source: assessmentSource },
    { output: "regulatory_flag", value: regulatoryFlag, confidence: ex.regulatorHint.confidence, rationale: classification.rationale, source: classification.source },
    { output: "fidrec", value: yes(fidrec), confidence: ex.mentionsFidrec.confidence, rationale: classification.rationale, source: classification.source },
    {
      output: "reopened_case",
      value: yes(Boolean(reopenedFrom) || Boolean(ai.reopened_case.value)),
      confidence: reopenedFrom ? 0.9 : ai.reopened_case.confidence,
      rationale: reopenedFrom ? `Customer wrote again after ${reopenedFrom.number} closed` : ai.reopened_case.rationale,
      source: assessmentSource,
    },
    {
      output: "linked_cases",
      value: openLinks.map((d) => d.number).join(", ") || "none",
      confidence: openLinks[0]?.score ?? 0.8,
      rationale: openLinks.map((d) => d.reason).join("; ") || "No similar open cases for this customer",
      source: assessmentSource,
    },
    { output: "priority", value: pt.outputs.priority, confidence: 0.85, rationale: pt.rationale, source: pt.source },
    {
      output: "target_resolution_date",
      value: targetResolutionAt.toISOString().slice(0, 10),
      confidence: 0.85,
      rationale: `${pt.outputs.targetWorkingDays} working days: ${pt.rationale}`,
      source: pt.source,
    },
    { output: "potential_chr", value: yes(Boolean(ai.potential_chr.value)), confidence: ai.potential_chr.confidence, rationale: ai.potential_chr.rationale, source: assessmentSource },
    {
      output: "potential_significant",
      value: yes(significant),
      confidence: ai.potential_significant.confidence,
      rationale: ai.potential_significant.rationale,
      source: assessmentSource,
    },
    { output: "data_classification", value: dataClassification, confidence: 0.8, rationale: classification.rationale, source: classification.source },
  ];

  // 5. Write everything in one transaction.
  const created = await db.$transaction(async (tx) => {
    const bu = await tx.businessUnit.findUnique({ where: { code: alloc.outputs.buCode } });
    const team = bu ? await tx.team.findFirst({ where: { buId: bu.id, name: alloc.outputs.teamName } }) : null;

    let caseManagerId: string | null = null;
    if (reopenedFrom?.caseManagerId) {
      caseManagerId = reopenedFrom.caseManagerId;
    } else if (team) {
      caseManagerId = await allocateWithinTeam(tx, team.id, alloc.outputs.requiredSkill);
    }

    const number = await nextNumber(tx, "case", `CCMS-${receivedAt.getFullYear()}-`);
    const data: Prisma.CaseUncheckedCreateInput = {
      number,
      stage: "acknowledgement",
      status: "open",
      nature,
      subType: pick("subType") as string | null,
      source: input.source,
      channelRef: input.channelRef,
      receivedAt,
      subject: pick("subject") as string,
      description: pick("description") as string,
      customerId: eds.customerId,
      complainantName: (pick("complainantName") as string | null) ?? attrs.customerName,
      complainantEmail: email as string | null,
      complainantPhone: pick("complainantPhone") as string | null,
      policyNo: (pick("policyNo") as string | null) ?? attrs.policyNo,
      lineOfBusiness,
      product: attrs.product,
      claimNo: (pick("claimNo") as string | null) ?? attrs.claimNo,
      agentCode: (pick("agentCode") as string | null) ?? attrs.agentCode,
      agentInvolved: Boolean(pick("agentInvolved")),
      desiredOutcome: pick("desiredOutcome") as string | null,
      regulatoryFlag,
      fidrec: Boolean(fidrec),
      priority: pt.outputs.priority,
      significant,
      potentialChr: Boolean(ai.potential_chr.value),
      dataClassification,
      confidential: ["confidential", "restricted"].includes(dataClassification),
      vulnerable,
      vip,
      reopened: Boolean(reopenedFrom),
      buId: bu?.id,
      teamId: team?.id,
      caseManagerId,
      targetResolutionAt,
      extra: {
        eds: attrs,
        extraction: { source: extractionSource, fields: ex },
        notify: notify.outputs,
      } as unknown as Prisma.InputJsonValue,
      createdBy: actorId,
      updatedBy: actorId,
    };
    const c = await tx.case.create({ data });

    await tx.caseAssessment.createMany({
      data: assessments.map((a) => ({
        caseId: c.id,
        output: a.output,
        aiValue: a.value,
        finalValue: a.value,
        confidence: a.confidence,
        rationale: a.rationale,
        source: a.source,
      })),
    });

    for (const d of openLinks) {
      await tx.caseLink.create({ data: { fromCaseId: c.id, toCaseId: d.caseId, kind: "duplicate", score: d.score, reason: d.reason } });
    }
    if (reopenedFrom) {
      await tx.caseLink.create({
        data: { fromCaseId: c.id, toCaseId: reopenedFrom.id, kind: "reopened_from", reason: "Customer wrote after the closure window" },
      });
    }

    if (input.attachments?.length) {
      await tx.attachment.createMany({
        data: input.attachments.map((a) => ({
          caseId: c.id,
          fileName: a.fileName,
          mimeType: a.mimeType,
          sizeBytes: a.sizeBytes ?? 0,
          extractedText: a.extractedText,
        })),
      });
    }

    await tx.slaClock.createMany({
      data: [
        {
          caseId: c.id,
          kind: "acknowledgement",
          startedAt: receivedAt,
          targetAt: addWorkingDays(receivedAt, Number(sla.outputs.ackWorkingDays)),
          nearBreachPct: Number(sla.outputs.nearBreachPct),
        },
        {
          caseId: c.id,
          kind: "resolution",
          startedAt: receivedAt,
          targetAt: targetResolutionAt,
          nearBreachPct: Number(sla.outputs.nearBreachPct),
        },
      ],
    });

    await tx.caseNote.create({
      data: {
        caseId: c.id,
        kind: "system",
        body: `Logged from ${SOURCE_LABELS[input.source as Source] ?? input.source}. Allocated to ${alloc.outputs.teamName} (${alloc.rationale}).${
          reopenedFrom ? ` New linked case for ${reopenedFrom.number}.` : ""
        }`,
      },
    });

    await appendAudit(tx, { entity: "case", entityId: c.id, action: "create", changes: { number, nature, source: input.source }, actorId });
    await emit(tx, "case.created", c.id, { number, nature, source: input.source, priority: pt.outputs.priority, significant });
    await emit(tx, "case.assessed", c.id, { number, assessments: assessments.map(({ output, value, confidence }) => ({ output, value, confidence })) });
    if (caseManagerId) await emit(tx, "case.assigned", c.id, { number, caseManagerId, teamId: team?.id });
    if (notify.outputs.notifyDistribution || notify.outputs.notifyCompliance) {
      await emit(tx, "case.bu_notification_prompt", c.id, { number, ...notify.outputs });
    }
    if (reopenedFrom) await emit(tx, "case.reopened", c.id, { number, from: reopenedFrom.number });

    await queueAcknowledgement(tx, c, actorId);
    return c;
  });

  return {
    caseId: created.id,
    number: created.number,
    duplicates: dupes,
    reopenedFrom: reopenedFrom?.number ?? null,
    sources: { extraction: extractionSource, assessment: assessmentSource, decisions: decisionSource },
  };
}

async function allocateWithinTeam(tx: Prisma.TransactionClient, teamId: string, requiredSkill: string | null) {
  const members = await tx.user.findMany({
    where: { teamId, active: true, roles: { has: "case_manager" } },
    select: { id: true, name: true, skills: true, _count: { select: { managedCases: { where: { status: { notIn: ["closed", "cancelled"] } } } } } },
  });
  const chosen = pickCaseManager(
    members.map((m) => ({ id: m.id, name: m.name, skills: m.skills, openCases: m._count.managedCases })),
    requiredSkill || null,
  );
  return chosen?.id ?? null;
}
