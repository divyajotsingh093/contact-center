#!/bin/bash
# Configure the REA (rea-agents) MCP server and skill for Claude Code.
# Only runs in Claude Code cloud sessions, whose containers start fresh each time.
set -uo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

npx -y rea-agents@6.4.0 setup --yes --client claude_code >/dev/null 2>&1 \
  || echo "rea-agents setup failed; run 'npx rea-agents setup' manually" >&2
exit 0
