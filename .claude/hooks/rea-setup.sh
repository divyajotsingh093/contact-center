#!/bin/bash
# Cloud-session setup: REA (rea-agents) for Claude Code, plus the CCMS dev
# environment (dependencies, Postgres, migrations, seed data).
# Only runs in Claude Code cloud sessions, whose containers start fresh each time.
set -uo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

npx -y rea-agents@6.4.0 setup --yes --client claude_code >/dev/null 2>&1 \
  || echo "rea-agents setup failed; run 'npx rea-agents setup' manually" >&2

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

if [ -f package.json ] && [ ! -d node_modules ]; then
  npm install --no-audit --no-fund >/dev/null 2>&1 || echo "npm install failed" >&2
fi

# Local Postgres for the CCMS (matches .env.example).
if command -v pg_ctlcluster >/dev/null 2>&1; then
  pg_ctlcluster 16 main start >/dev/null 2>&1 || true
  su postgres -c "psql -tc \"SELECT 1 FROM pg_roles WHERE rolname='app'\" | grep -q 1 || psql -c \"CREATE USER app WITH PASSWORD 'app' SUPERUSER;\"" >/dev/null 2>&1
  su postgres -c "psql -tc \"SELECT 1 FROM pg_database WHERE datname='contact_center'\" | grep -q 1 || psql -c 'CREATE DATABASE contact_center OWNER app;'" >/dev/null 2>&1
  [ -f .env ] || cp .env.example .env 2>/dev/null
  if [ -d node_modules ]; then
    npx prisma migrate deploy >/dev/null 2>&1 && npm run -s db:seed >/dev/null 2>&1 \
      || echo "CCMS database setup failed; run 'npx prisma migrate deploy && npm run db:seed'" >&2
  fi
fi
exit 0
