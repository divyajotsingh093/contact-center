# Income CCMS: working agreement

Customer Case Management for Income Insurance (Singapore), built by Neutrinos. Requirements: BSD v1.2
(not in the repo); the product should be ServiceNow-class and *able* to meet the BSD, not shaped by it.

**Read `docs/status.md` first**: it says what was done last and what's next. Update it before you finish.

## Stack (fixed)

| Concern | Where |
|---|---|
| Rules (classification, priority, allocation, SLA, approvals, RCA, QA) | **Neutrinos Reels**: products in `reels/products/`, source of truth `src/integrations/reels-local.ts` |
| AI agents (extraction, assessment, duplicates, drafting, RCA, summary) | **Neutrinos AI Hub**: prompts in `aihub/agents/`, contracts in `src/integrations/kamios.ts` |
| Orchestration (intake polling, acks, SLA tick, alerts, reminders) | **n8n** (djdev.app.n8n.cloud), calls the CCMS API |
| Case system: screens, case model, lifecycle, SLA clock, access, audit | **This repo**: Next.js 15 + Prisma |
| Hosting, database | **Vercel** (team Neutrinos, project `contact-center`, region sin1) + **Neon Postgres** via the Vercel Marketplace |

Production: https://contact-center-eight.vercel.app (Vercel login protection on every deployment).

## Who works where

Two tools work on this repo. Stay in your lane; anything across the line goes in the PR description.

- **Claude Code: front end.** `src/app/**` pages and client components, `src/components/**`, `src/app/globals.css`,
  icons, layout, design. Design rules below.
- **Cowork: everything else.** Domain and services (`src/ccms/**`), integrations (`src/integrations/**`), Prisma
  schema and migrations, API routes (`src/app/api/**`), Reels products, AI Hub agents, n8n workflows, seed and
  demo data, docs.
- **The contract between them:** server actions (`src/app/**/actions.ts`), query functions (`src/ccms/queries.ts`)
  and the types they return. Either side may add to them; changing an existing signature needs a note in the PR
  and in `docs/status.md`.

## Git workflow

- `main` is the trunk and deploys to production. Don't push to `main` directly and never force-push it.
- One short-lived branch per task: `ui/<topic>` (Claude Code) or `platform/<topic>` (Cowork).
  Start from an up-to-date `main` (`git pull --rebase origin main`).
- Open a PR into `main`. Vercel builds a preview for every PR. Merge when checks pass; production redeploys.
- Small PRs. If both tools need the same file, the second one rebases on the first.

## Setup

```bash
npm install                      # also generates the Prisma client
vercel link                      # team: Neutrinos, project: contact-center
vercel env pull .env.local       # Neon, service token, integration settings
npm run dev
```

Migrations against Neon use the unpooled URL:
`set -a; . ./.env.local; set +a; DATABASE_URL=$DATABASE_URL_UNPOOLED npx prisma migrate deploy`

## Checks before a PR

```bash
npm run typecheck && npm run lint
npx vitest run tests/engines.test.ts tests/integrations.test.ts
```

`tests/integration/*` writes to whatever `DATABASE_URL` points at. Don't run it against the shared Neon database.

## Front-end rules (Claude Code)

- Look: quiet and near-monochrome, in the manner of Attio, Notion and Lightfield. White surfaces, a 1px ring plus
  faint shadow (`shadow-card`) instead of hard borders, 8 to 10px radii, a black primary button. **Don't add
  colours**: colour is only for data (SLA state, priority dots, confidence bars) and the Neutrinos logo.
- Type: Inter at medium weight with `ss03`; 13px interface text (`text-sm`). No Geist, Poppins or Lato.
- Tokens live in `src/app/globals.css`; use them, not raw hex.
- Icons: Phosphor, vendored in `src/components/ccms/icons.tsx` (no icon package). Add new ones there.
- Building blocks: `src/components/ui/*` (Radix based), `Empty`, the command menu (`ui/command-menu.tsx`),
  `ActivityTimeline`. Motion uses the `--ease-out` curve and 150 to 250ms.
- Every list or panel needs loading, empty and error states. Keyboard focus must stay visible.

## Platform rules (Cowork)

- **Reels:** change rules in `reels-local.ts`, then `npx tsx scripts/reels-specs.ts > reels/specs.json`, compile
  each spec with the Reels MCP (`reels_compile_workflow`) into `reels/products/`, and re-import into Reels.
  Keep row order identical; the app falls back to the local table when Reels isn't configured.
- **AI Hub:** agent contracts are the types in `kamios.ts`; prompts must return exactly those JSON shapes.
  The app calls `conversation/create` then `message/create` and reads `output.text`.
- **n8n:** workflows call the CCMS API with `Authorization: Bearer $CCMS_SERVICE_TOKEN` and the Vercel
  `x-vercel-protection-bypass` header, both from the "CCMS API (Vercel)" credential. CCMS emits outbox events
  (`src/integrations/n8n.ts`) for n8n to act on.
- **Secrets never go in code, workflows or prompts.** Vercel env is the source; n8n keeps them in credentials.

## Where things are

- `docs/ccms-architecture.md`: integration contracts, case model, governance, build plan.
- `docs/status.md`: current state, open items, next steps (keep it current).
- `aihub/README.md`: setting up the AI Hub agents.
