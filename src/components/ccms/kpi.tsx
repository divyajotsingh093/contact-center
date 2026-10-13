import Link from "next/link";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { cn } from "@/lib/utils";

/** Scorecard: label, value, a one-line context, optional status icon. Links into the filtered list. */
export function Kpi({
  label,
  value,
  context,
  icon,
  iconColor,
  href,
  emphasis,
}: {
  label: string;
  value: number;
  context?: string;
  icon: IconSvgElement;
  iconColor?: string;
  href?: string;
  emphasis?: boolean;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <HugeiconsIcon icon={icon} size={16} color={iconColor} className={iconColor ? undefined : "text-muted-foreground"} aria-hidden />
      </div>
      <span className={cn("text-[28px] leading-none font-semibold", emphasis && value > 0 && "text-[#b42f2f] dark:text-[#e66767]")}>{value}</span>
      {context && <span className="truncate text-xs text-muted-foreground">{context}</span>}
    </>
  );
  const cls =
    "pressable flex min-w-0 flex-col gap-2.5 rounded-xl border border-black/[0.08] bg-card px-4 py-3.5 shadow-xs outline-none dark:border-white/10";
  return href ? (
    <Link href={href} className={cn(cls, "hover:border-black/15 focus-visible:ring-2 focus-visible:ring-ring dark:hover:border-white/20")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
