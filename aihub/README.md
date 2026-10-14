# Neutrinos AI Hub agents for the Income CCMS

Six agents back the CCMS. The app calls each one the same way (see `src/integrations/kamios.ts`):

1. `POST {KAMIOS_BASE_URL}/inferenceservice/assistant/conversation/create`
2. `POST .../message/create` with `{ conversation_id, text }`, where `text` is the agent's input as one JSON object
3. The reply is read from `output.text`. It must be a single JSON object (a ```json fence is tolerated).

| Agent | Prompt | Vercel env var for its key | Used by |
|---|---|---|---|
| Intake extraction | [01-intake-extraction.md](agents/01-intake-extraction.md) | `KAMIOS_AGENT_INTAKE_EXTRACTION` | Centralised form, `/api/intake` |
| Preliminary assessment | [02-preliminary-assessment.md](agents/02-preliminary-assessment.md) | `KAMIOS_AGENT_PRELIMINARY_ASSESSMENT` | Intake pipeline, Assessment tab |
| Duplicate detection | [03-duplicate-detection.md](agents/03-duplicate-detection.md) | `KAMIOS_AGENT_DUPLICATE_DETECTION` | Intake pipeline, linked cases |
| Response drafting | [04-response-drafting.md](agents/04-response-drafting.md) | `KAMIOS_AGENT_RESPONSE_DRAFTING` | Resolution page |
| RCA suggestion | [05-rca-suggestion.md](agents/05-rca-suggestion.md) | `KAMIOS_AGENT_RCA_SUGGESTION` | RCA ticket |
| Case summary | [06-case-summary.md](agents/06-case-summary.md) | `KAMIOS_AGENT_CASE_SUMMARY` | Case record side panel |

## Setting one up

1. In AI Hub, create an assistant per row. Paste the whole prompt file as its instructions.
2. Model: a strong general model with JSON-following (the GH and Deem agents use the same setup). Temperature 0 to 0.2.
3. Copy the agent's API key into the Vercel env var above (production and preview), plus once for all agents:
   `KAMIOS_BASE_URL` (e.g. `https://aihub-staging.neutrinos.com`) and `KAMIOS_AUTH_HEADER` (the header name the AI Hub keys go in; it is in any existing AI Hub credential in n8n).
4. Redeploy. The app's header shows "Neutrinos AI Hub: Connected", and AI output stops being labelled "Local fallback".

Until a key is set, a deterministic local stand-in answers with the same JSON shape, so screens and tests keep working.

## Rules shared by every agent

- Answer with one JSON object and nothing else.
- Every judgement carries `confidence` (0 to 1) and a one-sentence `rationale` that points at the evidence.
- Never invent identifiers (policy, claim, agent code, case numbers). If the input doesn't contain it, use `null`.
- AI output is advisory. A case manager confirms or revises every value, and Reels, not the agent, decides priority, SLA, allocation and approvals.
