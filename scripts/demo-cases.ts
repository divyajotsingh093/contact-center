/**
 * Loads the demo samples through the real intake pipeline (local fallbacks
 * unless Kamios / Reels are configured). Run after `npm run db:seed`.
 */
import { db } from "@/lib/db";
import { intakeCase } from "@/ccms/services/intake";
import { recordDelivery } from "@/ccms/services/communications";
import { SAMPLES } from "@/ccms/demo/samples";
import { slaTick } from "@/ccms/services/sla-service";

async function main() {
  for (const [i, s] of SAMPLES.entries()) {
    const ref = `demo-${s.key}`;
    if (await db.case.findFirst({ where: { channelRef: ref } })) continue;
    const r = await intakeCase(
      {
        source: s.source,
        text: s.text,
        subject: s.subject,
        sender: s.sender,
        channelRef: ref,
        // Stagger arrival so SLA clocks show a spread of states.
        receivedAt: new Date(Date.now() - (i + 1) * 26 * 3600_000),
        attachments: s.fileName ? [{ fileName: s.fileName, mimeType: s.mimeType ?? "application/octet-stream", extractedText: s.text }] : undefined,
      },
      null,
    );
    // Acknowledge all but the last two, so some cases sit in the acknowledgement stage.
    if (i < SAMPLES.length - 2) {
      const ack = await db.communication.findFirst({ where: { caseId: r.caseId, purpose: "acknowledgement" } });
      if (ack) await recordDelivery(ack.id, "delivered", null, null);
    }
    console.log(`${r.number}  ${s.label}`);
  }
  // Raise any SLA alerts now due, as the n8n schedule would.
  const tick = await slaTick();
  console.log(`SLA tick: ${tick.nearBreach} near-breach, ${tick.breached} breached`);
}

main().finally(() => db.$disconnect());
