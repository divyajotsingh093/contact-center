import { route } from "@/lib/api";
import { resend } from "@/ccms/services/communications";
import { flushOutbox } from "@/integrations/n8n";

export const POST = route<undefined, { id: string }>({ roles: ["case_manager", "service"] }, async ({ actor, params }) => {
  const comm = await resend(params.id, actor.id);
  void flushOutbox();
  return comm;
});
