/**
 * Deterministic stand-ins for the Kamios agents, used until the AI Hub is
 * connected. Keyword and pattern based; confidence scores reflect how direct
 * the evidence was. Not a substitute for the real agents.
 */
import type {
  AiAssessment,
  AssessmentInput,
  Draft,
  DraftInput,
  DuplicateCandidate,
  DuplicateMatch,
  ExtractedFields,
  ExtractionInput,
  RcaInput,
  RcaSuggestion,
  Scored,
} from "./kamios";

const s = <T>(value: T, confidence: number, rationale: string): Scored<T> => ({ value, confidence, rationale });

function find(re: RegExp, text: string): string | null {
  const m = re.exec(text);
  return m ? (m[1] ?? m[0]).trim() : null;
}

const NATURE_CUES: { nature: string; cues: RegExp }[] = [
  { nature: "appeal", cues: /\b(appeal|reconsider|review (the|my) decision|overturn)\b/i },
  {
    nature: "complaint",
    cues: /\b(complain|complaint|unhappy|dissatisfied|unacceptable|disappointed|delay(ed)?|mis-?sold|frustrat|poor service|rude|escalate)\b/i,
  },
  { nature: "feedback", cues: /\b(feedback|suggest(ion)?|compliment|thank you for|great service|would be nice)\b/i },
  { nature: "enquiry", cues: /\b(enquir|inquir|how (do|can) i|could you (tell|advise)|what is|request (for|to)|update my)\b/i },
];

const SUBTYPE_CUES: { subType: string; cues: RegExp }[] = [
  { subType: "claim_delay", cues: /\bclaim\b.*\b(delay|pending|slow|waiting|weeks|months)\b|\b(delay|waiting)\b.*\bclaim\b/i },
  { subType: "claim_rejection", cues: /\bclaim\b.*\b(reject|denied|declin)/i },
  { subType: "premium", cues: /\b(premium|billing|deduct|charge)/i },
  { subType: "agent_conduct", cues: /\b(agent|adviser|advisor|representative)\b.*\b(rude|mis-?sold|misled|pressur|didn'?t explain)/i },
  { subType: "service_request", cues: /\b(change (my )?address|update (my )?(details|address|nominee)|request (for|to))\b/i },
];

/**
 * A subject for sources without one (calls, letters, screenshots): the first
 * customer sentence that mentions the product or problem, skipping transcript
 * headers, agent turns, dates and greetings.
 */
function summaryLine(text: string): string {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !/^\[.*\]$/.test(l) && !/^agent:/i.test(l) && !/^(dear|hi|hello|to|re:)\b/i.test(l) && !/^\d{1,2} \w+ \d{4}$/.test(l));
  const sentences = lines
    .map((l) => l.replace(/^(caller|customer):\s*/i, ""))
    .join(" ")
    .split(/(?<=[.!?])\s+/)
    .filter((x) => !/^my name is\b/i.test(x) && !/^i am \d+/i.test(x));
  const cue = sentences.find((x) => /\b(claim|policy|premium|agent|refund|nominee|appeal|service|app|letter|payment)\b/i.test(x));
  return (cue ?? sentences[0] ?? "(no subject)").replace(/\s+/g, " ");
}

export function extract(input: ExtractionInput): ExtractedFields {
  const text = [input.subject ?? "", input.text, ...(input.attachments ?? []).map((a) => a.extractedText ?? "")].join("\n");

  const nature = NATURE_CUES.find((n) => n.cues.test(text));
  const subType = SUBTYPE_CUES.find((n) => n.cues.test(text));
  const email = find(/([\w.+-]+@[\w-]+\.[\w.-]+)/, input.sender ?? "") ?? find(/([\w.+-]+@[\w-]+\.[\w.-]+)/, text);
  const phone = find(/(?:\+65[\s-]?)?([689]\d{3}[\s-]?\d{4})\b/, text);
  const claimNo = find(/\bclaim(?: no\.?| number| ref(?:erence)?)?[:#\s]*([A-Z]{0,3}\d{5,10})\b/i, text);
  const agentCode = find(/\bagent(?: code)?[:#\s]*([A-Z]{2}\d{3,6})\b/i, text);
  // An explicitly labelled policy number wins; otherwise the first ID-shaped
  // token that isn't the claim or agent reference.
  const policyNo =
    find(/\bpolicy(?: no\.?| number)?[:#\s]*([A-Z]{1,3}\d{6,10})\b/i, text) ??
    ([...text.matchAll(/\b([A-Z]{1,3}\d{6,10})\b/g)].map((m) => m[1]).find((id) => id !== claimNo && id !== agentCode) ?? null);
  const agentInvolved = Boolean(agentCode) || /\b(my|the|your) (agent|adviser|advisor)\b/i.test(text);
  const name =
    find(/(?:[Rr]egards|[Ss]incerely|[Tt]hanks|[Tt]hank you),?\s*\n+\s*([A-Z][a-z]+(?: [A-Z][a-z]+){0,3})/, text) ??
    find(/\b[Mm]y name is ([A-Z][a-z]+(?: [A-Z][a-z]+){0,3})/, text) ??
    find(/^\s*"?([A-Z][a-z]+(?: [A-Z][a-z]+){0,3})"?\s*</, input.sender ?? "");
  const lob = /\b(hospital|medical|shield|health|surgery|outpatient)\b/i.test(text)
    ? "health"
    : /\b(car|motor|travel|home|property|accident)\b/i.test(text)
      ? "general"
      : /\b(life|whole life|term|endowment|investment[- ]linked|ilp|death|critical illness)\b/i.test(text)
        ? "life"
        : null;
  const regulator = /\bMAS\b|monetary authority/i.test(text)
    ? "MAS"
    : /\bMOH\b|ministry of health/i.test(text)
      ? "MOH"
      : /\bCPF\b|cpf board|cpfb/i.test(text)
        ? "CPFB"
        : null;
  const fidrec = /\bFIDREC\b|financial industry disputes/i.test(text);
  const outcome = find(/\b(?:I (?:want|would like|expect|demand|request)) ([^.\n]{5,160})/i, text);
  const firstLine = (input.subject ?? summaryLine(input.text)).trim().slice(0, 120);

  return {
    subject: s(firstLine || "(no subject)", input.subject ? 0.95 : 0.6, input.subject ? "Taken from the message subject" : "First line of the message"),
    description: s(input.text.trim(), 0.9, "Full message body"),
    nature: s(nature?.nature ?? "enquiry", nature ? 0.72 : 0.4, nature ? `Wording matches ${nature.nature} cues` : "No strong cues; defaulted to enquiry"),
    subType: s(subType?.subType ?? null, subType ? 0.65 : 0.3, subType ? `Mentions ${subType.subType.replace(/_/g, " ")}` : "No sub-type cues"),
    complainantName: s(name, name ? 0.7 : 0.2, name ? "Signature or self-introduction" : "No name found"),
    complainantEmail: s(email, email ? 0.95 : 0.2, email ? "Sender or body email address" : "No email found"),
    complainantPhone: s(phone, phone ? 0.85 : 0.2, phone ? "Singapore phone number pattern" : "No phone found"),
    policyNo: s(policyNo, policyNo ? 0.85 : 0.2, policyNo ? "Policy number pattern" : "No policy number found"),
    claimNo: s(claimNo, claimNo ? 0.85 : 0.2, claimNo ? "Claim reference pattern" : "No claim reference found"),
    agentCode: s(agentCode, agentCode ? 0.85 : 0.2, agentCode ? "Agent code pattern" : "No agent code"),
    agentInvolved: s(agentInvolved, agentCode ? 0.9 : agentInvolved ? 0.65 : 0.6, agentInvolved ? "Customer refers to an agent" : "No agent mentioned"),
    lineOfBusiness: s(lob, lob ? 0.6 : 0.2, lob ? `Product wording suggests ${lob}` : "Line of business unclear"),
    desiredOutcome: s(outcome, outcome ? 0.6 : 0.2, outcome ? "Customer states what they want" : "No stated outcome"),
    regulatorHint: s(regulator, regulator ? 0.9 : 0.7, regulator ? `Customer cites ${regulator}` : "No regulator mentioned"),
    mentionsFidrec: s(fidrec, 0.9, fidrec ? "FIDREC mentioned" : "FIDREC not mentioned"),
  };
}

export function assess(input: AssessmentInput): AiAssessment {
  const text = `${input.subject}\n${input.description}`;
  const harsh = /\b(lawyer|legal action|media|press|straits times|social media|ombudsman|MAS|FIDREC|police)\b/i.test(text);
  const money = /\$\s?\d{2,3},?\d{3}|\b\d{2,3},\d{3}\b/.test(text);
  const harm = /\b(lost|loss|out of pocket|couldn'?t pay|hardship|denied treatment|surgery|hospital bill|financial difficulty)\b/i.test(text);
  const repeat = input.priorCases.filter((c) => c.status !== "cancelled").length;
  const reopened = input.priorCases.some(
    (c) => c.status === "closed" && c.subject.toLowerCase().split(/\W+/).some((w) => w.length > 4 && text.toLowerCase().includes(w)),
  );
  const significant = harsh || (money && harm) || repeat >= 2;
  const nature = input.nature ?? "enquiry";

  return {
    case_nature: s(nature, input.nature ? 0.75 : 0.4, input.nature ? "From intake extraction" : "Not determined at intake"),
    potential_significant: s(
      nature === "complaint" && significant,
      significant ? 0.7 : 0.6,
      [harsh && "threatens external escalation", money && harm && "material financial impact", repeat >= 2 && `${repeat} earlier cases`]
        .filter(Boolean)
        .join("; ") || "No significance indicators",
    ),
    potential_chr: s(harm, harm ? 0.65 : 0.6, harm ? "Describes financial or health harm" : "No harm described"),
    reopened_case: s(reopened, reopened ? 0.7 : 0.8, reopened ? "Matches a closed case on the same topic" : "No closed case on the same topic"),
  };
}

function tokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 3),
  );
}

export function similarity(a: string, b: string): number {
  const A = tokens(a);
  const B = tokens(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter);
}

export function findDuplicates(input: {
  subject: string;
  description: string;
  candidates: DuplicateCandidate[];
  now: string;
}): DuplicateMatch[] {
  const text = `${input.subject} ${input.description}`;
  return input.candidates
    .map((c) => {
      const score = similarity(text, `${c.subject} ${c.description}`);
      const closed = c.status === "closed";
      return {
        caseId: c.id,
        number: c.number,
        score: Math.round(score * 100) / 100,
        reason: `${Math.round(score * 100)}% wording overlap with ${c.number} (${c.status})`,
        action: (closed ? "new_linked" : score >= 0.5 ? "consolidate" : "link") as DuplicateMatch["action"],
      };
    })
    .filter((m) => m.score >= 0.2)
    .sort((a, b) => b.score - a.score);
}

export function draftResponse(input: DraftInput): Draft {
  const name = input.customerName ?? "Customer";
  const findings = input.resolutionLog.length ? input.resolutionLog : ["We have reviewed your case."];
  const coaching: string[] = [];
  let body: string;
  if (input.plainLanguage) {
    body = [
      `Dear ${name},`,
      "",
      `Thank you for contacting us about "${input.subject}".`,
      "",
      "Here is what we found:",
      ...findings.map((f) => `• ${f}`),
      "",
      input.outcome ? `What happens next: ${input.outcome}` : "What happens next: we will keep you updated.",
      "",
      "If anything is unclear, please call us and we will explain it again. You can also ask a family member to call with you.",
      "",
      "Yours sincerely,",
      "Customer Experience, Income Insurance",
    ].join("\n");
    coaching.push("Plain-language mode: short sentences, no jargon, a clear next step and a named way to get help.");
  } else {
    body = [
      `Dear ${name},`,
      "",
      `We refer to your ${input.nature} regarding "${input.subject}".`,
      "",
      "We have completed our review. Our findings are as follows:",
      ...findings.map((f, i) => `${i + 1}. ${f}`),
      "",
      input.outcome ?? "",
      "",
      "Should you require further clarification, please do not hesitate to contact us.",
      "",
      "Yours sincerely,",
      "Customer Experience, Income Insurance",
    ].join("\n");
  }
  if (input.nature === "complaint") {
    coaching.push("Acknowledge the impact on the customer before stating findings.");
    coaching.push("If the complaint is not upheld, include the FIDREC referral paragraph.");
  }
  if (/\b(regret to inform|unfortunately|policy terms)\b/i.test(body)) coaching.push("Explain the policy term in everyday words.");
  return { subject: `Re: ${input.subject}`, body, coaching };
}

export function suggestRca(input: RcaInput): RcaSuggestion {
  const text = `${input.subject} ${input.description} ${input.findings} ${input.subTicketHistory.join(" ")}`;
  const category = /\b(delay|backlog|turnaround|pending)\b/i.test(text)
    ? "Process – turnaround time"
    : /\b(agent|adviser|mis-?sold|explain)\b/i.test(text)
      ? "People – sales conduct"
      : /\b(system|error|bug|glitch|portal|app)\b/i.test(text)
        ? "System – defect"
        : /\b(letter|communication|told|informed|unclear)\b/i.test(text)
          ? "Communication – unclear information"
          : "Process – policy or procedure gap";
  const bu = category.startsWith("People") ? "DIST" : category.startsWith("System") ? "LIFE" : "CLAIMS";
  return {
    category: s(category, 0.55, "Keyword match against findings and sub-ticket history"),
    description: `Likely root cause: ${category.toLowerCase()}. Based on the investigation findings.`,
    capa: [
      { actionType: "corrective", description: "Resolve the specific lapse for this customer and confirm in writing.", buCode: bu },
      { actionType: "preventive", description: "Review the process step that failed and add a control or checklist item.", buCode: bu },
    ],
  };
}
