import { redirect } from "next/navigation";
import {
  Alert02Icon,
  Analytics01Icon,
  CheckmarkCircle02Icon,
  DashboardSquare01Icon,
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
import { inboxCounts, slaAlerts } from "@/ccms/queries";
import { ROLE_LABELS, type Role } from "@/ccms/constants";
import { Nav } from "@/components/ccms/nav";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppHeader } from "@/components/ccms/header";
import { signOut } from "../session-actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const actor = await currentActor();
  if (!actor) redirect("/login");
  const [counts, alerts] = await Promise.all([inboxCounts(actor), slaAlerts(actor)]);
  const has = (...r: Role[]) => actor.roles.includes("admin") || r.some((x) => actor.roles.includes(x));

  const groups = [
    {
      label: "Work",
      items: [
        { href: "/home", label: "Home", icon: DashboardSquare01Icon },
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
      <div className="flex min-h-dvh flex-col bg-page">
        <AppHeader
          user={{ name: actor.name }}
          roleLabel={actor.roles.map((r) => ROLE_LABELS[r as Role] ?? r).join(", ")}
          alerts={alerts.map((a) => ({ number: a.number, subject: a.subject, health: a.sla!.health, remainingMs: a.sla!.remainingMs, kind: a.sla!.kind }))}
          signOut={signOut}
        />
        <div className="flex min-h-0 flex-1">
          <aside className="sticky top-12 hidden h-[calc(100dvh-3rem)] w-56 shrink-0 flex-col gap-6 overflow-y-auto border-r border-black/[0.06] bg-sidebar px-3 py-4 md:flex dark:border-white/[0.08]">
            <Nav groups={groups} />
            <dl className="mt-auto flex flex-col gap-1 px-2 text-[11px] text-muted-foreground">
              {[
                { name: "Kamios AI Hub", live: Boolean(process.env.KAMIOS_BASE_URL && process.env.KAMIOS_API_TOKEN) },
                { name: "Reels", live: Boolean(process.env.REELS_BASE_URL && process.env.REELS_API_TOKEN) },
                { name: "n8n", live: Boolean(process.env.N8N_EVENT_WEBHOOK_URL) },
              ].map((i) => (
                <div key={i.name} className="flex items-center gap-1.5">
                  <span className={`size-1.5 rounded-full ${i.live ? "bg-[#0ca30c]" : "bg-[#898781]"}`} aria-hidden />
                  <dt>{i.name}</dt>
                  <dd className="ml-auto">{i.live ? "Connected" : "Local fallback"}</dd>
                </div>
              ))}
            </dl>
          </aside>
          <main className="flex min-w-0 flex-1 flex-col">{children}</main>
        </div>
      </div>
    </TooltipProvider>
  );
}
