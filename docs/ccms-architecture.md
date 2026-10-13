# Income CCMS POC: architecture

Demo on 23 Oct 2026, playback on 16 Oct. Scope comes from the "Income CCMS POC – Scope
Document" (BSD v1.2). This repo holds the case system. Orchestration, rules and AI
live in three external platforms:

| Concern | Where | Why |
|---|---|---|
| Screens (the 14 groups) and the 4 dashboards | **This repo**: Next.js front end | Full control over the demo UX |
| Case object, lifecycle, SLA clock, access control, masking, audit | **This repo**: back end + Postgres | One source of truth for case state |
| Orchestration (mailbox polling, acks, reminders, SLA timers, alerts, sub-ticket chasers) | **n8n** | Visual flows the admin can change live |
| Decisions (classification, priority, allocation, SLA thresholds, approval routing, RCA triggers, QA sampling) | **Neutrinos Reels** decision tables | Business-editable rules: success criterion #6 |
| AI (extraction, assessment, duplicate detection, drafting, RCA suggestion) | **Kamios AI Hub** agents | Advisory AI with confidence and rationale |
| Alpha, Pulse | Not used for now | Per direction on 13 Oct |

```
 Outlook mailbox ─┐                       ┌──────────── Reels (decisions) ───────────┐
 Web form ────────┤                       │ classify · priority/target · allocation │
 Folder upload ───┼─► n8n ──► CCMS API ◄──┤ SLA thresholds · approval routing        │
 (audio/letter/   │    ▲        │         │ BU notify · RCA trigger · QA sampling    │
  screenshot)     │    │        │         └──────────────────────────────────────────┘
                  │    │        ▼
                  │    │   Postgres ◄──── Kamios AI Hub (extract · assess · dedupe ·
                  │    │   (cases,         draft reply · RCA suggestion)
                  │    │    SLAs, audit)
                  │    └── outbox events (case.created, sla.near_breach, ...)
                  └── EDS mock API (8 attributes)
```

## Integration contracts

All three integrations sit behind adapters in `src/integrations/`. Each adapter reads
its settings from environment variables. **Until credentials are set, a local fallback
with the same inputs and outputs keeps the demo running**, and the UI labels any
fallback result `local` so it's never mistaken for the real service.

### Kamios AI Hub (`src/integrations/kamios.ts`)

| Agent | Input | Output |
|---|---|---|
| `intake_extraction` | channel, text / transcript / OCR text, attachment refs | the 9 centralised-form field groups, per-field confidence |
| `preliminary_assessment` | case fields, EDS data, prior cases | the 10 BSD 3.1.3 outputs, each `{value, confidence, rationale}` |
| `duplicate_detection` | case + candidate earlier cases | matches `{caseId, score, reason, action: link\|consolidate\|new_linked}` |
| `response_drafting` | case, resolution log, `plainLanguage` flag | draft reply + coaching notes |
| `rca_suggestion` | case, sub-ticket history, closure form | root-cause category, description, suggested CAPA |

Settings: `KAMIOS_BASE_URL`, `KAMIOS_API_TOKEN`, and `KAMIOS_AGENT_<NAME>` for each
agent ID. **Waiting on the API spec and tokens.**

### Reels (`src/integrations/reels.ts`)

One Reels product per decision. The CCMS sends the case facts and gets back the outputs:

| Decision | Key inputs | Outputs |
|---|---|---|
| `case_classification` | nature (from AI), keywords, LOB, regulator hints | regulatory flag, FIDREC, data classification |
| `priority_target` | nature, significance, vulnerable, FIDREC, regulatory | priority, target resolution working days |
| `allocation` | LOB, nature, FIDREC, significance, vulnerable | BU, team, required staff profile |
| `sla_thresholds` | nature, BU, priority | ack days, resolution days, near-breach %, escalation recipients |
| `bu_notification` | agent involved, regulatory flag | notify distribution / compliance |
| `approval_routing` | nature, BU, significance | approval steps (ordered roles), or none for the simplified flow |
| `rca_trigger` | 5 criteria + CE flag | RCA required, reason |
| `qa_sampling` | nature, BU, case manager, outcome, random seed | sampled, reason |

Settings: `REELS_BASE_URL`, `REELS_API_TOKEN`, and `REELS_PRODUCT_<DECISION>`. The
local fallbacks in `src/integrations/reels-local.ts` mirror the Reels tables, so the
two can be compared line by line.

### n8n (`src/integrations/n8n.ts`)

- **CCMS → n8n:** every state change writes an `OutboxEvent` row. If
  `N8N_EVENT_WEBHOOK_URL` is set, the event is POSTed there; n8n can also poll
  `GET /api/events?after=<cursor>`.
- **n8n → CCMS:** n8n calls the CCMS API with `Authorization: Bearer $CCMS_SERVICE_TOKEN`:
  - `POST /api/intake`: a new item from the mailbox, form or folder
  - `POST /api/sla/tick`: the scheduled SLA scan; emits `sla.near_breach` / `sla.breached`
  - `POST /api/communications/{id}/delivery`: the result of a send (`sent`/`delivered`/`failed`)
  - `POST /api/cases/{id}/inbound`: a customer reply matched to a case (alerts the case manager)
  - `GET /api/events?after=<seq>`: poll the outbox instead of receiving webhooks
  - `GET /api/audit/verify`: recompute the audit hash chain
- Planned n8n workflows: Outlook intake poller, folder intake, acknowledgement sender
  (email, SMS simulated), SLA tick every 5 minutes, near-breach/breach alerts,
  sub-ticket reminders, closure-SLA auto-close.

## Case model (one case object, seven stages)

Stages: `intake → acknowledgement → assessment → investigation → resolution → closure → rca_qa`.
Natures: `complaint`, `feedback`, `enquiry`, `appeal`. Service requests are treated as
an enquiry subtype for now (an open question with Income).

- **Complaint:** the full path. Sub-tickets, escalation, closure form with approval,
  RCA/QA when triggered.
- **Feedback / enquiry / service request:** the simplified flow, with no approval
  (`approval_routing` returns no steps).
- **Appeal:** allocated to the owning BU. The core-system update is noted as
  happening outside CCMS.
- **Rejected resolution or customer re-open:** goes back to `investigation`, and the
  SLA clock carries on (it pauses but doesn't reset).

Main tables: `Case`, `CaseAssessment` (the 10 outputs: AI value, confidence, rationale,
final value, who revised it), `CaseLink`, `SubTicket` (+ `SubTicketMessage`),
`Communication`, `Escalation` (+ opinions), `ClosureForm` (+ per-field approver
verdicts), `Approval`, `SlaClock`, `SlaExtension`, `RcaTicket`, `CapaAction`,
`QaAssessment`, `LessonLearnt`, `Customer`, `Policy`, `Attachment`, `AuditEntry`
(hash-chained), `ReadLog` (audit-on-read), `OutboxEvent`.

## Governance

- Roles match the nine personas: `frontliner`, `case_manager`, `team_lead`,
  `bu_staff`, `ce_team`, `head_of_ce`, `qa`, `admin`, plus `service` for n8n.
- Record-level access follows BSD section 7. Case managers edit only cases assigned
  to them, BU staff only their sub-tickets, team leads re-allocate, and QA sees only
  the QA module.
- Confidential, VVIP and vulnerable cases are masked on the query page for anyone
  not on the case. Every query-page view writes a `ReadLog` row.
- The audit trail is a hash chain: `hash = sha256(prevHash + entry)`. `GET /api/audit/verify` recomputes it.

## Build plan

Week 1 (to the 16 Oct playback): case model, Reels/Kamios adapters with
fallbacks, intake API + n8n intake flow, centralised form, My cases, Case 360,
Assessment console, SLA clock, EDS mock.

Week 2: sub-tickets, Communication Module, escalation + PDF, closure form and
approvals, RCA/CAPA, QA, query page with masking, the 4 dashboards with Excel
export, admin console (links into Reels/n8n plus local settings), demo seed data
for the 6 scripted scenarios. Dry run 22 Oct.

## Open items needed from Neutrinos / Income

1. Kamios AI Hub API spec, agent IDs and token.
2. Reels environment URL, token and execution API format (or confirmation to
   build the products from `reels-local.ts` with the Reels skill).
3. The n8n instance to deploy workflows to.
4. Income's sample cases, taxonomy, SLA matrix, allocation rules and closure-form
   fields (due 15 Oct; synthetic data otherwise).
