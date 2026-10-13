import { z } from "zod";
import { route } from "@/lib/api";
import { recordInbound } from "@/ccms/services/communications";
import { flushOutbox } from "@/integrations/n8n";

const Body = z.object({ channel: z.enum(["email", "sms", "call", "letter"]), from: z.string().optional(), subject: z.string().optional(), body: z.string().min(1) });

/** A customer reply matched to a case (by the mailbox poller): alerts the case manager. */
export const POST = route<z.infer<typeof Body>, { id: string }>({ roles: ["service"], body: Body }, async ({ actor, body, params }) => {
  const comm = await recordInbound(params.id, body, actor.id);
  void flushOutbox();
  return comm;
});
