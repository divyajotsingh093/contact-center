/**
 * Kamios AI Hub adapter. Each agent has a typed contract. When KAMIOS_* is
 * configured the call goes to the AI Hub; otherwise the deterministic local
 * stand-in in kamios-local.ts answers, and results carry source "local".
 */
import * as local from "./kamios-local";

export type AgentName =
  | "intake_extraction"
  | "preliminary_assessment"
  | "duplicate_detection"
  | "response_drafting"
  | "rca_suggestion";

export interface Scored<T> {
  value: T;
  confidence: number; // 0..1
  rationale: string;
}

// ---- intake_extraction

export interface ExtractionInput {
  source: string;
  text: string; // email body, transcript or OCR text
  subject?: string;
  sender?: string;
  attachments?: { fileName: string; extractedText?: string }[];
}

export interface ExtractedFields {
  subject: Scored<string>;
  description: Scored<string>;
  nature: Scored<string>;
  subType: Scored<string | null>;
  complainantName: Scored<string | null>;
  complainantEmail: Scored<string | null>;
  complainantPhone: Scored<string | null>;
  policyNo: Scored<string | null>;
  claimNo: Scored<string | null>;
  agentCode: Scored<string | null>;
  agentInvolved: Scored<boolean>;
  lineOfBusiness: Scored<string | null>;
  desiredOutcome: Scored<string | null>;
  regulatorHint: Scored<string | null>;
  mentionsFidrec: Scored<boolean>;
}

// ---- preliminary_assessment (the parts AI judges; Reels judges the rest)

export interface AssessmentInput {
  subject: string;
  description: string;
  nature: string | null;
  customer: { vulnerable: boolean; vulnerableType: string | null; grade: string | null; vip: boolean } | null;
  priorCases: { number: string; status: string; subject: string; closedAt: string | null }[];
}

export interface AiAssessment {
  case_nature: Scored<string>;
  potential_significant: Scored<boolean>;
  potential_chr: Scored<boolean>;
  reopened_case: Scored<boolean>;
}

// ---- duplicate_detection

export interface DuplicateCandidate {
  id: string;
  number: string;
  subject: string;
  description: string;
  status: string;
  closedAt: string | null;
}
export interface DuplicateMatch {
  caseId: string;
  number: string;
  score: number;
  reason: string;
  action: "link" | "consolidate" | "new_linked";
}

// ---- response_drafting

export interface DraftInput {
  nature: string;
  customerName: string | null;
  subject: string;
  resolutionLog: string[];
  outcome?: string;
  plainLanguage: boolean;
}
export interface Draft {
  subject: string;
  body: string;
  coaching: string[];
}

// ---- rca_suggestion

export interface RcaInput {
  subject: string;
  description: string;
  findings: string;
  subTicketHistory: string[];
}
export interface RcaSuggestion {
  category: Scored<string>;
  description: string;
  capa: { actionType: "corrective" | "preventive"; description: string; buCode: string }[];
}

export interface AgentResult<T> {
  result: T;
  source: "kamios" | "local";
}

function config(agent: AgentName) {
  const baseUrl = process.env.KAMIOS_BASE_URL;
  const token = process.env.KAMIOS_API_TOKEN;
  const agentId = process.env[`KAMIOS_AGENT_${agent.toUpperCase()}`];
  return baseUrl && token && agentId ? { baseUrl, token, agentId } : null;
}

async function callAgent<I, O>(agent: AgentName, input: I, fallback: (input: I) => O): Promise<AgentResult<O>> {
  const cfg = config(agent);
  if (!cfg) return { result: fallback(input), source: "local" };
  // Request shape is a placeholder until the AI Hub API spec arrives.
  const res = await fetch(`${cfg.baseUrl.replace(/\/$/, "")}/agents/${cfg.agentId}/invoke`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${cfg.token}` },
    body: JSON.stringify({ input }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`Kamios ${agent} failed: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { output?: O; result?: O };
  return { result: (body.output ?? body.result ?? body) as O, source: "kamios" };
}

export const kamios = {
  extract: (input: ExtractionInput) => callAgent("intake_extraction", input, local.extract),
  assess: (input: AssessmentInput) => callAgent("preliminary_assessment", input, local.assess),
  findDuplicates: (input: { subject: string; description: string; candidates: DuplicateCandidate[]; now: string }) =>
    callAgent("duplicate_detection", input, local.findDuplicates),
  draftResponse: (input: DraftInput) => callAgent("response_drafting", input, local.draftResponse),
  suggestRca: (input: RcaInput) => callAgent("rca_suggestion", input, local.suggestRca),
};
