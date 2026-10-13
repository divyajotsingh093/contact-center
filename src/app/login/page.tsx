import { db } from "@/lib/db";
import { ROLE_LABELS, type Role } from "@/ccms/constants";
import { signInAs } from "../session-actions";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const users = await db.user.findMany({
    where: { active: true, NOT: { roles: { has: "service" } } },
    include: { bu: true, team: true },
    orderBy: { name: "asc" },
  });
  const byRole = new Map<string, typeof users>();
  for (const u of users) {
    const role = u.roles[0];
    byRole.set(role, [...(byRole.get(role) ?? []), u]);
  }
  const order: Role[] = ["frontliner", "case_manager", "team_lead", "bu_staff", "ce_team", "head_of_ce", "qa", "admin"];

  return (
    <main className="mx-auto flex min-h-dvh max-w-4xl flex-col justify-center gap-8 px-4 py-12">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="size-2.5 rounded-sm bg-brand" aria-hidden />
          <span className="text-sm font-semibold">Income CCMS</span>
          <span className="text-xs text-muted-foreground">POC</span>
        </div>
        <h1 className="text-2xl font-semibold">Choose a persona</h1>
        <p className="max-w-prose text-sm text-muted-foreground">
          Single sign-on is out of scope for the POC. Pick a persona to see the CCMS with that role&apos;s access, as set out in BSD section 7.
        </p>
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        {order
          .filter((r) => byRole.has(r))
          .map((role) => (
            <section key={role} className="flex flex-col gap-2">
              <h2 className="text-xs font-medium text-muted-foreground">{ROLE_LABELS[role]}</h2>
              <div className="flex flex-col gap-1.5">
                {byRole.get(role)!.map((u) => (
                  <form key={u.id} action={signInAs}>
                    <input type="hidden" name="userId" value={u.id} />
                    <button
                      type="submit"
                      className="pressable flex w-full items-center justify-between gap-3 rounded-lg border border-black/[0.08] bg-card px-3 py-2.5 text-left shadow-xs outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring dark:border-white/10"
                    >
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-sm font-medium">{u.name}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          {[u.team?.name ?? u.bu?.name, u.roles.slice(1).map((r) => ROLE_LABELS[r as Role]).join(", ")].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      <span className="text-xs text-muted-foreground" aria-hidden>
                        →
                      </span>
                    </button>
                  </form>
                ))}
              </div>
            </section>
          ))}
      </div>
    </main>
  );
}
