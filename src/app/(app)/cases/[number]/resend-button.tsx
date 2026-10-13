"use client";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { resendAction } from "./actions";

export function ResendButton({ number, communicationId }: { number: string; communicationId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      size="xs"
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await resendAction(number, communicationId);
          if (r.ok) toast.success(r.message);
          else toast.error(r.error);
        })
      }
    >
      Re-send
    </Button>
  );
}
