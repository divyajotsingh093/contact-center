import { db } from "@/lib/db";
import { route } from "@/lib/api";

/** Pollable outbox for n8n: GET /api/events?after=<seq>&limit=100 */
export const GET = route({ roles: ["service"] }, async ({ req }) => {
  const url = new URL(req.url);
  const after = Number(url.searchParams.get("after") ?? 0);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 100), 500);
  const events = await db.outboxEvent.findMany({ where: { seq: { gt: after } }, orderBy: { seq: "asc" }, take: limit });
  return { events, cursor: events.at(-1)?.seq ?? after };
});
