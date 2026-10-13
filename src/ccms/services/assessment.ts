/**
 * Case manager review of the preliminary assessment (BSD 3.1.3). AI output is
 * advisory: each value can be accepted or revised, and the case follows the
 * case manager's final values.
 */
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { emit } from "@/integrations/n8n";
import { appendAudit } from "../audit";
import { ASSESSMENT_OUTPUTS, DATA_CLASSIFICATIONS, NATURES, PRIORITIES, REGULATORS, type AssessmentOutput } from "../constants";
import { canEditCase, type Actor } from "../access";
import { ForbiddenError } from "../session";
import { scopeOf } from "../queries";

export class InvalidValueError extends Error {}

const YES_NO = ["yes", "no"];

/** Allowed values per output, and how a final value maps onto case fields. */
const OUTPUT_RULES: Record<AssessmentOutput, { allowed?: readonly string[]; apply?: (v: string) => Prisma.CaseUpdateInput }> = {
  case_nature: { allowed: NATURES, apply: (v) => ({ nature: v }) },
  regulatory_flag: { allowed: REGULATORS, apply: (v) => ({ regulatoryFlag: v }) },
  fidrec: { allowed: YES_NO, apply: (v) => ({ fidrec: v === "yes" }) },
  reopened_case: { allowed: YES_NO, apply: (v) => ({ reopened: v === "yes" }) },
  linked_cases: {},
  priority: { allowed: PRIORITIES, apply: (v) => ({ priority: v }) },
  target_resolution_date: {
    apply: (v) => {
      const d = new Date(`${v}T18:00:00+08:00`);
      if (isNaN(d.getTime())) throw new InvalidValueError("Target resolution date must be YYYY-MM-DD.");
      return { targetResolutionAt: d };
    },
  },
  potential_chr: { allowed: YES_NO, apply: (v) => ({ potentialChr: v === "yes" }) },
  potential_significant: { allowed: YES_NO, apply: (v) => ({ significant: v === "yes" }) },
  data_classification: {
    allowed: DATA_CLASSIFICATIONS,
    apply: (v) => ({ dataClassification: v, confidential: v === "confidential" || v === "restricted" }),
  },
};

async function loadEditable(caseId: string, actor: Actor) {
  const c = await db.case.findUniqueOrThrow({ where: { id: caseId }, include: { subTickets: { select: { buId: true } } } });
  if (!canEditCase(actor, scopeOf(c))) throw new ForbiddenError("Only the assigned case manager can review the assessment.");
  return c;
}

export async function reviseOutput(caseId: string, output: AssessmentOutput, value: string, actor: Actor) {
  if (!ASSESSMENT_OUTPUTS.includes(output)) throw new InvalidValueError(`Unknown output ${output}.`);
  const rule = OUTPUT_RULES[output];
  const v = value.trim();
  if (rule.allowed && !rule.allowed.includes(v)) {
    throw new InvalidValueError(`${output} must be one of: ${rule.allowed.join(", ")}.`);
  }
  const c = await loadEditable(caseId, actor);

  return db.$transaction(async (tx) => {
    const before = await tx.caseAssessment.findUniqueOrThrow({ where: { caseId_output: { caseId, output } } });
    const status = v === before.aiValue ? "accepted" : "revised";
    await tx.caseAssessment.update({
      where: { id: before.id },
      data: { finalValue: v, status, revisedById: actor.id, revisedAt: new Date() },
    });
    if (rule.apply) await tx.case.update({ where: { id: caseId }, data: { ...rule.apply(v), updatedBy: actor.id } });
    await appendAudit(tx, {
      entity: "case_assessment",
      entityId: before.id,
      action: status === "revised" ? "revise" : "accept",
      changes: { caseId, output, ai: before.aiValue, from: before.finalValue, to: v },
      actorId: actor.id,
    });
    if (status === "revised") {
      await tx.caseNote.create({
        data: { caseId, kind: "system", authorId: actor.id, body: `${actor.name} revised ${output.replace(/_/g, " ")}: ${before.aiValue} → ${v}.` },
      });
    }
    await emit(tx, "case.assessed", caseId, { number: c.number, output, value: v, status, by: actor.id });
    return { status };
  });
}

/** Accepts every still-proposed output and moves the case into investigation. */
export async function confirmAssessment(caseId: string, actor: Actor) {
  const c = await loadEditable(caseId, actor);
  return db.$transaction(async (tx) => {
    const accepted = await tx.caseAssessment.updateMany({
      where: { caseId, status: "proposed" },
      data: { status: "accepted", revisedById: actor.id, revisedAt: new Date() },
    });
    const nextStage = ["intake", "acknowledgement", "assessment"].includes(c.stage) ? "investigation" : c.stage;
    await tx.case.update({ where: { id: caseId }, data: { stage: nextStage, updatedBy: actor.id } });
    await appendAudit(tx, {
      entity: "case",
      entityId: caseId,
      action: "assessment_confirmed",
      changes: { accepted: accepted.count, stage: { from: c.stage, to: nextStage } },
      actorId: actor.id,
    });
    if (nextStage !== c.stage) await emit(tx, "case.stage_changed", caseId, { number: c.number, from: c.stage, to: nextStage });
    return { accepted: accepted.count, stage: nextStage };
  });
}
