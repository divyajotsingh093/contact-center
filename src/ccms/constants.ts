/** Domain vocabulary from BSD v1.2. Labels are what Income sees on screen. */

export const NATURES = ["complaint", "feedback", "enquiry", "appeal"] as const;
export type Nature = (typeof NATURES)[number];

export const STAGES = [
  "intake",
  "acknowledgement",
  "assessment",
  "investigation",
  "resolution",
  "closure",
  "rca_qa",
  "closed",
] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_LABELS: Record<Stage, string> = {
  intake: "Intake",
  acknowledgement: "Acknowledgement",
  assessment: "Assessment",
  investigation: "Investigation",
  resolution: "Resolution",
  closure: "Closure",
  rca_qa: "RCA & QA",
  closed: "Closed",
};

export const SOURCES = [
  "email",
  "call_centre",
  "letter",
  "social",
  "web_form",
  "branch",
  "growhill",
  "app",
] as const;
export type Source = (typeof SOURCES)[number];

export const SOURCE_LABELS: Record<Source, string> = {
  email: "Shared-inbox email",
  call_centre: "Call-centre audio",
  letter: "Scanned letter",
  social: "Social screenshot",
  web_form: "Web form",
  branch: "Branch",
  growhill: "Growhill",
  app: "Website / app",
};

/** The ten preliminary-assessment outputs (BSD 3.1.3), in display order. */
export const ASSESSMENT_OUTPUTS = [
  "case_nature",
  "regulatory_flag",
  "fidrec",
  "reopened_case",
  "linked_cases",
  "priority",
  "target_resolution_date",
  "potential_chr",
  "potential_significant",
  "data_classification",
] as const;
export type AssessmentOutput = (typeof ASSESSMENT_OUTPUTS)[number];

export const ASSESSMENT_LABELS: Record<AssessmentOutput, string> = {
  case_nature: "Case nature",
  regulatory_flag: "Regulatory flag",
  fidrec: "FIDREC",
  reopened_case: "Reopened case",
  linked_cases: "Linked cases",
  priority: "Priority",
  target_resolution_date: "Target resolution date",
  potential_chr: "Potential CHR",
  potential_significant: "Potential significant complaint",
  data_classification: "Data classification",
};

export const ROLES = [
  "frontliner",
  "case_manager",
  "team_lead",
  "bu_staff",
  "ce_team",
  "head_of_ce",
  "qa",
  "admin",
  "service",
] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  frontliner: "Frontliner",
  case_manager: "Case manager",
  team_lead: "Team lead",
  bu_staff: "BU internal staff",
  ce_team: "CE team",
  head_of_ce: "Head of CE",
  qa: "QA staff",
  admin: "Administrator",
  service: "Integration service",
};

export const PRIORITIES = ["P1", "P2", "P3", "P4"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const REGULATORS = ["MAS", "MOH", "CPFB", "none"] as const;
export const DATA_CLASSIFICATIONS = ["public", "internal", "confidential", "restricted"] as const;
export const LINES_OF_BUSINESS = ["life", "general", "health"] as const;

/** The 10 closure-form fields (placeholder names until Income confirms its list). */
export const CLOSURE_FIELDS = [
  { key: "summary_of_complaint", label: "Summary of complaint" },
  { key: "investigation_findings", label: "Investigation findings" },
  { key: "complaint_outcome", label: "Outcome (justified / partially / not justified)" },
  { key: "root_cause", label: "Root cause" },
  { key: "remedy_offered", label: "Remedy offered" },
  { key: "compensation_amount", label: "Compensation amount (SGD)" },
  { key: "regulatory_reportable", label: "Regulatory reportable" },
  { key: "customer_harm", label: "Customer harm identified" },
  { key: "lessons_learnt", label: "Lessons learnt" },
  { key: "response_letter_ref", label: "Response letter reference" },
] as const;

export const CUSTOMER_RESPONSES = ["accepted", "rejected", "no_response", "further_info"] as const;
export type CustomerResponse = (typeof CUSTOMER_RESPONSES)[number];
