"use client";
import { useTransition } from "react";
import { toast } from "sonner";
import { Icon } from "@/components/ccms/icons";
import { Tick02Icon } from "@/components/ccms/icons";
import { Button } from "@/components/ui/button";
import { confirmAssessmentAction } from "./actions";

/** Confirms the preliminary assessment and moves the case to investigation. */
export function ConfirmAssessmentButton({ number, caseId }: { number: string; caseId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await confirmAssessmentAction(number, caseId);
          if (r.ok) toast.success(r.message);
          else toast.error(r.error);
        })
      }
    >
      <Icon icon={Tick02Icon} aria-hidden />
      {pending ? "Confirming…" : "Confirm assessment"}
    </Button>
  );
}
