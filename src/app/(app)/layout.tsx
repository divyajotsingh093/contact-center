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
} from "@/components/ccms/icons";
import { currentActor } from "@/ccms/session";
import { inboxCounts, slaAlerts } from "@/ccms/queries";
import { ROLE_LABELS, type Role } from "@/ccms/constants";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar, AppTopBar } from "@/components/ccms/header";
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
        ...(has("bu_staff", "case_manager") ? [{ href: "/sub-tickets", label: "Sub-tickets", icon: Task01Icon }] : []),
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

  const roleLabel = actor.roles.map((r) => ROLE_LABELS[r as Role] ?? r).join(", ");

  return (
    <TooltipProvider>
      <div className="flex min-h-dvh bg-page">
        <a href="#main" className="sr-only z-50 rounded-md bg-card px-3 py-2 text-sm font-medium focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:ring-2 focus:ring-ring">
          Skip to content
        </a>
        <AppSidebar
          groups={groups}
          user={{ name: actor.name }}
          roleLabel={roleLabel}
          canLogCase={has("frontliner", "case_manager", "ce_team")}
          integrations={[
            { name: "Neutrinos AI Hub", live: Boolean(process.env.KAMIOS_BASE_URL && process.env.KAMIOS_AUTH_HEADER) },
            { name: "Neutrinos Reels", live: Boolean(process.env.REELS_BASE_URL && process.env.REELS_CLIENT_ID) },
            { name: "n8n", live: Boolean(process.env.N8N_EVENT_WEBHOOK_URL) },
          ]}
          signOut={signOut}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <AppTopBar
            groups={groups}
            alerts={alerts.map((a) => ({ number: a.number, subject: a.subject, health: a.sla!.health, remainingMs: a.sla!.remainingMs, kind: a.sla!.kind }))}
            canLogCase={has("frontliner", "case_manager", "ce_team")}
          />
          <main id="main" className="flex min-w-0 flex-1 flex-col">
            {children}
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
