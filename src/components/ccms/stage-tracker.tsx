import { STAGES, STAGE_LABELS, type Stage } from "@/ccms/constants";
import { cn } from "@/lib/utils";

/** The seven BSD stages as a compact progress rail. */
export function StageTracker({ stage, nature }: { stage: string; nature: string | null }) {
  const steps = STAGES.filter((s) => s !== "closed" && !(s === "rca_qa" && nature !== "complaint"));
  const current = stage === "closed" ? steps.length : steps.indexOf(stage as Stage);
  return (
    <ol className="flex w-full items-center gap-1" aria-label="Case stage">
      {steps.map((s, i) => {
        const state = i < current ? "done" : i === current ? "current" : "todo";
        return (
          <li key={s} className="flex min-w-0 flex-1 flex-col gap-1.5" aria-current={state === "current" ? "step" : undefined}>
            <div
              className={cn(
                "h-1 rounded-full",
                state === "done" && "bg-foreground/70",
                state === "current" && "bg-brand",
                state === "todo" && "bg-muted",
              )}
            />
            <span className={cn("truncate text-[11px]", state === "current" ? "font-medium text-foreground" : "text-muted-foreground")}>
              {STAGE_LABELS[s]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
