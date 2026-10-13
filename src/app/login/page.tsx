import { HugeiconsIcon } from "@hugeicons/react";
import { AiBrain01Icon, Clock01Icon, FileAddIcon, Shield01Icon } from "@hugeicons/core-free-icons";
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
      <section className="relative hidden flex-col justify-between gap-10 overflow-hidden bg-header p-10 text-white lg:flex">
        <div className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-md bg-brand text-xs font-bold">i</span>
          <span className="font-semibold">Income</span>
          <span className="text-white/55">CCMS</span>
        </div>
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-3">
            <h1 className="text-3xl leading-tight font-semibold">Customer Case Management</h1>
            <p className="text-sm text-white/65">
              One platform for every complaint, feedback, enquiry and appeal, from intake to RCA.
            </p>
          </div>
          <ul className="flex flex-col gap-5">
            {PILLARS.map((p) => (
              <li key={p.title} className="flex gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/[0.08]">
                  <HugeiconsIcon icon={p.icon} size={16} aria-hidden />
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">{p.title}</span>
                  <span className="text-[13px] text-white/60">{p.body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-white/45">Proof of concept · sandbox with synthetic data · no real customer contact</p>
      </section>

      <section className="flex flex-col gap-8 bg-page px-6 py-10 sm:px-10">
        <div className="flex flex-col gap-1.5">
          <h2 className="text-xl font-semibold">Choose a persona</h2>
          <p className="max-w-prose text-sm text-muted-foreground">
            Single sign-on is out of scope for the POC. Each persona sees the CCMS with the access set out in BSD section 7.
          </p>
          {failed && (
            <p role="alert" className="text-sm text-destructive">
              That persona isn&apos;t available. Choose another.
            </p>
          )}
        </div>
        <div className="grid gap-x-6 gap-y-7 xl:grid-cols-2">
          {byRole.map(({ role, users }) => (
            <section key={role} className="flex flex-col gap-2">
              <div className="flex flex-col">
                <h3 className="text-[13px] font-semibold">{ROLE_LABELS[role]}</h3>
                <p className="text-xs text-muted-foreground">{ROLE_BLURB[role]}</p>
              </div>
              <div className="flex flex-col gap-1.5">
                {users.map((u) => (
                  <form key={u.id} action={signInAs}>
                    <input type="hidden" name="userId" value={u.id} />
                    <button
                      type="submit"
                      className="pressable group flex w-full items-center gap-3 rounded-xl border border-black/[0.08] bg-card px-3 py-2.5 text-left shadow-xs outline-none hover:border-black/20 focus-visible:ring-2 focus-visible:ring-ring dark:border-white/10 dark:hover:border-white/25"
                    >
                      <Avatar name={u.name} size="md" />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-[13px] font-medium">{u.name}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          {[u.team?.name ?? u.bu?.name, ...u.roles.slice(1).map((r) => ROLE_LABELS[r as Role])].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      <span className="text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden>
                        Sign in →
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
