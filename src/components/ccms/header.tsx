"use client";
import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { Add01Icon, Alert02Icon, Icon, Logout01Icon, MenuIcon, Notification03Icon, Search01Icon, UpDownIcon, UserSwitchIcon } from "@/components/ccms/icons";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { ClockHealth } from "@/ccms/sla";
import { Avatar } from "./avatar";
import { formatDuration } from "./format";
import { Nav, type NavItem } from "./nav";
import { slaMeta, STATUS } from "./sla-meter";
import { TABS_KEY, WorkspaceTabs } from "./workspace-tabs";
import { CommandPalette } from "./command-palette";
import { useCommandShortcut } from "@/components/ui/command-menu";

export interface HeaderAlert {
  number: string;
  subject: string;
  health: ClockHealth;
  remainingMs: number;
  kind: string;
}

type Groups = { label: string; items: NavItem[] }[];

/** Left sidebar: brand, search, navigation, platform connections and the signed-in user. */
export function AppSidebar({
  groups,
  user,
  roleLabel,
  integrations,
  canLogCase,
  signOut,
}: {
  groups: Groups;
  canLogCase: boolean;
  user: { name: string };
  roleLabel: string;
  integrations: { name: string; live: boolean }[];
  signOut: () => Promise<void>;
}) {
  const live = integrations.filter((i) => i.live).length;
  const search = useRef<HTMLInputElement>(null);
  const [paletteOpen, setPaletteOpen] = useCommandShortcut();

  // "/" focuses search unless the user is already typing somewhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey || t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) return;
      e.preventDefault();
      search.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function leave() {
    try {
      sessionStorage.removeItem(TABS_KEY);
    } catch {
      // Nothing stored.
    }
    void signOut();
  }

  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-3 overflow-y-auto border-r bg-sidebar p-2 md:flex">
      <Link href="/home" className="flex h-9 items-center gap-2 rounded-md px-2 outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Image src="/neutrinos-logo.png" alt="Neutrinos" width={306} height={53} priority className="h-[18px] w-auto" />
        <span className="ml-auto text-xs text-muted-foreground">Income</span>
      </Link>

      <form action="/search" role="search" className="relative px-0.5">
        <label htmlFor="global-search" className="sr-only">
          Search cases
        </label>
        <Icon icon={Search01Icon} size={14} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          ref={search}
          id="global-search"
          name="q"
          placeholder="Search cases"
          className="h-[30px] w-full rounded-md border border-input bg-card pr-8 pl-8 text-sm shadow-control outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
        />
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          aria-label="Open command menu"
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded-sm border bg-muted px-1 text-[11px] text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          ⌘K
        </button>
      </form>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} groups={groups} canLogCase={canLogCase} onSignOut={leave} />

      <Nav groups={groups} />

      <div className="mt-auto flex flex-col gap-px">
        <Popover>
          <PopoverTrigger className="flex h-[30px] items-center gap-2 rounded-md px-2 text-sm text-foreground/75 outline-none hover:bg-accent/70 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
            <span className="mx-1 size-2 rounded-full" style={{ backgroundColor: live === integrations.length ? STATUS.good : "#a8a8a4" }} aria-hidden />
            Connections
            <span className="tabular ml-auto text-xs text-muted-foreground">
              {live}/{integrations.length}
            </span>
          </PopoverTrigger>
          <PopoverContent align="start" side="right" className="w-72">
            <div className="border-b px-4 py-2.5 text-sm font-medium">Platform connections</div>
            <dl className="flex flex-col gap-2 px-4 py-3 text-sm">
              {integrations.map((i) => (
                <div key={i.name} className="flex items-center gap-2">
                  <span className="size-2 rounded-full" style={{ backgroundColor: i.live ? STATUS.good : "#a8a8a4" }} aria-hidden />
                  <dt>{i.name}</dt>
                  <dd className="ml-auto text-muted-foreground">{i.live ? "Connected" : "Local fallback"}</dd>
                </div>
              ))}
            </dl>
            <p className="border-t px-4 py-2.5 text-xs text-muted-foreground">Local fallbacks follow the same contracts until credentials are set.</p>
          </PopoverContent>
        </Popover>

        <DropdownMenu>
          <DropdownMenuTrigger className="flex h-10 items-center gap-2 rounded-md px-2 text-left outline-none hover:bg-accent/70 focus-visible:ring-2 focus-visible:ring-ring">
            <Avatar name={user.name} size="sm" />
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-sm">{user.name}</span>
              <span className="truncate text-[11px] text-muted-foreground">{roleLabel}</span>
            </span>
            <Icon icon={UpDownIcon} size={14} className="ml-auto shrink-0 text-muted-foreground" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top">
            <DropdownMenuLabel>
              <span className="block text-sm text-foreground">{user.name}</span>
              {roleLabel}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={leave}>
              <Icon icon={UserSwitchIcon} aria-hidden />
              Switch persona
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={leave}>
              <Icon icon={Logout01Icon} aria-hidden />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}

/** Top bar: open-case tabs on the left, alerts and the new-case action on the right. */
export function AppTopBar({ groups, alerts, canLogCase }: { groups: Groups; alerts: HeaderAlert[]; canLogCase: boolean }) {
  const breached = alerts.filter((a) => a.health === "breached").length;
  return (
    <header className="sticky top-0 z-30 flex h-11 shrink-0 items-center gap-1 border-b bg-background pr-3 pl-2">
      <Popover>
        <PopoverTrigger aria-label="Menu" className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring md:hidden">
          <Icon icon={MenuIcon} size={18} aria-hidden />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-60 p-2">
          <Nav groups={groups} />
        </PopoverContent>
      </Popover>

      <WorkspaceTabs />

      <Popover>
        <PopoverTrigger
          aria-label={`SLA alerts: ${alerts.length}`}
          className="relative ml-auto grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Icon icon={Notification03Icon} size={17} aria-hidden />
          {alerts.length > 0 && <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full" style={{ backgroundColor: breached ? STATUS.critical : STATUS.warning }} aria-hidden />}
        </PopoverTrigger>
        <PopoverContent className="w-96">
          <div className="flex items-center justify-between border-b px-4 py-2.5">
            <span className="text-sm font-medium">SLA alerts</span>
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
                      <Icon icon={Alert02Icon} size={16} color={m.color} className="mt-0.5 shrink-0" aria-hidden />
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="truncate text-sm">{a.subject}</span>
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

      {canLogCase && (
        <Link
          href="/intake"
          className="flex h-7 shrink-0 items-center gap-1.5 rounded-md border border-[#4d5058] bg-primary px-2.5 text-xs font-medium text-primary-foreground shadow-control outline-none hover:bg-[#2c2e33] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
        >
          <Icon icon={Add01Icon} size={13} aria-hidden />
          New case
        </Link>
      )}
    </header>
  );
}
