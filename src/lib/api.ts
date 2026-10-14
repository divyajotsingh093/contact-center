import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { ForbiddenError, UnauthorizedError, requireActor } from "@/ccms/session";
import type { Actor } from "@/ccms/access";

export function json(data: unknown, status = 200) {
  return NextResponse.json({ result: data }, { status });
}

export function errorResponse(err: unknown) {
  if (err instanceof UnauthorizedError) return NextResponse.json({ error: { message: err.message } }, { status: 401 });
  if (err instanceof ForbiddenError) return NextResponse.json({ error: { message: err.message } }, { status: 403 });
  if (err instanceof ZodError) {
    return NextResponse.json({ error: { message: "Invalid request", detail: err.flatten() } }, { status: 400 });
  }
  const code = (err as { code?: string })?.code;
  if (code === "P2025") return NextResponse.json({ error: { message: "Not found" } }, { status: 404 });
  console.error(err);
  return NextResponse.json({ error: { message: err instanceof Error ? err.message : "Internal error" } }, { status: 500 });
}

/** Wraps a route: resolves the actor, checks roles, parses the body, maps errors. */
export function route<B, P = Record<string, string>>(
  opts: { roles?: string[]; body?: ZodType<B> },
  handler: (ctx: { actor: Actor; body: B; params: P; req: Request }) => Promise<unknown>,
) {
  return async (req: Request, ctx: { params: Promise<P> }) => {
    try {
      const actor = await requireActor();
      if (opts.roles && !opts.roles.some((r) => actor.roles.includes(r)) && !actor.roles.includes("admin")) {
        throw new ForbiddenError("Your role cannot do this.");
      }
      const body = opts.body ? opts.body.parse(await req.json()) : (undefined as B);
      return json(await handler({ actor, body, params: await ctx.params, req }));
    } catch (err) {
      return errorResponse(err);
    }
  };
}
