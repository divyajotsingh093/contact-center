import { STAGES, STAGE_LABELS, type Stage } from "@/ccms/constants";
import { cn } from "@/lib/utils";

/** The seven BSD stages as a slim segmented bar: filled to the current stage, labels beneath. */
export function StageTracker({ stage, nature }: { stage: string; nature: string | null }) {
  const steps = STAGES.filter((s) => s !== "closed" && !(s === "rca_qa" && nature !== "complaint"));
  const current = stage === "closed" ? steps.length : steps.indexOf(stage as Stage);
  return (
    <ol className="flex w-full gap-1" aria-label="Case stage">
      {steps.map((s, i) => {
        const state = i < current ? "done" : i === current ? "current" : "todo";
        return (
          <li key={s} className="flex min-w-0 flex-1 flex-col gap-1.5" aria-current={state === "current" ? "step" : undefined}>
            <div className={cn("h-[3px] rounded-full", state === "todo" ? "bg-secondary" : state === "current" ? "bg-brand" : "bg-foreground/45")} />
            <span className={cn("truncate text-xs", state === "current" ? "font-medium text-foreground" : "text-muted-foreground", state !== "current" && "max-sm:sr-only")}>
              {STAGE_LABELS[s]}
              {state === "done" && <span className="sr-only"> (done)</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
