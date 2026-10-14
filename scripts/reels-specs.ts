/**
 * Prints Reels WorkflowSpecs for the local decision tables, one product per
 * decision, so the Reels side is generated from the same source of truth.
 * Run: npx tsx scripts/reels-specs.ts > reels/specs.json
 */
import { LOCAL_TABLES } from "../src/integrations/reels-local";
import type { Cell } from "../src/integrations/decision-table";

function cell(c: Cell): string[] {
  if (typeof c === "boolean" || typeof c === "number") return ["=", String(c)];
  const s = c.trim();
  if (s === "" || s === "*") return ["any"];
  const cmp = /^(>=|<=|>|<)\s*(-?\d+(\.\d+)?)$/.exec(s);
  if (cmp) return [cmp[1], cmp[2]];
  if (s.startsWith("!")) throw new Error(`Negated cell not supported by the Reels spec: ${s}`);
  return ["=", ...s.split(",").map((v) => v.trim())];
}

const specs = Object.entries(LOCAL_TABLES).map(([key, t]) => ({
  key,
  spec: {
    name: `CCMS ${t.name}`,
    description: `Income CCMS decision "${key}". Generated from src/integrations/reels-local.ts; keep row order identical.`,
    tags: ["ccms", "income"],
    flows: [
      {
        name: t.name,
        steps: [
          {
            type: "decision_table",
            name: t.name,
            conditions: t.inputs.map((i) => `case.${i}`),
            results: t.outputs.map((o) => `out.${o}`),
            logic: "AND",
            rows: t.rows.map((r) => ({
              when: Object.fromEntries(t.inputs.map((i) => [`case.${i}`, i in r.when ? cell(r.when[i]) : ["any"]])),
              then: Object.fromEntries(t.outputs.map((o) => [`out.${o}`, String(o in r.then ? r.then[o] : t.defaults[o])])),
            })),
            default: Object.fromEntries(t.outputs.map((o) => [`out.${o}`, String(t.defaults[o])])),
          },
        ],
      },
    ],
  },
}));

console.log(JSON.stringify(specs, null, 2));
