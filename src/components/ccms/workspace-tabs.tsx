"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "@/components/ccms/icons";
import { Cancel01Icon } from "@/components/ccms/icons";
import { cn } from "@/lib/utils";

/** Open case tabs for this browser tab. Only case numbers are stored, never case content. */
export const TABS_KEY = "ccms.tabs";
const EVENT = "ccms:tabs";
const MAX_TABS = 8;

function read(): string[] {
  try {
    return JSON.parse(sessionStorage.getItem(TABS_KEY) ?? "[]");
  } catch {
    return [];
  }
}
function write(tabs: string[]) {
  try {
    sessionStorage.setItem(TABS_KEY, JSON.stringify(tabs));
  } catch {
    // Storage unavailable (private mode): tabs simply don't persist.
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Rendered by the case page: keeps the case open as a workspace tab. */
export function OpenCaseTab({ number }: { number: string }) {
  useEffect(() => {
    const tabs = read();
    if (!tabs.includes(number)) write([...tabs, number].slice(-MAX_TABS));
  }, [number]);
  return null;
}

export function WorkspaceTabs() {
  const pathname = usePathname();
  const router = useRouter();
  const [tabs, setTabs] = useState<string[]>([]);
  useEffect(() => {
    const sync = () => setTabs(read());
    sync();
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);
  const current = pathname.startsWith("/cases/") ? decodeURIComponent(pathname.split("/")[2] ?? "") : null;

  function close(number: string) {
    write(read().filter((t) => t !== number));
    if (number === current) router.push("/inbox");
  }

  return (
    <nav aria-label="Open cases" className="flex h-full min-w-0 items-center gap-1 overflow-x-auto">
      {tabs.length === 0 ? (
        <p className="truncate px-2 text-xs text-muted-foreground">Cases you open stay here as tabs.</p>
      ) : (
        tabs.map((number) => {
          const active = number === current;
          return (
            <div key={number} className={cn("flex h-7 shrink-0 items-center rounded-md", active ? "bg-accent" : "hover:bg-accent/70")}>
              <Link
                href={`/cases/${number}`}
                aria-current={active ? "page" : undefined}
                className={cn("tabular flex h-full items-center pr-1 pl-2.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset", active ? "text-foreground" : "text-muted-foreground")}
              >
                {number}
              </Link>
              <button
                type="button"
                onClick={() => close(number)}
                aria-label={`Close ${number}`}
                className="mr-0.5 grid size-5 place-items-center rounded-sm text-muted-foreground outline-none hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Icon icon={Cancel01Icon} size={12} aria-hidden />
              </button>
            </div>
          );
        })
      )}
    </nav>
  );
}
