/**
 * Activity timeline, after "Activity Timeline" by olewandowski1 on 21st.dev:
 * events grouped by day under a separator, a rail through the avatars, a small
 * badge naming the kind of event, and a one-line sentence with a relative time.
 */
import { Icon, type IconData } from "@/components/ccms/icons";
import { Avatar } from "./avatar";

export interface TimelineEvent {
  id: string;
  at: Date;
  /** Person who acted; null for the system. */
  actor: string | null;
  /** Badge on the avatar: what kind of event this is. */
  icon: IconData;
  /** Sentence after the actor's name, e.g. "added a work note". */
  action?: React.ReactNode;
  /** Bold object of the sentence, e.g. a case number or email subject. */
  target?: React.ReactNode;
  /** Optional detail under the sentence. */
  body?: React.ReactNode;
}

const SGT = "Asia/Singapore";
const dayKey = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: SGT });

function dayLabel(d: Date, now: Date) {
  const key = dayKey(d);
  if (key === dayKey(now)) return "Today";
  if (key === dayKey(new Date(now.getTime() - 86_400_000))) return "Yesterday";
  return d.toLocaleDateString("en-SG", { weekday: "short", day: "numeric", month: "short", timeZone: SGT });
}

function timeLabel(d: Date, now: Date) {
  const mins = Math.round((now.getTime() - d.getTime()) / 60_000);
  if (dayKey(d) === dayKey(now) && mins >= 0 && mins < 360) {
    if (mins < 1) return "Just now";
    return mins < 60 ? `${mins} min ago` : `${Math.round(mins / 60)} h ago`;
  }
  return d.toLocaleTimeString("en-SG", { hour: "numeric", minute: "2-digit", timeZone: SGT });
}

export function ActivityTimeline({ events, now = new Date() }: { events: TimelineEvent[]; now?: Date }) {
  const groups: { label: string; events: TimelineEvent[] }[] = [];
  for (const e of [...events].sort((a, b) => b.at.getTime() - a.at.getTime())) {
    const label = dayLabel(e.at, now);
    const last = groups[groups.length - 1];
    if (last?.label === label) last.events.push(e);
    else groups.push({ label, events: [e] });
  }

  return (
    <div className="flex flex-col gap-5">
      {groups.map((g) => (
        <section key={g.label} aria-label={g.label} className="flex flex-col gap-4">
          <div className="flex items-center gap-3 text-[11px] font-medium text-muted-foreground" aria-hidden>
            <span className="h-px flex-1 bg-border" />
            {g.label}
            <span className="h-px flex-1 bg-border" />
          </div>
          <ol className="relative flex flex-col gap-5">
            <span className="absolute top-4 bottom-4 left-4 w-px bg-border" aria-hidden />
            {g.events.map((e) => (
              <li key={e.id} className="relative flex gap-3">
                <span className="relative h-8 shrink-0">
                  {e.actor ? (
                    <Avatar name={e.actor} size="md" className="ring-4 ring-page" />
                  ) : (
                    <span className="grid size-8 place-items-center rounded-full border bg-card text-xs font-semibold text-muted-foreground ring-4 ring-page" aria-hidden>
                      SY
                    </span>
                  )}
                  <span className="absolute -right-1 -bottom-1 grid size-4 place-items-center rounded-full border bg-card text-muted-foreground" aria-hidden>
                    <Icon icon={e.icon} size={10} />
                  </span>
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5 pt-1.5">
                  <div className="flex items-baseline gap-3">
                    <p className="min-w-0 flex-1 text-sm text-muted-foreground">
                      <span className="text-foreground">{e.actor ?? "System"}</span>
                      {e.action && <> {e.action}</>}
                      {e.target && <> <span className="text-foreground">{e.target}</span></>}
                    </p>
                    <time dateTime={e.at.toISOString()} className="tabular shrink-0 text-xs text-muted-foreground">
                      {timeLabel(e.at, now)}
                    </time>
                  </div>
                  {e.body}
                </div>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
