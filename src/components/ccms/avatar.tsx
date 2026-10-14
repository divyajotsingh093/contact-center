import { cn } from "@/lib/utils";

export function initials(name: string) {
  const parts = name.replace(/^(dr|mr|mrs|ms)\.?\s+/i, "").split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/** Initials avatar. */
export function Avatar({ name, size = "sm", className }: { name: string; size?: "xs" | "sm" | "md" | "lg"; className?: string }) {
  const s = { xs: "size-5 text-[9px]", sm: "size-6 text-[10px]", md: "size-8 text-xs", lg: "size-11 text-sm" }[size];
  return (
    <span
      aria-hidden
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full bg-secondary font-semibold text-muted-foreground", s, className)}
    >
      {initials(name)}
    </span>
  );
}

export function Person({ name, sub, size = "sm" }: { name: string | null | undefined; sub?: string; size?: "xs" | "sm" | "md" }) {
  if (!name) return <span className="text-sm text-muted-foreground">Unassigned</span>;
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Avatar name={name} size={size} />
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm">{name}</span>
        {sub && <span className="truncate text-xs text-muted-foreground">{sub}</span>}
      </span>
    </span>
  );
}
