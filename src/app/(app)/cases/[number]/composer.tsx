"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { LockIcon, Mail01Icon, SentIcon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { addNoteAction, emailCustomerAction } from "./actions";

type Mode = "note" | "email";

/** Activity composer: internal work note (team only) or a customer email (sent by n8n). */
export function Composer({
  number,
  caseId,
  canEmail,
  customerEmail,
  defaultSubject,
}: {
  number: string;
  caseId: string;
  canEmail: boolean;
  customerEmail: string | null;
  defaultSubject: string;
}) {
  const [mode, setMode] = useState<Mode>("note");
  const [body, setBody] = useState("");
  const [subject, setSubject] = useState(defaultSubject);
  const [pending, start] = useTransition();
  const emailable = canEmail && Boolean(customerEmail);

  function submit() {
    start(async () => {
      const r = mode === "note" ? await addNoteAction(number, caseId, body) : await emailCustomerAction(number, caseId, subject, body);
      if (r.ok) {
        toast.success(r.message);
        setBody("");
      } else toast.error(r.error);
    });
  }

  return (
    <div
      className={cn(
        "flex flex-col rounded-xl border bg-card shadow-xs",
        mode === "note" ? "border-[#e9d9a8] dark:border-[#5a4a1f]" : "border-black/[0.1] dark:border-white/15",
      )}
    >
      <div role="tablist" aria-label="Message type" className="flex items-center gap-1 border-b border-black/[0.06] px-2 pt-2 dark:border-white/[0.08]">
        {(
          [
            { key: "note", label: "Work note", icon: LockIcon, hint: "Internal, team only" },
            { key: "email", label: "Email customer", icon: Mail01Icon, hint: customerEmail ?? "No email on file" },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            role="tab"
            type="button"
            aria-selected={mode === t.key}
            disabled={t.key === "email" && !emailable}
            onClick={() => setMode(t.key)}
            title={t.hint}
            className={cn(
              "-mb-px flex items-center gap-1.5 border-b-2 px-2.5 pb-2 text-[13px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40",
              mode === t.key ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <HugeiconsIcon icon={t.icon} size={14} aria-hidden />
            {t.label}
          </button>
        ))}
      </div>
      <form
        className="flex flex-col gap-2 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {mode === "email" && (
          <div className="flex items-center gap-2">
            <span className="w-14 shrink-0 text-xs text-muted-foreground">To</span>
            <span className="truncate text-[13px]">{customerEmail}</span>
          </div>
        )}
        {mode === "email" && (
          <div className="flex items-center gap-2">
            <label htmlFor="c-subject" className="w-14 shrink-0 text-xs text-muted-foreground">
              Subject
            </label>
            <Input id="c-subject" value={subject} onChange={(e) => setSubject(e.target.value)} className="h-8" />
          </div>
        )}
        <label htmlFor="c-body" className="sr-only">
          {mode === "note" ? "Work note" : "Email body"}
        </label>
        <Textarea
          id="c-body"
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={mode === "note" ? "Add an internal note for the team…" : "Write to the customer…"}
          className="resize-y border-0 px-0 shadow-none focus-visible:ring-0"
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            {mode === "note" ? "Visible to staff with access to this case." : "Logged in the Communication Module and sent by the platform."}
          </span>
          <Button type="submit" size="sm" disabled={pending || !body.trim()}>
            <HugeiconsIcon icon={mode === "note" ? LockIcon : SentIcon} aria-hidden />
            {mode === "note" ? "Post note" : "Send email"}
          </Button>
        </div>
      </form>
    </div>
  );
}
