import Image from "next/image";
import { Icon } from "@/components/ccms/icons";
import { AiBrain01Icon, Clock01Icon, FileAddIcon, Shield01Icon } from "@/components/ccms/icons";
import { db } from "@/lib/db";
import { ROLE_LABELS, type Role } from "@/ccms/constants";
import { Avatar } from "@/components/ccms/avatar";
import { signInAs } from "../session-actions";

export const dynamic = "force-dynamic";

const ROLE_BLURB: Record<Role, string> = {
  frontliner: "Logs cases on the centralised form; read-only query access with masking",
  case_manager: "Reviews AI assessments, investigates, communicates and resolves",
  team_lead: "Manages team workload, re-allocates, approves closures and extensions",
  bu_staff: "Answers sub-tickets and works RCA remediation",
  ce_team: "Handles significant complaints and monitors exceptions",
  head_of_ce: "Escalation opinions, breach alerts, closes RCA tickets",
  qa: "Assesses sampled cases and curates lessons learnt",
  admin: "Maintains workflows, rules, SLA matrix, templates and roles",
  service: "",
};

const PILLARS = [
  { icon: FileAddIcon, title: "One centralised form", body: "Email, calls, letters and social posts, extracted by AI with no re-keying." },
  { icon: AiBrain01Icon, title: "AI that assesses, people decide", body: "Ten preliminary-assessment outputs with confidence and rationale." },
  { icon: Clock01Icon, title: "SLA governance throughout", body: "Working-day clocks with near-breach and breach alerts." },
  { icon: Shield01Icon, title: "Controlled and auditable", body: "Role-based access, masking and a tamper-evident audit trail." },
];

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const failed = Boolean((await searchParams).error);
  const users = await db.user.findMany({
    where: { active: true, NOT: { roles: { has: "service" } } },
    include: { bu: true, team: true },
    orderBy: { name: "asc" },
  });
  const order: Role[] = ["frontliner", "case_manager", "team_lead", "bu_staff", "ce_team", "head_of_ce", "qa", "admin"];
  const byRole = order
    .map((role) => ({ role, users: users.filter((u) => u.roles[0] === role) }))
    .filter((g) => g.users.length);

  return (
    <main className="grid min-h-dvh lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
      <section className="relative hidden flex-col justify-between gap-10 overflow-hidden border-r bg-sidebar p-10 lg:flex">
        <div className="flex items-center gap-3">
          <Image src="/neutrinos-logo.png" alt="Neutrinos" width={306} height={53} priority className="h-5 w-auto" />
          <span className="h-4 w-px bg-border" aria-hidden />
          <span className="text-sm text-muted-foreground">CCMS for Income</span>
        </div>
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-3">
            <h1 className="text-2xl leading-tight font-medium">Customer Case Management</h1>
            <p className="text-sm text-muted-foreground">
              One platform for every complaint, feedback, enquiry and appeal, from intake to RCA.
            </p>
          </div>
          <ul className="flex flex-col gap-5">
            {PILLARS.map((p) => (
              <li key={p.title} className="flex gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-md border bg-card text-muted-foreground">
                  <Icon icon={p.icon} size={16} aria-hidden />
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">{p.title}</span>
                  <span className="text-sm text-muted-foreground">{p.body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-muted-foreground">Proof of concept · sandbox with synthetic data · no real customer contact</p>
      </section>

      <section className="flex flex-col gap-8 bg-background px-6 py-10 sm:px-10">
        <div className="flex flex-col gap-1.5">
          <h2 className="text-lg font-medium">Choose a persona</h2>
          <p className="max-w-prose text-sm text-muted-foreground">
            Single sign-on is out of scope for the POC. Each persona sees the CCMS with the access set out in BSD section 7.
          </p>
          {failed && (
            <p role="alert" className="text-sm text-destructive">
              That persona isn&apos;t available. Choose another.
            </p>
          )}
        </div>
        <div className="gap-x-6 xl:columns-2">
          {byRole.map(({ role, users }) => (
            <section key={role} className="mb-6 flex break-inside-avoid flex-col gap-2">
              <div className="flex flex-col">
                <h3 className="text-sm font-medium">{ROLE_LABELS[role]}</h3>
                <p className="text-xs text-muted-foreground">{ROLE_BLURB[role]}</p>
              </div>
              <div className="flex flex-col gap-1.5">
                {users.map((u) => (
                  <form key={u.id} action={signInAs}>
                    <input type="hidden" name="userId" value={u.id} />
                    <button
                      type="submit"
                      className="pressable group flex w-full items-center gap-3 rounded-lg bg-card shadow-card px-3 py-2 text-left outline-none hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Avatar name={u.name} size="md" />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-medium">{u.name}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          {[u.team?.name ?? u.bu?.name, ...u.roles.slice(1).map((r) => ROLE_LABELS[r as Role])].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      <span className="text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden>
                        Sign in
                      </span>
                    </button>
                  </form>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>
    </main>
  );
}
