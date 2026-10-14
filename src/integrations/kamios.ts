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
  | "rca_suggestion"
  | "case_summary";

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
  /** From extraction: an agent is named or involved. Drives potential CHR (BSD 3.1.3: an agent-related complaint). */
  agentInvolved: boolean;
  agentCode: string | null;
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

// ---- case_summary (Case 360 side panel)

export interface SummaryInput {
  number: string;
  nature: string | null;
  subject: string;
  description: string;
  desiredOutcome: string | null;
  stage: string;
  flags: string[];
  recentNotes: string[];
}
export interface CaseSummary {
  summary: string;
  keyPoints: string[];
  suggestedNextStep: string;
}

export interface AgentResult<T> {
  result: T;
  source: "kamios" | "local";
}

/**
 * Neutrinos AI Hub: open a conversation, post the input as one message, read the
 * agent's reply text (JSON, possibly fenced). Each agent has its own API key, sent
 * in the header the AI Hub workspace uses (KAMIOS_AUTH_HEADER). Same calls as the
 * GH and Northbeam n8n flows.
 */
function config(agent: AgentName) {
  const baseUrl = process.env.KAMIOS_BASE_URL; // e.g. https://aihub-staging.neutrinos.com
  const header = process.env.KAMIOS_AUTH_HEADER;
  const key = process.env[`KAMIOS_AGENT_${agent.toUpperCase()}`];
  return baseUrl && header && key ? { baseUrl: baseUrl.replace(/\/$/, ""), header, key } : null;
}

/** Agent replies are JSON, sometimes inside a ``` fence or surrounded by prose. */
export function parseAgentText(raw: unknown): unknown {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "object") return raw;
  const text = String(raw);
  for (const m of text.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)) {
    try {
      return JSON.parse(m[1].trim());
    } catch {
      // try the next fence
    }
  }
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first !== -1 && last > first) {
    try {
      return JSON.parse(text.slice(first, last + 1));
    } catch {
      // not JSON
    }
  }
  return null;
}

async function callAgent<I, O>(agent: AgentName, input: I, fallback: (input: I) => O): Promise<AgentResult<O>> {
  const cfg = config(agent);
  if (!cfg) return { result: fallback(input), source: "local" };
  const headers = { "content-type": "application/json", [cfg.header]: cfg.key };
  const post = async (path: string, body: unknown, timeout: number) => {
    const res = await fetch(`${cfg.baseUrl}/inferenceservice/assistant/${path}`, { method: "POST", headers, body: JSON.stringify(body), signal: AbortSignal.timeout(timeout) });
    if (!res.ok) throw new Error(`AI Hub ${agent} ${path} failed: ${res.status} ${await res.text()}`);
    return res.json() as Promise<Record<string, unknown>>;
  };
  const conversation = await post("conversation/create", { metadata: { agent, source: "ccms" }, translation_enabled: false }, 15_000);
  const reply = await post("message/create", { conversation_id: conversation._id, text: JSON.stringify(input) }, 90_000);
  const output = reply.output as { text?: unknown } | undefined;
  const parsed = parseAgentText(output?.text ?? reply.text);
  if (!parsed) throw new Error(`AI Hub ${agent} reply was not JSON: ${JSON.stringify(reply).slice(0, 300)}`);
  return { result: parsed as O, source: "kamios" };
}

export const kamios = {
  extract: (input: ExtractionInput) => callAgent("intake_extraction", input, local.extract),
  assess: (input: AssessmentInput) => callAgent("preliminary_assessment", input, local.assess),
  // The agent answers {"matches": [...]}; the local stand-in returns the array itself.
  findDuplicates: async (input: { subject: string; description: string; candidates: DuplicateCandidate[]; now: string }) => {
    const r = await callAgent<typeof input, DuplicateMatch[] | { matches?: DuplicateMatch[] }>("duplicate_detection", input, local.findDuplicates);
    return { ...r, result: Array.isArray(r.result) ? r.result : (r.result.matches ?? []) };
  },
  draftResponse: (input: DraftInput) => callAgent("response_drafting", input, local.draftResponse),
  suggestRca: (input: RcaInput) => callAgent("rca_suggestion", input, local.suggestRca),
  summarize: (input: SummaryInput) => callAgent("case_summary", input, local.summarize),
};
