/**
 * Lightweight HTML charts following the dataviz method: thin marks with
 * rounded data-ends, direct value labels, recessive furniture, a hover
 * tooltip per mark, and a table twin behind a toggle.
 */
import { cn } from "@/lib/utils";

export interface BarDatum {
  label: string;
  value: number;
  /** Optional per-bar colour (status charts); defaults to the series colour. */
  color?: string;
  href?: string;
  hint?: string;
}

const SERIES_1 = "var(--series-1)";

/** Horizontal single-series bar list (magnitude by category). */
export function BarList({ data, unit = "", className }: { data: BarDatum[]; unit?: string; className?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <ul className={cn("flex flex-col gap-2.5", className)}>
      {data.map((d) => {
        const w = (d.value / max) * 100;
        const row = (
          <>
            <div className="flex items-baseline justify-between gap-2 text-[13px]">
              <span className="truncate text-foreground">{d.label}</span>
              <span className="tabular text-muted-foreground">
                {d.value}
                {unit}
              </span>
            </div>
            <div className="h-2 w-full">
              <div
                className="h-full rounded-r-[4px] transition-[filter] duration-150 group-hover:brightness-90"
                style={{ width: `${Math.max(w, d.value > 0 ? 1.5 : 0)}%`, backgroundColor: d.color ?? SERIES_1 }}
              />
            </div>
          </>
        );
        return (
          <li key={d.label} className="group relative flex flex-col gap-1" title={d.hint ?? `${d.label}: ${d.value}${unit}`}>
            {d.href ? (
              <a href={d.href} className="flex flex-col gap-1 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {row}
              </a>
            ) : (
              row
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** One stacked bar for part-to-whole (e.g. SLA health), with a labelled legend. */
export function StackedBar({ data, className }: { data: (BarDatum & { color: string; icon?: React.ReactNode })[]; className?: string }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-[4px] bg-black/[0.04] dark:bg-white/[0.06]">
        {total > 0 &&
          data
            .filter((d) => d.value > 0)
            .map((d) => (
              <div
                key={d.label}
                className="h-full transition-[filter] duration-150 hover:brightness-90"
                style={{ width: `${(d.value / total) * 100}%`, backgroundColor: d.color }}
                title={`${d.label}: ${d.value} (${Math.round((d.value / total) * 100)}%)`}
              />
            ))}
      </div>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-2">
        {data.map((d) => (
          <li key={d.label} className="flex items-center gap-2 text-[13px]">
            <span className="size-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: d.color }} aria-hidden />
            {d.icon}
            <span className="truncate">{d.label}</span>
            <span className="tabular ml-auto text-muted-foreground">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Accessible table twin for any chart. */
export function ChartTable({ data, valueLabel = "Count" }: { data: BarDatum[]; valueLabel?: string }) {
  return (
    <details className="group text-xs text-muted-foreground">
      <summary className="cursor-pointer list-none outline-none select-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <span className="group-open:hidden">Show table</span>
        <span className="hidden group-open:inline">Hide table</span>
      </summary>
      <table className="mt-2 w-full text-[13px] text-foreground">
        <thead>
          <tr className="border-b border-black/[0.06] text-left text-xs text-muted-foreground dark:border-white/10">
            <th className="py-1 font-medium">Category</th>
            <th className="py-1 text-right font-medium">{valueLabel}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.label} className="border-b border-black/[0.04] last:border-0 dark:border-white/[0.06]">
              <td className="py-1">{d.label}</td>
              <td className="tabular py-1 text-right">{d.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
