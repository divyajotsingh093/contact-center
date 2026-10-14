import { route } from "@/lib/api";
import { slaTick } from "@/ccms/services/sla-service";
import { flushOutbox } from "@/integrations/n8n";

/** Called by the n8n schedule; emits sla.near_breach / sla.breached events. */
export const POST = route({ roles: ["service"] }, async () => {
  const result = await slaTick();
  const delivery = await flushOutbox();
  return { ...result, delivery };
});
