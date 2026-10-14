# Income CCMS POC

Customer Case Management System for the Income POC (BSD v1.2), demo on 23 Oct 2026.

- **This repo:** Next.js front end and back end: the case object, seven-stage lifecycle, SLA clock,
  access control and masking, hash-chained audit trail, and the CCMS screens.
- **n8n:** orchestration (mailbox polling, acknowledgements, SLA ticks and alerts, reminders).
- **Neutrinos Reels:** decision tables (classification, priority, allocation, SLA, approvals, RCA, QA).
- **Neutrinos AI Hub:** AI agents for extraction, assessment, duplicates, drafting, RCA and case summaries (prompts in `aihub/agents/`).

See [`docs/ccms-architecture.md`](docs/ccms-architecture.md) for the design and integration contracts.
Until the Reels and AI Hub credentials are set, local fallbacks with the same contracts run instead,
and the UI labels their output "Local fallback".

## Run locally

The app runs on Vercel with a Neon Postgres database. See `CLAUDE.md` for the working agreement
(which tool owns what, branches, checks) and `docs/status.md` for the current state.

```bash
npm install
vercel link                   # team Neutrinos, project contact-center
vercel env pull .env.local    # database URL, service token, integration settings
npm run dev
```

For a throwaway local database instead, copy `.env.example` to `.env`, point `DATABASE_URL` at it, then
`npx prisma migrate deploy && npm run db:seed && npm run db:demo`.

## Checks

```bash
npm run typecheck
npm run lint
npm test                      # unit tests + integration tests against DATABASE_URL
```

## API for n8n

Authenticate with `Authorization: Bearer $CCMS_SERVICE_TOKEN`. Responses are `{ "result": ... }`.

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/intake` | New item from the mailbox, folder upload, web form or Growhill simulation |
| POST | `/api/communications/{id}/delivery` | Report a send result (`sent` / `delivered` / `failed`) |
| POST | `/api/communications/{id}/resend` | Re-send a failed message |
| POST | `/api/cases/{id}/inbound` | Customer reply matched to a case |
| POST | `/api/sla/tick` | Scheduled SLA scan; emits `sla.near_breach` / `sla.breached` |
| GET | `/api/events?after=<seq>` | Poll outbox events |
| GET | `/api/audit/verify` | Verify the audit hash chain |
