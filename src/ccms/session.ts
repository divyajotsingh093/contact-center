/**
 * POC authentication (SSO is out of scope):
 *  - UI: a persona picker sets the "ccms_user" cookie.
 *  - n8n / service calls: Authorization: Bearer $CCMS_SERVICE_TOKEN.
 */
import { cookies, headers } from "next/headers";
import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import type { Actor } from "./access";

export const SESSION_COOKIE = "ccms_user";

function safeEqual(a: string, b: string) {
  const A = Buffer.from(a);
  const B = Buffer.from(b);
  return A.length === B.length && timingSafeEqual(A, B);
}

async function actorFor(userId: string): Promise<Actor | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { ledTeams: { select: { id: true } } },
  });
  if (!user || !user.active) return null;
  return {
    id: user.id,
    name: user.name,
    roles: user.roles,
    buId: user.buId,
    teamId: user.teamId,
    ledTeamIds: user.ledTeams.map((t) => t.id),
  };
}

export async function currentActor(): Promise<Actor | null> {
  const h = await headers();
  const auth = h.get("authorization");
  const serviceToken = process.env.CCMS_SERVICE_TOKEN;
  if (auth?.startsWith("Bearer ") && serviceToken && safeEqual(auth.slice(7), serviceToken)) {
    const svc = await db.user.findFirst({ where: { roles: { has: "service" } } });
    return svc ? actorFor(svc.id) : null;
  }
  const id = (await cookies()).get(SESSION_COOKIE)?.value;
  return id ? actorFor(id) : null;
}

export class UnauthorizedError extends Error {}
export class ForbiddenError extends Error {}

export async function requireActor(): Promise<Actor> {
  const actor = await currentActor();
  if (!actor) throw new UnauthorizedError("Sign in first.");
  return actor;
}
