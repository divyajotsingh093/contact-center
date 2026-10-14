# Status

Update this at the end of every working session (either tool): what changed, what's next, what's blocked.

## Current state (14 Oct 2026)

**Live:** https://contact-center-eight.vercel.app on Vercel + Neon (seeded with 5 demo cases).

**Done**
- Case model, intake pipeline (centralised form and `/api/intake`), preliminary assessment with confirm/revise,
  SLA clocks, access control and masking, hash-chained audit, outbox events.
- Workspace UI: sidebar and ⌘K command menu, case list, case record (property panel, activity timeline, assessment),
  home, intake, search, empty and loading states.
- Sub-tickets: raise from a case in investigation, BU staff queue and response, re-request, close.
- Reels: 8 decision products compiled in `reels/products/` (not yet imported). Adapter uses the real runtime API.
- AI Hub: 6 agent prompts in `aihub/agents/` (not yet created in AI Hub). Adapter uses the real API.
- n8n: "CCMS - SLA Tick (every 5 min)" created, inactive (workflow 6EUjHpk8BsaoqqMk).

**Blocked on DJ**
- n8n: create the "CCMS API (Vercel)" credential (service token + Vercel bypass header), then activate the SLA tick.
- Reels: import the 8 products; set `REELS_*` workflowIds and client credentials in Vercel env.
- AI Hub: create the 6 agents; set `KAMIOS_BASE_URL`, `KAMIOS_AUTH_HEADER` and the per-agent keys in Vercel env.
- Security: the "GH Group Health Onboarding" n8n workflow has the Reels client secret in plain text in its
  "Reels Config" Code node. Move it to a credential and rotate it.

## Next

1. Resolution and closure: response page (drafting agent), closure form, approvals routed by the Reels
   `approval_routing` decision (team lead, then Head of CE for significant complaints). *(both tools)*
2. n8n flows: sub-ticket reminders, acknowledgement sender, near-breach and breach alerts, mailbox intake. *(Cowork)*
3. Escalations, RCA and CAPA, QA sampling, the 4 dashboards, admin console. *(both tools)*
