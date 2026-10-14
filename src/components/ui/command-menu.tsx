"use client";
/**
 * Command menu: adapted from "Command Menu" by uvain on 21st.dev (Layro System),
 * restyled to this app's tokens. cmdk does the ranking and keyboard; a Radix
 * dialog handles focus, Escape and the overlay.
 */
import * as React from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { Command as CommandPrimitive } from "cmdk";
import { Icon, Search01Icon } from "@/components/ccms/icons";
import { cn } from "@/lib/utils";

/** Opens on ⌘K (Mac) or Ctrl+K. Returns [open, setOpen]. */
export function useCommandShortcut(key = "k") {
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === key && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [key]);
  return [open, setOpen] as const;
}

export function CommandInput({ className, ...props }: React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input>) {
  return (
    <div className="flex items-center gap-2.5 border-b px-3.5">
      <Icon icon={Search01Icon} size={16} aria-hidden className="shrink-0 text-muted-foreground" />
      <CommandPrimitive.Input className={cn("h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground", className)} {...props} />
    </div>
  );
}

export function CommandList({ className, ...props }: React.ComponentPropsWithoutRef<typeof CommandPrimitive.List>) {
  // cmdk's sizer div has no role; mark it presentational so listbox > group > option stays intact.
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    ref.current?.querySelector("[cmdk-list-sizer]")?.setAttribute("role", "presentation");
    ref.current?.querySelectorAll("[cmdk-separator]").forEach((el) => el.setAttribute("role", "none"));
  });
  return <CommandPrimitive.List ref={ref} className={cn("max-h-[min(380px,60dvh)] overflow-y-auto overscroll-contain p-1.5", className)} {...props} />;
}

export function CommandEmpty(props: React.ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>) {
  return <CommandPrimitive.Empty className="px-3 py-8 text-center text-sm text-muted-foreground" {...props} />;
}

export function CommandGroup({ className, ...props }: React.ComponentPropsWithoutRef<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      className={cn("py-1 [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pt-1.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground", className)}
      {...props}
    />
  );
}

export function CommandSeparator(props: React.ComponentPropsWithoutRef<typeof CommandPrimitive.Separator>) {
  return <CommandPrimitive.Separator className="-mx-1.5 my-1 h-px bg-border" {...props} />;
}

export interface CommandItemProps extends React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item> {
  icon?: React.ReactNode;
  /** Display only, e.g. "G H". */
  shortcut?: string;
  hint?: React.ReactNode;
}

export function CommandItem({ className, icon, shortcut, hint, children, ...props }: CommandItemProps) {
  return (
    <CommandPrimitive.Item
      className={cn(
        "flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm outline-none select-none",
        "data-[selected=true]:bg-accent data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50",
        "[&_svg]:shrink-0 [&_svg]:text-muted-foreground",
        className,
      )}
      {...props}
    >
      {icon}
      <span className="grid min-w-0 flex-1">
        <span className="truncate">{children}</span>
        {hint && <span className="truncate text-xs text-muted-foreground">{hint}</span>}
      </span>
      {shortcut && (
        <span className="flex gap-1">
          {shortcut.split(" ").map((k, i) => (
            <kbd key={i} className="grid h-5 min-w-5 place-items-center rounded-sm bg-muted px-1 font-sans text-[11px] text-foreground/70">
              {k}
            </kbd>
          ))}
        </span>
      )}
    </CommandPrimitive.Item>
  );
}

export function CommandMenu({
  open,
  onOpenChange,
  placeholder = "Search or jump to…",
  search,
  onSearchChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  placeholder?: string;
  search?: string;
  onSearchChange?: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/20 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 motion-reduce:animate-none" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed top-[14dvh] left-1/2 z-50 w-[calc(100vw-24px)] max-w-[560px] -translate-x-1/2 overflow-hidden rounded-xl bg-popover shadow-menu outline-none ease-[var(--ease-out)] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:duration-250 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:duration-150 motion-reduce:animate-none"
        >
          <DialogPrimitive.Title className="sr-only">Command menu</DialogPrimitive.Title>
          <CommandPrimitive loop className="flex w-full flex-col overflow-hidden text-popover-foreground">
            <CommandInput placeholder={placeholder} value={search} onValueChange={onSearchChange} />
            <CommandList>
              <CommandEmpty>No results.</CommandEmpty>
              {children}
            </CommandList>
            <div className="flex items-center gap-3 border-t px-3.5 py-2 text-xs text-muted-foreground">
              <span>↑↓ to move</span>
              <span>↵ to open</span>
              <span>esc to close</span>
            </div>
          </CommandPrimitive>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
