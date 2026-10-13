/**
 * Reels adapter. Calls the deployed Reels product for a decision when
 * REELS_BASE_URL is set, otherwise evaluates the local table.
 *
 * Admins can override a local table (Setting "reels_local:<decision>") so the
 * "change a rule live" demo step works before Reels is wired up.
 */
import { db } from "@/lib/db";
import { evaluateTable, type DecisionTable } from "./decision-table";
import { LOCAL_TABLES, type DecisionName } from "./reels-local";

export interface Decision<T = Record<string, unknown>> {
  outputs: T;
  rationale: string;
  source: "reels" | "local";
}

function reelsConfig(decision: DecisionName) {
  const baseUrl = process.env.REELS_BASE_URL;
  const token = process.env.REELS_API_TOKEN;
  const product = process.env[`REELS_PRODUCT_${decision.toUpperCase()}`];
  return baseUrl && token && product ? { baseUrl, token, product } : null;
}

export async function localTable(decision: DecisionName): Promise<DecisionTable> {
  const override = await db.setting.findUnique({ where: { key: `reels_local:${decision}` } }).catch(() => null);
  return (override?.value as unknown as DecisionTable) ?? LOCAL_TABLES[decision];
}

export async function decide<T = Record<string, unknown>>(
  decision: DecisionName,
  facts: Record<string, unknown>,
): Promise<Decision<T>> {
  const cfg = reelsConfig(decision);
  if (cfg) {
    // Execution API shape to be confirmed with the Reels team; this follows the
    // product-execute pattern (POST facts, receive the output object).
    const res = await fetch(`${cfg.baseUrl.replace(/\/$/, "")}/products/${cfg.product}/execute`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${cfg.token}` },
      body: JSON.stringify({ input: facts }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Reels ${decision} failed: ${res.status} ${await res.text()}`);
    const body = (await res.json()) as { output?: T; result?: T; rationale?: string };
    return {
      outputs: (body.output ?? body.result ?? body) as T,
      rationale: body.rationale ?? `Reels product ${cfg.product}`,
      source: "reels",
    };
  }
  const result = evaluateTable(await localTable(decision), facts);
  return { outputs: result.outputs as T, rationale: result.rationale, source: "local" };
}
