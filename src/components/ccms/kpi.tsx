import Link from "next/link";
import { Icon } from "@/components/ccms/icons";
import { Alert02Icon } from "@/components/ccms/icons";
import { cn } from "@/lib/utils";

/** Scorecard strip: one bordered panel, hairline-divided cells. */
export function KpiStrip({ children }: { children: React.ReactNode }) {
  return (
    <section aria-label="Key figures" className="grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-border shadow-card md:grid-cols-3 xl:grid-cols-6">
      {children}
    </section>
  );
}

/** One figure: label, value, a line of context. `alert` marks a count that needs action when above zero. */
export function Kpi({ label, value, context, href, alert }: { label: string; value: number; context?: string; href: string; alert?: boolean }) {
  const hot = alert && value > 0;
  return (
    <Link href={href} className="flex min-w-0 flex-col gap-1.5 bg-card px-4 py-3.5 outline-none hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("tabular flex items-center gap-1.5 text-2xl leading-none font-medium", hot && "text-destructive")}>
        {value}
        {hot && <Icon icon={Alert02Icon} size={16} aria-label="needs action" />}
      </span>
      {context && <span className="truncate text-xs text-muted-foreground">{context}</span>}
    </Link>
  );
}
