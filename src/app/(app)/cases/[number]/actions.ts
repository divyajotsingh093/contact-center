"use server";
import { revalidatePath } from "next/cache";
import { requireActor } from "@/ccms/session";
import { confirmAssessment, reviseOutput } from "@/ccms/services/assessment";
import { resend } from "@/ccms/services/communications";
import { addWorkNote, emailCustomer } from "@/ccms/services/notes";
import type { AssessmentOutput } from "@/ccms/constants";
import { flushOutbox } from "@/integrations/n8n";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

async function run(path: string, fn: () => Promise<unknown>, message?: string): Promise<ActionResult> {
  try {
    await fn();
    void flushOutbox();
    revalidatePath(path);
    return { ok: true, message };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function reviseAssessmentAction(number: string, caseId: string, output: AssessmentOutput, value: string) {
  const actor = await requireActor();
  return run(`/cases/${number}`, () => reviseOutput(caseId, output, value, actor), "Assessment updated");
}

export async function confirmAssessmentAction(number: string, caseId: string) {
  const actor = await requireActor();
  return run(`/cases/${number}`, () => confirmAssessment(caseId, actor), "Assessment confirmed. Case moved to investigation.");
}

export async function resendAction(number: string, communicationId: string) {
  const actor = await requireActor();
  return run(`/cases/${number}`, () => resend(communicationId, actor.id), "Message re-queued");
}

export async function addNoteAction(number: string, caseId: string, body: string) {
  const actor = await requireActor();
  return run(`/cases/${number}`, () => addWorkNote(caseId, body, actor), "Work note added");
}

export async function emailCustomerAction(number: string, caseId: string, subject: string, body: string) {
  const actor = await requireActor();
  return run(`/cases/${number}`, () => emailCustomer(caseId, subject, body, actor), "Email queued for sending");
}
