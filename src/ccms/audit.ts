/**
 * Tamper-evident audit trail: each entry stores sha256(prevHash + canonical
 * entry). Editing or deleting any row breaks every hash after it.
 */
import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export const GENESIS = "0".repeat(64);

export interface AuditPayload {
  entity: string;
  entityId: string;
  action: string;
  changes: unknown;
  actorId: string | null;
  createdAt: Date;
}

/** Stable JSON: object keys sorted, so the same entry always hashes the same. */
export function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value ?? null);
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .sort()
    .filter((k) => obj[k] !== undefined)
    .map((k) => `${JSON.stringify(k)}:${canonical(obj[k])}`)
    .join(",")}}`;
}

export function hashEntry(prevHash: string, e: AuditPayload): string {
  return createHash("sha256")
    .update(prevHash)
    .update(canonical({ ...e, createdAt: e.createdAt.toISOString() }))
    .digest("hex");
}

/** Arbitrary constant for the advisory lock that serialises audit appends. */
const AUDIT_LOCK = 734_221;

export async function appendAudit(
  tx: Prisma.TransactionClient,
  entry: Omit<AuditPayload, "createdAt">,
): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${AUDIT_LOCK})`;
  const last = await tx.auditEntry.findFirst({ orderBy: { seq: "desc" }, select: { hash: true } });
  const prevHash = last?.hash ?? GENESIS;
  // Drop sub-millisecond precision so the stored value round-trips exactly.
  const createdAt = new Date(Math.floor(Date.now()));
  const changes = JSON.parse(JSON.stringify(entry.changes ?? {}));
  const hash = hashEntry(prevHash, { ...entry, changes, createdAt });
  await tx.auditEntry.create({
    data: { ...entry, changes: changes as Prisma.InputJsonValue, prevHash, hash, createdAt },
  });
}

export interface VerifyResult {
  ok: boolean;
  checked: number;
  brokenAtSeq?: number;
}

export async function verifyAuditChain(): Promise<VerifyResult> {
  let prev = GENESIS;
  let checked = 0;
  let cursor = 0;
  for (;;) {
    const batch = await db.auditEntry.findMany({ where: { seq: { gt: cursor } }, orderBy: { seq: "asc" }, take: 1000 });
    if (!batch.length) break;
    for (const e of batch) {
      const expected = hashEntry(prev, {
        entity: e.entity,
        entityId: e.entityId,
        action: e.action,
        changes: e.changes,
        actorId: e.actorId,
        createdAt: e.createdAt,
      });
      if (e.prevHash !== prev || e.hash !== expected) return { ok: false, checked, brokenAtSeq: e.seq };
      prev = e.hash;
      checked++;
      cursor = e.seq;
    }
  }
  return { ok: true, checked };
}

/** Field-level diff for update entries. */
export function diff(before: Record<string, unknown>, after: Record<string, unknown>): Record<string, { from: unknown; to: unknown }> {
  const out: Record<string, { from: unknown; to: unknown }> = {};
  for (const k of Object.keys(after)) {
    if (["updatedAt", "updatedBy"].includes(k)) continue;
    const a = before[k] instanceof Date ? (before[k] as Date).toISOString() : before[k];
    const b = after[k] instanceof Date ? (after[k] as Date).toISOString() : after[k];
    if (canonical(a) !== canonical(b)) out[k] = { from: a ?? null, to: b ?? null };
  }
  return out;
}
