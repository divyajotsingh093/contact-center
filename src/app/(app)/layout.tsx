import { redirect } from "next/navigation";
import {
  Alert02Icon,
  Analytics01Icon,
  CheckmarkCircle02Icon,
  FileAddIcon,
  GitBranchIcon,
  InboxIcon,
  Mail01Icon,
  Megaphone01Icon,
  Search01Icon,
  Settings02Icon,
  Task01Icon,
} from "@hugeicons/core-free-icons";
import { currentActor } from "@/ccms/session";
import { inboxCounts } from "@/ccms/queries";
import { ROLE_LABELS, type Role } from "@/ccms/constants";
import { Nav } from "@/components/ccms/nav";
import { TooltipProvider } from "@/components/ui/tooltip";
import { signOut } from "../session-actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const actor = await currentActor();
  if (!actor) redirect("/login");
  const counts = await inboxCounts(actor);
  const has = (...r: Role[]) => actor.roles.includes("admin") || r.some((x) => actor.roles.includes(x));

  const groups = [
    {
      label: "Work",
      items: [
        ...(has("case_manager", "team_lead", "ce_team", "head_of_ce")
          ? [{ href: "/inbox", label: "My cases", icon: InboxIcon, count: counts.mine || counts.team }]
          : []),
        ...(has("frontliner", "case_manager", "ce_team") ? [{ href: "/intake", label: "Centralised form", icon: FileAddIcon }] : []),
        ...(has("frontliner", "ce_team", "head_of_ce", "case_manager", "team_lead") ? [{ href: "/query", label: "Query page", icon: Search01Icon, pending: true }] : []),
        ...(has("team_lead", "head_of_ce") ? [{ href: "/approvals", label: "Approval inbox", icon: CheckmarkCircle02Icon, pending: true }] : []),
        ...(has("bu_staff", "case_manager") ? [{ href: "/sub-tickets", label: "Sub-tickets", icon: Task01Icon, pending: true }] : []),
      ],
    },
    {
      label: "Modules",
      items: [
        ...(has("head_of_ce", "ce_team") ? [{ href: "/escalations", label: "Escalations", icon: Megaphone01Icon, pending: true }] : []),
        ...(has("case_manager", "bu_staff", "head_of_ce", "ce_team") ? [{ href: "/rca", label: "RCA & CAPA", icon: GitBranchIcon, pending: true }] : []),
        ...(has("qa") ? [{ href: "/qa", label: "QA", icon: Alert02Icon, pending: true }] : []),
        ...(has("case_manager") ? [{ href: "/communications", label: "Communications", icon: Mail01Icon, pending: true }] : []),
      ],
    },
    {
      label: "Insight",
      items: [{ href: "/dashboards", label: "Dashboards", icon: Analytics01Icon, pending: true }],
    },
    ...(has("admin") ? [{ label: "Admin", items: [{ href: "/admin", label: "Admin console", icon: Settings02Icon, pending: true }] }] : []),
  ].filter((g) => g.items.length);

  return (
    <TooltipProvider>
      <div className="flex min-h-dvh">
        <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col gap-6 border-r border-black/[0.06] bg-sidebar px-3 py-4 md:flex dark:border-white/[0.08]">
          <div className="flex items-center gap-2 px-2">
            <span className="size-2.5 rounded-sm bg-brand" aria-hidden />
            <span className="text-sm font-semibold">Income CCMS</span>
          </div>
          <Nav groups={groups} />
          <div className="mt-auto flex flex-col gap-2 border-t border-black/[0.06] px-2 pt-3 dark:border-white/[0.08]">
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-[13px] font-medium">{actor.name}</span>
              <span className="truncate text-xs text-muted-foreground">{actor.roles.map((r) => ROLE_LABELS[r as Role] ?? r).join(", ")}</span>
            </div>
            <form action={signOut}>
              <button type="submit" className="text-xs text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring">
                Switch persona
              </button>
            </form>
          </div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </div>
    </TooltipProvider>
  );
}
