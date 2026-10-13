/**
 * A small first-hit decision-table evaluator in the shape of a Reels
 * DECISION_TABLE node: ordered rows, each with input conditions and outputs.
 *
 * Condition cells:
 *   "*" or "" ...... any value
 *   "a,b,c" ........ one of (case-insensitive)
 *   "!a" ........... not a
 *   ">=3" "<2" ..... numeric comparison
 *   true / false ... boolean match
 */

export type Cell = string | number | boolean;

export interface DecisionRow {
  when: Record<string, Cell>;
  then: Record<string, unknown>;
  /** Shown as the rationale when this row fires. */
  note?: string;
}

export interface DecisionTable {
  name: string;
  inputs: string[];
  outputs: string[];
  rows: DecisionRow[];
  /** Used when no row matches. */
  defaults: Record<string, unknown>;
}

function cellMatches(cell: Cell, actual: unknown): boolean {
  if (typeof cell === "boolean") return Boolean(actual) === cell;
  if (typeof cell === "number") return Number(actual) === cell;
  const c = cell.trim();
  if (c === "" || c === "*") return true;
  const a = actual === null || actual === undefined ? "" : String(actual).toLowerCase();
  const cmp = /^(>=|<=|>|<)\s*(-?\d+(\.\d+)?)$/.exec(c);
  if (cmp) {
    const n = Number(actual);
    if (actual === null || actual === undefined || isNaN(n)) return false;
    const v = Number(cmp[2]);
    return cmp[1] === ">=" ? n >= v : cmp[1] === "<=" ? n <= v : cmp[1] === ">" ? n > v : n < v;
  }
  if (c.startsWith("!")) return !c.slice(1).split(",").map((s) => s.trim().toLowerCase()).includes(a);
  return c.split(",").map((s) => s.trim().toLowerCase()).includes(a);
}

export interface DecisionResult {
  outputs: Record<string, unknown>;
  /** Index of the row that fired, or -1 for defaults. */
  row: number;
  rationale: string;
}

export function evaluateTable(table: DecisionTable, facts: Record<string, unknown>): DecisionResult {
  for (let i = 0; i < table.rows.length; i++) {
    const row = table.rows[i];
    if (Object.entries(row.when).every(([k, cell]) => cellMatches(cell, facts[k]))) {
      return {
        outputs: { ...table.defaults, ...row.then },
        row: i,
        rationale: row.note ?? `${table.name} rule ${i + 1}`,
      };
    }
  }
  return { outputs: { ...table.defaults }, row: -1, rationale: `${table.name}: no rule matched, defaults applied` };
}
