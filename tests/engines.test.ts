import { describe, expect, it } from "vitest";
import { matches, parseQuery, toPrismaQuery } from "@/platform/encoded-query";
import { evaluateTable } from "@/integrations/decision-table";
import { LOCAL_TABLES } from "@/integrations/reels-local";
import { addWorkingDays, isWorkingDay } from "@/lib/working-days";
import { dueAlerts, health, pause, reopen, resume, stop, type Clock } from "@/ccms/sla";
import { canEditCase, canReadCase, maskCase, shouldMask, type Actor, type CaseScope } from "@/ccms/access";
import { pickCaseManager } from "@/ccms/allocation";
import { canonical, GENESIS, hashEntry } from "@/ccms/audit";
import { renderTemplate } from "@/ccms/services/communications";
import * as kl from "@/integrations/kamios-local";

const H = 3600_000;

describe("encoded queries", () => {
  it("binds ^OR tighter than ^ and splits ^NQ groups", () => {
    const q = parseQuery("priority=P1^ORpriority=P2^nature=complaint^NQstatus=closed^ORDERBYDESCreceivedAt");
    expect(q.groups).toHaveLength(2);
    expect(q.groups[0]).toHaveLength(2);
    expect(q.groups[0][0]).toHaveLength(2);
    expect(q.orderBy).toEqual([{ field: "receivedAt", direction: "desc" }]);
    expect(matches({ priority: "P2", nature: "complaint" }, q)).toBe(true);
    expect(matches({ priority: "P3", nature: "complaint" }, q)).toBe(false);
    expect(matches({ priority: "P3", status: "closed" }, q)).toBe(true);
  });

  it("does not read an operator-looking value as part of the field", () => {
    expect(parseQuery("subjectSTARTSWITHIN").groups[0][0][0]).toEqual({ field: "subject", operator: "STARTSWITH", value: "IN" });
  });

  it("supports CHANGES against the previous record and @me", () => {
    expect(matches({ stage: "closure" }, "stageCHANGESTOclosure", { previous: { stage: "resolution" } })).toBe(true);
    expect(matches({ stage: "closure" }, "stageCHANGES", { previous: { stage: "closure" } })).toBe(false);
    expect(matches({ caseManagerId: "u1" }, "caseManagerId=@me", { userId: "u1" })).toBe(true);
  });

  it("translates to a Prisma where with typed values", () => {
    const { where } = toPrismaQuery("significant=true^subjectLIKEclaim", { significant: { kind: "boolean" }, subject: { kind: "string" } });
    expect(where).toEqual({ AND: [{ significant: true }, { subject: { contains: "claim", mode: "insensitive" } }] });
  });
});

describe("Reels local decision tables", () => {
  it("routes a significant complaint to a senior CE manager at P1", () => {
    const facts = { nature: "complaint", significant: true, regulatoryFlag: "MAS", fidrec: false, vulnerable: false };
    expect(evaluateTable(LOCAL_TABLES.priority_target, facts).outputs).toMatchObject({ priority: "P1", targetWorkingDays: 10 });
    expect(evaluateTable(LOCAL_TABLES.allocation, facts).outputs).toMatchObject({ buCode: "CE", teamName: "CE Significant", requiredSkill: "senior" });
    expect(evaluateTable(LOCAL_TABLES.approval_routing, facts).outputs.steps).toBe("team_lead,head_of_ce");
  });

  it("gives enquiries and feedback the simplified flow with no approval", () => {
    expect(evaluateTable(LOCAL_TABLES.approval_routing, { nature: "enquiry" }).outputs.steps).toBe("");
    expect(evaluateTable(LOCAL_TABLES.approval_routing, { nature: "feedback" }).outputs.steps).toBe("");
  });

  it("sends appeals to the owning BU", () => {
    expect(evaluateTable(LOCAL_TABLES.allocation, { nature: "appeal", lineOfBusiness: "health" }).outputs.buCode).toBe("HEALTH");
  });

  it("prompts distribution and compliance for agent-related regulator cases", () => {
    expect(evaluateTable(LOCAL_TABLES.bu_notification, { agentInvolved: true, regulatoryFlag: "MAS" }).outputs).toEqual({
      notifyDistribution: true,
      notifyCompliance: true,
    });
  });

  it("triggers RCA on repeat complaints via numeric cells", () => {
    expect(evaluateTable(LOCAL_TABLES.rca_trigger, { nature: "complaint", repeatCount: 3 }).outputs.rcaRequired).toBe(true);
    expect(evaluateTable(LOCAL_TABLES.rca_trigger, { nature: "complaint", repeatCount: 1 }).outputs.rcaRequired).toBe(false);
  });

  it("falls back to defaults when nothing matches", () => {
    const r = evaluateTable(LOCAL_TABLES.case_classification, {});
    expect(r.row).toBe(-1);
    expect(r.outputs).toEqual({ regulatoryFlag: "none", fidrec: false, dataClassification: "internal" });
  });
});

describe("working days", () => {
  it("skips weekends and SG public holidays", () => {
    // Friday 2026-10-16 10:00 SGT
    const fri = new Date("2026-10-16T02:00:00Z");
    expect(addWorkingDays(fri, 2).toISOString()).toBe("2026-10-20T02:00:00.000Z");
    // Saturday counts from Monday
    expect(addWorkingDays(new Date("2026-10-17T02:00:00Z"), 1).toISOString()).toBe("2026-10-20T02:00:00.000Z");
    expect(isWorkingDay(new Date("2026-12-25T02:00:00Z"))).toBe(false);
  });
});

describe("SLA clock", () => {
  const t0 = new Date("2026-10-19T00:00:00Z");
  const clock: Clock = {
    startedAt: t0,
    targetAt: new Date(t0.getTime() + 10 * H),
    nearBreachPct: 80,
    state: "running",
    pausedAt: null,
    pausedMs: 0,
    stoppedAt: null,
    nearBreachAlertedAt: null,
    breachedAt: null,
  };
  const at = (h: number) => new Date(t0.getTime() + h * H);

  it("moves from on track to near breach to breached", () => {
    expect(health(clock, at(5))).toBe("on_track");
    expect(health(clock, at(8.5))).toBe("near_breach");
    expect(health(clock, at(11))).toBe("breached");
    expect(dueAlerts(clock, at(11))).toEqual(["near_breach", "breached"]);
    expect(dueAlerts({ ...clock, nearBreachAlertedAt: at(9), breachedAt: at(10) }, at(11))).toEqual([]);
  });

  it("excludes paused time and pushes the target out", () => {
    const resumed = resume(pause(clock, at(2)), at(5));
    expect(resumed.pausedMs).toBe(3 * H);
    expect(resumed.targetAt.getTime()).toBe(at(13).getTime());
    expect(health(resumed, at(11))).toBe("near_breach");
  });

  it("carries on after a reopen instead of resetting", () => {
    const stopped = stop(clock, at(4));
    expect(stopped.state).toBe("met");
    const reopened = reopen(stopped);
    expect(reopened.state).toBe("running");
    expect(reopened.startedAt).toEqual(t0);
    expect(health(reopened, at(9))).toBe("near_breach");
  });

  it("records a late stop as missed", () => {
    expect(stop(clock, at(12)).state).toBe("breached_met");
  });
});

describe("access and masking", () => {
  const cm: Actor = { id: "cm1", name: "CM", roles: ["case_manager"], buId: "ce", teamId: "t1", ledTeamIds: [] };
  const other: Actor = { ...cm, id: "cm2" };
  const front: Actor = { id: "f1", name: "Front", roles: ["frontliner"], buId: null, teamId: null, ledTeamIds: [] };
  const lead: Actor = { id: "tl", name: "Lead", roles: ["team_lead"], buId: "ce", teamId: "t1", ledTeamIds: ["t1"] };
  const scope: CaseScope = { caseManagerId: "cm1", teamId: "t1", buId: "ce", confidential: true, vip: false, vulnerable: true };

  it("lets only the assigned case manager edit", () => {
    expect(canEditCase(cm, scope)).toBe(true);
    expect(canEditCase(other, scope)).toBe(false);
    expect(canEditCase(lead, scope)).toBe(false);
  });

  it("masks sensitive cases for frontliners but not for the owner or team lead", () => {
    expect(canReadCase(front, scope)).toBe(true);
    expect(shouldMask(front, scope)).toBe(true);
    expect(shouldMask(cm, scope)).toBe(false);
    expect(shouldMask(lead, scope)).toBe(false);
    expect(canReadCase(other, scope)).toBe(false);
    const masked = maskCase({ description: "secret", complainantName: "Tan Ah Kow", subject: "Claim" });
    expect(masked.description).not.toContain("secret");
    expect(masked.complainantName).toBe("T•••");
    expect(masked.subject).toBe("Claim");
  });
});

describe("allocation", () => {
  it("prefers skilled staff, then the lightest workload", () => {
    const team = [
      { id: "a", name: "Alice", skills: ["senior"], openCases: 5 },
      { id: "b", name: "Bob", skills: [], openCases: 1 },
      { id: "c", name: "Cara", skills: ["senior"], openCases: 2 },
    ];
    expect(pickCaseManager(team, "senior")?.id).toBe("c");
    expect(pickCaseManager(team, null)?.id).toBe("b");
    expect(pickCaseManager(team, "fidrec_trained")?.id).toBe("b");
    expect(pickCaseManager([], "senior")).toBeNull();
  });
});

describe("audit hash chain", () => {
  it("is stable under key order and changes with content", () => {
    expect(canonical({ b: 1, a: [2, { d: 3, c: 4 }] })).toBe('{"a":[2,{"c":4,"d":3}],"b":1}');
    const e = { entity: "case", entityId: "1", action: "create", changes: { a: 1 }, actorId: null, createdAt: new Date(0) };
    const h1 = hashEntry(GENESIS, e);
    expect(hashEntry(GENESIS, { ...e, changes: { a: 1 } })).toBe(h1);
    expect(hashEntry(GENESIS, { ...e, changes: { a: 2 } })).not.toBe(h1);
    expect(hashEntry(h1, e)).not.toBe(h1);
  });
});

describe("Kamios local stand-ins", () => {
  it("extracts a claim-delay complaint with a regulator mention", () => {
    const ex = kl.extract({
      source: "email",
      subject: "Unacceptable delay on my claim",
      sender: "Tan Mei Ling <meiling.tan@example.com>",
      text: "My claim no CL1234567 under policy LF12345678 has been pending for 3 months. My agent AG1234 never replied. I want my claim paid this week or I will write to MAS.\n\nRegards,\nTan Mei Ling",
    });
    expect(ex.nature.value).toBe("complaint");
    expect(ex.subType.value).toBe("claim_delay");
    expect(ex.complainantEmail.value).toBe("meiling.tan@example.com");
    expect(ex.policyNo.value).toBe("LF12345678");
    expect(ex.claimNo.value).toBe("CL1234567");
    expect(ex.agentCode.value).toBe("AG1234");
    expect(ex.agentInvolved.value).toBe(true);
    expect(ex.regulatorHint.value).toBe("MAS");
    expect(ex.complainantName.value).toBe("Tan Mei Ling");
  });

  it("marks a closed duplicate as a new linked case", () => {
    const m = kl.findDuplicates({
      subject: "claim still pending",
      description: "my hospital claim is still pending after weeks",
      now: new Date().toISOString(),
      candidates: [{ id: "1", number: "C1", subject: "hospital claim pending", description: "hospital claim pending for weeks", status: "closed", closedAt: null }],
    });
    expect(m[0]).toMatchObject({ caseId: "1", action: "new_linked" });
  });

  it("drafts a plain-language reply with coaching", () => {
    const d = kl.draftResponse({ nature: "complaint", customerName: "Mr Lim", subject: "Claim", resolutionLog: ["Your claim was paid on 1 Oct."], plainLanguage: true });
    expect(d.body).toContain("What happens next");
    expect(d.coaching.length).toBeGreaterThan(0);
  });
});

describe("templates", () => {
  it("fills placeholders and blanks unknown ones", () => {
    expect(renderTemplate("Dear {{name}}, case {{ number }} {{missing}}.", { name: "Ann", number: "C-1" })).toBe("Dear Ann, case C-1 .");
  });
});

describe("Kamios local subject for sources without one", () => {
  it("uses the first customer sentence about the problem, not the transcript header", () => {
    const ex = kl.extract({
      source: "call_centre",
      text: "[Transcript, call centre, 19 Oct 2026 09:32]\nAgent: Good morning, Income.\nCaller: My name is Lim Ah Huat. I am 82 years old. My hospital claim for my knee surgery is delayed.",
    });
    expect(ex.subject.value).toBe("My hospital claim for my knee surgery is delayed.");
  });
});

describe("Kamios local subject for letters", () => {
  it("skips address lines and picks the request", () => {
    const ex = kl.extract({
      source: "letter",
      text: "[OCR text]\n12 October 2026\n\nIncome Insurance Limited\nCustomer Service\n\nDear Sir/Madam,\n\nCould you advise how I can update the nominee on my policy LF40003333? I recently got married.",
    });
    expect(ex.subject.value).toBe("Could you advise how I can update the nominee on my policy LF40003333?");
  });
});
