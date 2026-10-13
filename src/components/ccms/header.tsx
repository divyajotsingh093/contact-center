"use client";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert02Icon, ArrowDown01Icon, Logout01Icon, Notification03Icon, Search01Icon, UserSwitchIcon } from "@hugeicons/core-free-icons";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { ClockHealth } from "@/ccms/sla";
import { Avatar } from "./avatar";
import { formatDuration } from "./format";
import { slaMeta } from "./sla-meter";

export interface HeaderAlert {
  number: string;
  subject: string;
  health: ClockHealth;
  remainingMs: number;
  kind: string;
}

export function AppHeader({
  user,
  roleLabel,
  alerts,
  signOut,
}: {
  user: { name: string; email?: string };
  roleLabel: string;
  alerts: HeaderAlert[];
  signOut: () => Promise<void>;
}) {
  const breached = alerts.filter((a) => a.health === "breached").length;
  return (
    <header className="sticky top-0 z-40 flex h-12 shrink-0 items-center gap-3 bg-header px-4 text-white">
      <Link href="/home" className="flex items-center gap-2 rounded-md pr-2 outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className="grid size-6 place-items-center rounded-md bg-brand text-[11px] font-bold text-white">i</span>
        <span className="text-sm font-semibold">Income</span>
        <span className="hidden text-sm text-white/55 sm:inline">CCMS</span>
      </Link>
      <span className="hidden h-5 w-px bg-white/15 sm:block" aria-hidden />
      <span className="hidden text-[13px] text-white/80 sm:block">Case Workspace</span>

      <form action="/search" className="mx-auto flex w-full max-w-lg items-center" role="search">
        <label htmlFor="global-search" className="sr-only">
          Search cases
        </label>
        <div className="relative w-full">
          <HugeiconsIcon icon={Search01Icon} size={15} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-white/50" aria-hidden />
          <input
            id="global-search"
            name="q"
            placeholder="Search case number, subject, customer, policy…"
            className="h-8 w-full rounded-md border border-white/10 bg-white/[0.08] pr-3 pl-8 text-[13px] text-white outline-none placeholder:text-white/45 focus-visible:border-white/25 focus-visible:bg-white/[0.12] focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </form>

      <Popover>
        <PopoverTrigger
          aria-label={`SLA alerts: ${alerts.length}`}
          className="relative grid size-8 place-items-center rounded-md text-white/80 outline-none hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-ring"
        >
          <HugeiconsIcon icon={Notification03Icon} size={18} aria-hidden />
          {alerts.length > 0 && (
            <span className={`tabular absolute -top-0.5 -right-0.5 grid min-w-4 place-items-center rounded-full px-1 text-[10px] font-semibold text-white ${breached ? "bg-[#d03b3b]" : "bg-[#c98500]"}`}>
              {alerts.length}
            </span>
          )}
        </PopoverTrigger>
        <PopoverContent className="w-96">
          <div className="flex items-center justify-between border-b border-black/[0.06] px-4 py-3 dark:border-white/10">
            <span className="text-sm font-semibold">SLA alerts</span>
            <span className="text-xs text-muted-foreground">
              {breached} breached · {alerts.length - breached} near breach
            </span>
          </div>
          {alerts.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">No SLA alerts. Everything is on track.</p>
          ) : (
            <ul className="max-h-96 overflow-y-auto py-1">
              {alerts.map((a) => {
                const m = slaMeta(a.health);
                return (
                  <li key={a.number}>
                    <Link href={`/cases/${a.number}`} className="flex items-start gap-3 px-4 py-2.5 outline-none hover:bg-accent focus-visible:bg-accent">
                      <HugeiconsIcon icon={Alert02Icon} size={16} color={m.color} className="mt-0.5 shrink-0" aria-hidden />
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="truncate text-[13px] font-medium">{a.subject}</span>
                        <span className="tabular text-xs text-muted-foreground">
                          {a.number} · {a.kind} SLA {m.label.toLowerCase()} · {formatDuration(a.remainingMs)}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </PopoverContent>
      </Popover>

      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 rounded-md py-1 pr-1.5 pl-1 outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-ring">
          <Avatar name={user.name} size="sm" />
          <span className="hidden flex-col items-start leading-tight md:flex">
            <span className="text-[12px] font-medium">{user.name}</span>
            <span className="text-[11px] text-white/55">{roleLabel}</span>
          </span>
          <HugeiconsIcon icon={ArrowDown01Icon} size={14} className="text-white/60" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>
            <span className="block text-[13px] font-medium text-foreground">{user.name}</span>
            {roleLabel}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => void signOut()}>
            <HugeiconsIcon icon={UserSwitchIcon} aria-hidden />
            Switch persona
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void signOut()}>
            <HugeiconsIcon icon={Logout01Icon} aria-hidden />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
