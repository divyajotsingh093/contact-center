import type { Prisma } from "@prisma/client";

/** Gap-free, per-key sequence inside the caller's transaction. */
export async function nextNumber(tx: Prisma.TransactionClient, key: string, prefix: string, width = 6): Promise<string> {
  const row = await tx.numberCounter.upsert({
    where: { key },
    create: { key, next: 2 },
    update: { next: { increment: 1 } },
  });
  return `${prefix}${String(row.next - 1).padStart(width, "0")}`;
}
