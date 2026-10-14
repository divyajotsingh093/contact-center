"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon, Add01Icon, ArrowRight01Icon, Logout01Icon, Search01Icon } from "@/components/ccms/icons";
import { CommandGroup, CommandItem, CommandMenu, CommandSeparator } from "@/components/ui/command-menu";
import type { NavItem } from "./nav";

const CASE_NUMBER = /^ccms-\d{4}-\d{6}$/i;

/** ⌘K: jump to any screen, open a case by number, search cases, or run an action. */
export function CommandPalette({
  open,
  onOpenChange,
  groups,
  canLogCase,
  onSignOut,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: { label: string; items: NavItem[] }[];
  canLogCase: boolean;
  onSignOut: () => void;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const query = q.trim();
  const go = (href: string) => {
    onOpenChange(false);
    setQ("");
    router.push(href);
  };
  const screens = groups.flatMap((g) => g.items).filter((i) => !i.pending);

  return (
    <CommandMenu open={open} onOpenChange={onOpenChange} search={q} onSearchChange={setQ} placeholder="Search cases or jump to…">
      <CommandGroup heading="Go to">
        {screens.map((s) => (
          <CommandItem key={s.href} value={s.label} icon={<Icon icon={s.icon} size={16} />} onSelect={() => go(s.href)}>
            {s.label}
          </CommandItem>
        ))}
      </CommandGroup>
      {query && (
        <CommandGroup heading="Cases">
          {CASE_NUMBER.test(query) && (
            <CommandItem forceMount value={`open ${query}`} icon={<Icon icon={ArrowRight01Icon} size={16} />} onSelect={() => go(`/cases/${query.toUpperCase()}`)}>
              Open {query.toUpperCase()}
            </CommandItem>
          )}
          <CommandItem forceMount value={`search ${query}`} icon={<Icon icon={Search01Icon} size={16} />} hint="Number, subject, customer, policy or claim" onSelect={() => go(`/search?q=${encodeURIComponent(query)}`)}>
            Search cases for “{query}”
          </CommandItem>
        </CommandGroup>
      )}
      <CommandSeparator />
      <CommandGroup heading="Actions">
        {canLogCase && (
          <CommandItem value="New case log" keywords={["intake", "create"]} icon={<Icon icon={Add01Icon} size={16} />} onSelect={() => go("/intake")}>
            New case
          </CommandItem>
        )}
        <CommandItem
          value="Sign out switch persona"
          icon={<Icon icon={Logout01Icon} size={16} />}
          onSelect={() => {
            onOpenChange(false);
            onSignOut();
          }}
        >
          Switch persona
        </CommandItem>
      </CommandGroup>
    </CommandMenu>
  );
}
