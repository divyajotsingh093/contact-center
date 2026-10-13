import { cn } from "@/lib/utils";

const TINTS = [
  "bg-[#dbe8f8] text-[#1c5cab]",
  "bg-[#fbe2d6] text-[#a8441b]",
  "bg-[#d5f0e5] text-[#0f7552]",
  "bg-[#ece8fb] text-[#4a3aa7]",
  "bg-[#f8e0ea] text-[#a3365f]",
  "bg-[#ecebe6] text-[#52514e]",
];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function initials(name: string) {
  const parts = name.replace(/^(dr|mr|mrs|ms)\.?\s+/i, "").split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/** Initials avatar with a stable tint per person. */
export function Avatar({ name, size = "sm", className }: { name: string; size?: "xs" | "sm" | "md" | "lg"; className?: string }) {
  const s = { xs: "size-5 text-[9px]", sm: "size-6 text-[10px]", md: "size-8 text-xs", lg: "size-11 text-sm" }[size];
  return (
    <span
      aria-hidden
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold", s, TINTS[hash(name) % TINTS.length], className)}
    >
      {initials(name)}
    </span>
  );
}

export function Person({ name, sub, size = "sm" }: { name: string | null | undefined; sub?: string; size?: "xs" | "sm" | "md" }) {
  if (!name) return <span className="text-[13px] text-muted-foreground">Unassigned</span>;
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Avatar name={name} size={size} />
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-[13px]">{name}</span>
        {sub && <span className="truncate text-xs text-muted-foreground">{sub}</span>}
      </span>
    </span>
  );
}
