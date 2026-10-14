"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Icon } from "@/components/ccms/icons";
import { Edit02Icon } from "@/components/ccms/icons";
import { ASSESSMENT_LABELS, ASSESSMENT_OUTPUTS, DATA_CLASSIFICATIONS, NATURES, PRIORITIES, REGULATORS, type AssessmentOutput } from "@/ccms/constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { SourceBadge } from "@/components/ccms/badges";
import { cn } from "@/lib/utils";
import { reviseAssessmentAction } from "./actions";
import { ConfirmAssessmentButton } from "./confirm-button";

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
  const sources = [...new Set(rows.map((r) => r.source))];

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
    <section className="overflow-hidden rounded-lg bg-card shadow-card">
      <div className="flex min-h-10 items-center justify-between gap-3 border-b px-4 py-1.5">
        <h3 className="text-sm font-medium">Preliminary assessment</h3>
        <div className="flex items-center gap-1.5">
          {sources.map((s) => (
            <SourceBadge key={s} source={s} />
          ))}
        </div>
      </div>
      <div className="divide-y">
        {ASSESSMENT_OUTPUTS.map((output) => {
          const r = byOutput.get(output);
          if (!r) return null;
          const isEditing = editing === output;
          const choices = CHOICES[output];
          return (
            <div key={output} className="group grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 px-4 py-2.5 transition-colors duration-150 hover:bg-muted/60">
              <div className="col-span-2 flex flex-wrap items-center gap-1.5 pb-0.5">
                <span className="text-xs text-muted-foreground">{ASSESSMENT_LABELS[output]}</span>
                {sources.length > 1 && <SourceBadge source={r.source} />}
                {r.status === "revised" && <Badge variant="info">Revised</Badge>}
                {r.status === "accepted" && <Badge variant="success">Accepted</Badge>}
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
                    <span className="text-sm">{r.finalValue ?? "—"}</span>
                    {r.status === "revised" && r.aiValue !== r.finalValue && (
                      <span className="text-xs text-muted-foreground line-through" title="AI proposal">
                        {r.aiValue}
                      </span>
                    )}
                  </div>
                )}
                {r.rationale && <p className="text-xs text-muted-foreground">{r.rationale}</p>}
              </div>
              <div className="flex items-center justify-end gap-3">
                <Confidence value={r.confidence} />
                {canEdit && !isEditing && output === "linked_cases" && <span className="size-8" aria-hidden />}
                {canEdit && !isEditing && output !== "linked_cases" && (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="text-muted-foreground transition-opacity duration-150 focus-visible:opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
                    aria-label={`Revise ${ASSESSMENT_LABELS[output]}`}
                    onClick={() => {
                      setEditing(output);
                      setDraft(r.finalValue ?? "");
                    }}
                  >
                    <Icon icon={Edit02Icon} aria-hidden />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {canEdit && awaitingConfirm && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted px-4 py-2.5">
          <p className="max-w-[60ch] text-xs text-muted-foreground">AI output is advisory. Revise anything you disagree with, then confirm to start the investigation.</p>
          <ConfirmAssessmentButton number={number} caseId={caseId} />
        </div>
      )}
    </section>
  );
}
