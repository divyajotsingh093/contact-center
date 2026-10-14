"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconData } from "@/components/ccms/icons";
import { cn } from "@/lib/utils";

export interface NavItem {
  href: string;
  label: string;
  icon: IconData;
  /** Shown for screens scheduled for week 2. */
  pending?: boolean;
  count?: number;
}

/** Sidebar navigation: quiet labelled rows grouped under small section labels. */
export function Nav({ groups }: { groups: { label: string; items: NavItem[] }[] }) {
  const pathname = usePathname();
  const planned = groups.flatMap((g) => g.items.filter((i) => i.pending));
  const live = groups.map((g) => ({ ...g, items: g.items.filter((i) => !i.pending) })).filter((g) => g.items.length);
  return (
    <nav aria-label="Main" className="flex flex-col gap-3">
      {live.map((g) => (
        <div key={g.label} className="flex flex-col gap-px">
          <div className="px-2 pt-1 pb-1 text-[11px] font-medium text-muted-foreground">{g.label}</div>
          {g.items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            const inner = (
              <>
                <Icon icon={item.icon} size={16} aria-hidden className="shrink-0 text-muted-foreground" />
                <span className="truncate">{item.label}</span>
                {item.pending ? (
                  <span className="ml-auto text-[11px] text-muted-foreground">Wk 2</span>
                ) : item.count ? (
                  <span className="tabular ml-auto text-xs text-muted-foreground">{item.count}</span>
                ) : null}
              </>
            );
            const cls = cn(
              "flex h-[30px] items-center gap-2 rounded-md px-2 text-sm font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring",
              active ? "bg-secondary/80 text-foreground" : "text-foreground/80 hover:bg-accent hover:text-foreground",
              item.pending && "pointer-events-none opacity-50",
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
      {planned.length > 0 && (
        <details className="group/planned">
          <summary className="flex h-[30px] list-none items-center gap-2 rounded-md px-2 text-[11px] font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
            Planned for week 2
            <span className="tabular ml-auto">{planned.length}</span>
          </summary>
          <ul className="flex flex-col gap-px">
            {planned.map((item) => (
              <li key={item.href} className="flex h-[30px] items-center gap-2 px-2 text-sm text-muted-foreground">
                <Icon icon={item.icon} size={16} aria-hidden className="shrink-0 opacity-70" />
                <span className="truncate">{item.label}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </nav>
  );
}
