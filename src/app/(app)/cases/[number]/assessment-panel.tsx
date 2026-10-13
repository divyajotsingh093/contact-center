"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { Edit02Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { ASSESSMENT_LABELS, ASSESSMENT_OUTPUTS, DATA_CLASSIFICATIONS, NATURES, PRIORITIES, REGULATORS, type AssessmentOutput } from "@/ccms/constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { SourceBadge } from "@/components/ccms/badges";
import { cn } from "@/lib/utils";
import { confirmAssessmentAction, reviseAssessmentAction } from "./actions";

export interface AssessmentRow {
  output: string;
  aiValue: string | null;
  finalValue: string | null;
  confidence: number | null;
  rationale: string | null;
  source: string;
  status: string;
}

const CHOICES: Partial<Record<AssessmentOutput, readonly string[]>> = {
  case_nature: NATURES,
  regulatory_flag: REGULATORS,
  fidrec: ["yes", "no"],
  reopened_case: ["yes", "no"],
  priority: PRIORITIES,
  potential_chr: ["yes", "no"],
  potential_significant: ["yes", "no"],
  data_classification: DATA_CLASSIFICATIONS,
};

function Confidence({ value }: { value: number | null }) {
  if (value === null) return null;
  const pct = Math.round(value * 100);
  const tone = pct >= 80 ? "bg-success" : pct >= 60 ? "bg-warning" : "bg-destructive";
  return (
    <div className="flex items-center gap-2" title={`${pct}% confidence`}>
      <div className="h-1 w-14 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div className={cn("h-full", tone)} style={{ width: `${pct}%` }} />
      </div>
      <span className="tabular text-xs text-muted-foreground">{pct}%</span>
    </div>
  );
}

export function AssessmentPanel({
  number,
  caseId,
  rows,
  canEdit,
  stage,
}: {
  number: string;
  caseId: string;
  rows: AssessmentRow[];
  canEdit: boolean;
  stage: string;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [pending, start] = useTransition();
  const byOutput = new Map(rows.map((r) => [r.output, r]));
  const awaitingConfirm = ["intake", "acknowledgement", "assessment"].includes(stage);

  function save(output: AssessmentOutput) {
    start(async () => {
      const r = await reviseAssessmentAction(number, caseId, output, draft);
      if (r.ok) {
        toast.success(r.message);
        setEditing(null);
      } else toast.error(r.error);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="divide-y divide-black/[0.06] rounded-xl border border-black/[0.08] dark:divide-white/[0.08] dark:border-white/10">
        {ASSESSMENT_OUTPUTS.map((output) => {
          const r = byOutput.get(output);
          if (!r) return null;
          const isEditing = editing === output;
          const choices = CHOICES[output];
          return (
            <div key={output} className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)_auto] sm:items-start">
              <div className="flex flex-col gap-1">
                <span className="text-[13px] font-medium">{ASSESSMENT_LABELS[output]}</span>
                <div className="flex items-center gap-1.5">
                  <SourceBadge source={r.source} />
                  {r.status === "revised" && <Badge variant="info">Revised</Badge>}
                  {r.status === "accepted" && <Badge variant="success">Accepted</Badge>}
                </div>
              </div>
              <div className="flex min-w-0 flex-col gap-1">
                {isEditing ? (
                  <form
                    className="flex items-center gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      save(output);
                    }}
                  >
                    {choices ? (
                      <NativeSelect aria-label={ASSESSMENT_LABELS[output]} value={draft} onChange={(e) => setDraft(e.target.value)} className="h-8 max-w-48">
                        {choices.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </NativeSelect>
                    ) : (
                      <Input
                        aria-label={ASSESSMENT_LABELS[output]}
                        type={output === "target_resolution_date" ? "date" : "text"}
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        className="h-8 max-w-56"
                      />
                    )}
                    <Button type="submit" size="sm" disabled={pending}>
                      Save
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}>
                      Cancel
                    </Button>
                  </form>
                ) : (
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-sm font-medium">{r.finalValue ?? "—"}</span>
                    {r.status === "revised" && r.aiValue !== r.finalValue && (
                      <span className="text-xs text-muted-foreground line-through" title="AI proposal">
                        {r.aiValue}
                      </span>
                    )}
                  </div>
                )}
                {r.rationale && <p className="text-xs text-muted-foreground">{r.rationale}</p>}
              </div>
              <div className="flex items-center gap-3 sm:justify-end">
                <Confidence value={r.confidence} />
                {canEdit && !isEditing && output === "linked_cases" && <span className="size-8" aria-hidden />}
                {canEdit && !isEditing && output !== "linked_cases" && (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Revise ${ASSESSMENT_LABELS[output]}`}
                    onClick={() => {
                      setEditing(output);
                      setDraft(r.finalValue ?? "");
                    }}
                  >
                    <HugeiconsIcon icon={Edit02Icon} aria-hidden />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {canEdit && awaitingConfirm && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-black/[0.08] bg-muted/40 px-4 py-3 dark:border-white/10">
          <p className="text-sm text-muted-foreground">AI output is advisory. Revise anything you disagree with, then confirm to start the investigation.</p>
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
            <HugeiconsIcon icon={Tick02Icon} aria-hidden />
            Confirm assessment
          </Button>
        </div>
      )}
    </div>
  );
}
