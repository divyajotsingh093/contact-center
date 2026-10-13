"use server";
import { redirect } from "next/navigation";
import { requireActor } from "@/ccms/session";
import { kamios, type ExtractedFields } from "@/integrations/kamios";
import { intakeCase } from "@/ccms/services/intake";
import { flushOutbox } from "@/integrations/n8n";
import { SOURCES } from "@/ccms/constants";

export interface SourceInput {
  source: string;
  text: string;
  subject?: string;
  sender?: string;
  fileName?: string;
  mimeType?: string;
}

function attachmentsOf(input: SourceInput) {
  return input.fileName ? [{ fileName: input.fileName, mimeType: input.mimeType ?? "application/octet-stream", extractedText: input.text }] : undefined;
}

export async function extractAction(input: SourceInput): Promise<{ ok: true; fields: ExtractedFields; source: string } | { ok: false; error: string }> {
  await requireActor();
  if (!input.text.trim()) return { ok: false, error: "Add the source text first." };
  try {
    const { result, source } = await kamios.extract({ ...input, attachments: attachmentsOf(input) });
    return { ok: true, fields: result, source };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Extraction failed." };
  }
}

export async function logCaseAction(input: SourceInput, overrides: Record<string, unknown>): Promise<{ ok: false; error: string }> {
  const actor = await requireActor();
  if (!(SOURCES as readonly string[]).includes(input.source)) return { ok: false, error: "Choose a source." };
  let number: string;
  try {
    const r = await intakeCase({ ...input, attachments: attachmentsOf(input), overrides }, actor.id);
    number = r.number;
    void flushOutbox();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not log the case." };
  }
  redirect(`/cases/${number}`);
}
