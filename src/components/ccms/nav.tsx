"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { cn } from "@/lib/utils";

export interface NavItem {
  href: string;
  label: string;
  icon: IconSvgElement;
  /** Shown for screens scheduled for week 2. */
  pending?: boolean;
  count?: number;
}

export function Nav({ groups }: { groups: { label: string; items: NavItem[] }[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex flex-col gap-5">
      {groups.map((g) => (
        <div key={g.label} className="flex flex-col gap-0.5">
          <div className="px-2 pb-1 text-[11px] font-medium text-muted-foreground">{g.label}</div>
          {g.items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            const inner = (
              <>
                <HugeiconsIcon icon={item.icon} size={16} aria-hidden className="shrink-0" />
                <span className="truncate">{item.label}</span>
                {item.pending ? (
                  <span className="ml-auto text-[10px] text-muted-foreground">Wk 2</span>
                ) : item.count ? (
                  <span className="tabular ml-auto text-[11px] text-muted-foreground">{item.count}</span>
                ) : null}
              </>
            );
            const cls = cn(
              "flex h-8 items-center gap-2 rounded-md px-2 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active ? "bg-accent font-medium text-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
              item.pending && "pointer-events-none opacity-55",
            );
            return item.pending ? (
              <span key={item.href} className={cls} aria-disabled="true">
                {inner}
              </span>
            ) : (
              <Link key={item.href} href={item.href} className={cls} aria-current={active ? "page" : undefined}>
                {inner}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
