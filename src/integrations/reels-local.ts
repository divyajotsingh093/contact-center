/**
 * Local copies of the Reels decision tables. These are the spec for the Reels
 * products and the fallback when REELS_* isn't configured. Keep row order and
 * values identical to the Reels side.
 *
 * Synthetic rules built to BSD v1.2; replace with Income's SLA matrix,
 * allocation rules and significance criteria when they arrive.
 */
import type { DecisionTable } from "./decision-table";

export type DecisionName =
  | "case_classification"
  | "priority_target"
  | "allocation"
  | "sla_thresholds"
  | "bu_notification"
  | "approval_routing"
  | "rca_trigger"
  | "qa_sampling";

export const LOCAL_TABLES: Record<DecisionName, DecisionTable> = {
  case_classification: {
    name: "Case classification",
    inputs: ["regulatorHint", "lineOfBusiness", "mentionsFidrec", "vulnerable", "vip", "sensitiveHealth"],
    outputs: ["regulatoryFlag", "fidrec", "dataClassification"],
    defaults: { regulatoryFlag: "none", fidrec: false, dataClassification: "internal" },
    rows: [
      { when: { regulatorHint: "MAS" }, then: { regulatoryFlag: "MAS", dataClassification: "confidential" }, note: "Customer cites MAS" },
      { when: { regulatorHint: "MOH" }, then: { regulatoryFlag: "MOH", dataClassification: "restricted" }, note: "Customer cites MOH" },
      { when: { regulatorHint: "CPFB" }, then: { regulatoryFlag: "CPFB", dataClassification: "confidential" }, note: "Customer cites CPF Board" },
      { when: { mentionsFidrec: true }, then: { fidrec: true, dataClassification: "confidential" }, note: "FIDREC mentioned" },
      { when: { lineOfBusiness: "health", sensitiveHealth: true }, then: { dataClassification: "restricted" }, note: "Health data is restricted" },
      { when: { vip: true }, then: { dataClassification: "confidential" }, note: "VVIP customer" },
      { when: { vulnerable: true }, then: { dataClassification: "confidential" }, note: "Vulnerable customer" },
    ],
  },

  priority_target: {
    name: "Priority and target date",
    inputs: ["nature", "significant", "regulatoryFlag", "fidrec", "vulnerable"],
    outputs: ["priority", "targetWorkingDays"],
    defaults: { priority: "P3", targetWorkingDays: 14 },
    rows: [
      { when: { nature: "complaint", significant: true }, then: { priority: "P1", targetWorkingDays: 10 }, note: "Significant complaint" },
      { when: { nature: "complaint", fidrec: true }, then: { priority: "P1", targetWorkingDays: 10 }, note: "FIDREC complaint" },
      { when: { nature: "complaint", regulatoryFlag: "MAS,MOH,CPFB" }, then: { priority: "P1", targetWorkingDays: 10 }, note: "Regulator-linked complaint" },
      { when: { nature: "complaint", vulnerable: true }, then: { priority: "P2", targetWorkingDays: 10 }, note: "Vulnerable customer complaint" },
      { when: { nature: "complaint" }, then: { priority: "P2", targetWorkingDays: 14 }, note: "Standard complaint" },
      { when: { nature: "appeal" }, then: { priority: "P2", targetWorkingDays: 14 }, note: "Appeal" },
      { when: { nature: "enquiry", vulnerable: true }, then: { priority: "P2", targetWorkingDays: 5 }, note: "Vulnerable customer enquiry" },
      { when: { nature: "enquiry" }, then: { priority: "P3", targetWorkingDays: 5 }, note: "Enquiry" },
      { when: { nature: "feedback" }, then: { priority: "P4", targetWorkingDays: 7 }, note: "Feedback" },
    ],
  },

  allocation: {
    name: "Allocation",
    inputs: ["nature", "lineOfBusiness", "significant", "fidrec", "vulnerable", "subType"],
    outputs: ["buCode", "teamName", "requiredSkill"],
    defaults: { buCode: "CE", teamName: "CE Complaints", requiredSkill: "" },
    rows: [
      { when: { nature: "complaint", significant: true }, then: { buCode: "CE", teamName: "CE Significant", requiredSkill: "senior" }, note: "Significant complaints go to a senior CE team member" },
      { when: { nature: "complaint", fidrec: true }, then: { buCode: "CE", teamName: "CE Significant", requiredSkill: "fidrec_trained" }, note: "FIDREC needs a FIDREC-trained manager" },
      { when: { nature: "complaint", vulnerable: true }, then: { buCode: "CE", teamName: "CE Complaints", requiredSkill: "vulnerable_care" }, note: "Vulnerable customer care" },
      { when: { nature: "complaint" }, then: { buCode: "CE", teamName: "CE Complaints" }, note: "Complaints are owned by CE" },
      { when: { nature: "appeal", lineOfBusiness: "health" }, then: { buCode: "HEALTH", teamName: "Health Appeals" }, note: "Appeal goes to the owning BU" },
      { when: { nature: "appeal", lineOfBusiness: "general" }, then: { buCode: "GI", teamName: "GI Appeals" }, note: "Appeal goes to the owning BU" },
      { when: { nature: "appeal" }, then: { buCode: "LIFE", teamName: "Life Appeals" }, note: "Appeal goes to the owning BU" },
      { when: { nature: "enquiry,feedback" }, then: { buCode: "CE", teamName: "CE Service" }, note: "Simplified flow" },
    ],
  },

  sla_thresholds: {
    name: "SLA thresholds",
    inputs: ["nature", "priority", "buCode"],
    outputs: ["ackWorkingDays", "nearBreachPct", "closureWindowWorkingDays", "breachNotify"],
    defaults: { ackWorkingDays: 2, nearBreachPct: 80, closureWindowWorkingDays: 14, breachNotify: "team_lead,head_of_ce" },
    rows: [
      { when: { priority: "P1" }, then: { nearBreachPct: 70 }, note: "P1 alerts earlier" },
      { when: { nature: "enquiry,feedback" }, then: { nearBreachPct: 80, breachNotify: "team_lead" }, note: "Simplified flow alerts the team lead only" },
    ],
  },

  bu_notification: {
    name: "BU notification",
    inputs: ["agentInvolved", "regulatoryFlag", "nature"],
    outputs: ["notifyDistribution", "notifyCompliance"],
    defaults: { notifyDistribution: false, notifyCompliance: false },
    rows: [
      { when: { agentInvolved: true, regulatoryFlag: "MAS,MOH,CPFB" }, then: { notifyDistribution: true, notifyCompliance: true }, note: "Agent involved and regulator-linked" },
      { when: { agentInvolved: true }, then: { notifyDistribution: true }, note: "Agent-related complaint" },
      { when: { regulatoryFlag: "MAS,MOH,CPFB" }, then: { notifyCompliance: true }, note: "Regulator-linked case" },
    ],
  },

  approval_routing: {
    name: "Approval routing",
    inputs: ["nature", "buCode", "significant"],
    /** Comma-separated roles in approval order, or "none" for the simplified flow. */
    outputs: ["steps"],
    defaults: { steps: "team_lead" },
    rows: [
      { when: { nature: "enquiry,feedback" }, then: { steps: "none" }, note: "Simplified flow: no approval" },
      { when: { nature: "complaint", significant: true }, then: { steps: "team_lead,head_of_ce" }, note: "Significant complaint: team lead then Head of CE" },
      { when: { nature: "complaint" }, then: { steps: "team_lead" }, note: "Complaint closure needs the team lead" },
      { when: { nature: "appeal" }, then: { steps: "team_lead" }, note: "Appeal decision needs the BU team lead" },
    ],
  },

  rca_trigger: {
    name: "RCA trigger",
    inputs: ["nature", "ceFlag", "significant", "justified", "repeatCount", "regulatoryFlag", "customerHarm"],
    outputs: ["rcaRequired", "reason"],
    defaults: { rcaRequired: false, reason: "" },
    rows: [
      { when: { ceFlag: true }, then: { rcaRequired: true, reason: "Flagged by CE" }, note: "Manual CE flag" },
      { when: { nature: "complaint", significant: true }, then: { rcaRequired: true, reason: "Significant complaint" }, note: "Criterion 1: significant" },
      { when: { nature: "complaint", justified: true, customerHarm: true }, then: { rcaRequired: true, reason: "Justified with customer harm" }, note: "Criterion 2: harm" },
      { when: { nature: "complaint", repeatCount: ">=2" }, then: { rcaRequired: true, reason: "Repeat complaint" }, note: "Criterion 3: repeat" },
      { when: { nature: "complaint", regulatoryFlag: "MAS,MOH,CPFB" }, then: { rcaRequired: true, reason: "Regulator-linked" }, note: "Criterion 4: regulatory" },
      { when: { nature: "complaint", justified: true }, then: { rcaRequired: true, reason: "Justified complaint (process lapse)" }, note: "Criterion 5: lapse" },
    ],
  },

  qa_sampling: {
    name: "QA sampling",
    inputs: ["nature", "significant", "randomPct"],
    outputs: ["sampled", "reason"],
    defaults: { sampled: false, reason: "" },
    rows: [
      { when: { nature: "complaint", significant: true }, then: { sampled: true, reason: "All significant complaints are sampled" }, note: "100% of significant complaints" },
      { when: { nature: "complaint", randomPct: "<20" }, then: { sampled: true, reason: "Random 20% complaint sample" }, note: "20% of complaints" },
      { when: { randomPct: "<5" }, then: { sampled: true, reason: "Random 5% sample" }, note: "5% of everything else" },
    ],
  },
};
