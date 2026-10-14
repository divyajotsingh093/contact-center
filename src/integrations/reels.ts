/**
 * Reels adapter. Calls the deployed Reels product for a decision when the
 * REELS_* settings are present, otherwise evaluates the local table.
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

/**
 * Reels runtime (Neutrinos apps): a client-credentials token from the IDS, then
 * POST /integration/api/runtime/sync with the product's workflowId. This is the
 * same call the GH and Deem n8n flows make.
 */
function reelsConfig(decision: DecisionName) {
  const baseUrl = process.env.REELS_BASE_URL; // e.g. https://sandbox.neutrinos-apps.com
  const idsUrl = process.env.REELS_IDS_URL; // e.g. https://sandbox-ids.neutrinos-apps.com
  const clientId = process.env.REELS_CLIENT_ID;
  const clientSecret = process.env.REELS_CLIENT_SECRET;
  const workflowId = process.env[`REELS_PRODUCT_${decision.toUpperCase()}`];
  return baseUrl && idsUrl && clientId && clientSecret && workflowId
    ? { baseUrl: baseUrl.replace(/\/$/, ""), idsUrl: idsUrl.replace(/\/$/, ""), clientId, clientSecret, workflowId, version: process.env.REELS_PRODUCT_VERSION ?? "1.0.0" }
    : null;
}

let token: { value: string; expiresAt: number } | null = null;

async function accessToken(cfg: NonNullable<ReturnType<typeof reelsConfig>>): Promise<string> {
  if (token && token.expiresAt > Date.now() + 30_000) return token.value;
  const res = await fetch(`${cfg.idsUrl}/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: cfg.clientId, client_secret: cfg.clientSecret }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Reels token exchange failed: ${res.status}`);
  const body = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!body.access_token) throw new Error("Reels token exchange returned no access_token");
  token = { value: body.access_token, expiresAt: Date.now() + (body.expires_in ?? 300) * 1000 };
  return token.value;
}

/** Reels returns every cell as text; restore the types the local table uses for each output. */
function coerce(decision: DecisionName, out: Record<string, unknown>): Record<string, unknown> {
  const defaults = LOCAL_TABLES[decision].defaults;
  return Object.fromEntries(
    Object.entries(out).map(([k, v]) => {
      const kind = typeof defaults[k];
      if (kind === "boolean") return [k, v === true || String(v).toLowerCase() === "true"];
      if (kind === "number") return [k, Number(v)];
      return [k, v];
    }),
  );
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
    const res = await fetch(`${cfg.baseUrl}/integration/api/runtime/sync`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json", authorization: `Bearer ${await accessToken(cfg)}` },
      // The products are generated from reels-local.ts with every input under `case.*`.
      body: JSON.stringify({ workflowId: cfg.workflowId, version: cfg.version, inputObj: { case: facts }, subFlowIDs: [] }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`Reels ${decision} failed: ${res.status} ${await res.text()}`);
    const body = (await res.json()) as { result?: { out?: Record<string, unknown> } & Record<string, unknown>; run_id?: string; error?: unknown };
    if (body.error || !body.result) throw new Error(`Reels ${decision} returned no result: ${JSON.stringify(body).slice(0, 300)}`);
    return {
      outputs: coerce(decision, (body.result.out ?? body.result) as Record<string, unknown>) as T,
      rationale: `Reels ${LOCAL_TABLES[decision].name}${body.run_id ? ` (run ${body.run_id})` : ""}`,
      source: "reels",
    };
  }
  const result = evaluateTable(await localTable(decision), facts);
  return { outputs: result.outputs as T, rationale: result.rationale, source: "local" };
}
