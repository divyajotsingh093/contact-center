import { z } from "zod";
import { route } from "@/lib/api";
import { SOURCES } from "@/ccms/constants";
import { intakeCase } from "@/ccms/services/intake";
import { flushOutbox } from "@/integrations/n8n";

const Body = z.object({
  source: z.enum(SOURCES),
  text: z.string().min(1),
  subject: z.string().optional(),
  sender: z.string().optional(),
  channelRef: z.string().optional(),
  receivedAt: z.coerce.date().optional(),
  attachments: z
    .array(z.object({ fileName: z.string(), mimeType: z.string(), sizeBytes: z.number().optional(), extractedText: z.string().optional() }))
    .optional(),
  overrides: z.record(z.unknown()).optional(),
});

/** n8n (mailbox / folder pollers), the web form, Growhill simulation. */
export const POST = route({ roles: ["service", "frontliner", "case_manager"], body: Body }, async ({ actor, body }) => {
  const result = await intakeCase(body, actor.id);
  void flushOutbox();
  return result;
});
