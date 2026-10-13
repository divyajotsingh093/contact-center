import { z } from "zod";
import { route } from "@/lib/api";
import { recordDelivery } from "@/ccms/services/communications";

const Body = z.object({ status: z.enum(["sent", "delivered", "failed"]), error: z.string().nullish() });

/** n8n reports the result of a send (or the simulated SMS). */
export const POST = route<z.infer<typeof Body>, { id: string }>({ roles: ["service"], body: Body }, async ({ actor, body, params }) =>
  recordDelivery(params.id, body.status, body.error ?? null, actor.id),
);
