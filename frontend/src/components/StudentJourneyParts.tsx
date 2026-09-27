import { Award, BookOpenCheck, CheckCircle2, ClipboardCheck, Flag, GraduationCap, Map, Milestone, UserPlus } from 'lucide-react';
import { parseUtc } from '@/api/educatorAnalytics';
import type { TimelineEvent } from '@/api/educatorAnalytics';

// Shared by the course-scope and classroom-scope journeys; classroom events use the extra icons.
const EVENT_ICONS: Record<string, typeof Flag> = {
  enrolled: UserPlus,
  lesson_completed: BookOpenCheck,
  course_completed: Flag,
  quiz_attempt: ClipboardCheck,
  assessment: GraduationCap,
  topic_started: Map,
  topic_completed: Milestone,
  badge_earned: Award,
};

// Sequential single-hue scale (primary), light -> dark; 0 uses the muted track.
function heatClass(count: number) {
  if (count <= 0) return 'bg-muted';
  if (count === 1) return 'bg-primary/40';
  if (count === 2) return 'bg-primary/70';
  return 'bg-primary';
}

function formatDay(day: string) {
  return new Date(`${day}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

/** days: {YYYY-MM-DD: count}. `describe` turns a count into the cell tooltip text. */
export function ActivityHeatmap({ days, describe }: { days: Record<string, number>; describe: (count: number) => string }) {
  const entries = Object.entries(days);
  const activeDays = entries.filter(([, c]) => c > 0).length;
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-rows-7 grid-flow-col gap-1 w-fit" role="img"
        aria-label={`${activeDays} active days in the last ${entries.length} days`}>
        {entries.map(([day, count]) => (
          <div key={day} className={`w-3.5 h-3.5 rounded-[3px] ${heatClass(count)}`} title={`${formatDay(day)}: ${describe(count)}`} />
        ))}
      </div>
      <div className="flex items-center justify-between gap-4 text-xs text-muted-foreground">
        <span>{activeDays} active day{activeDays === 1 ? '' : 's'} in the last {Math.round(entries.length / 7)} weeks</span>
        <span className="flex items-center gap-1">
          Less {[0, 1, 2, 3].map((n) => <span key={n} className={`w-3 h-3 rounded-[3px] ${heatClass(n)}`} />)} More
        </span>
      </div>
    </div>
  );
}

export function Timeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) return <p className="text-sm text-muted-foreground">No activity yet.</p>;
  return (
    <ol>
      {events.map((event, i) => {
        const Icon = EVENT_ICONS[event.type] || CheckCircle2;
        const at = parseUtc(event.at);
        return (
          <li key={`${event.type}-${event.at}-${i}`} className="relative flex gap-3 pb-5">
            {i < events.length - 1 && <span className="absolute left-[15px] top-8 bottom-0 w-px bg-border" aria-hidden />}
            <div className="w-8 h-8 shrink-0 rounded-full border bg-primary/10 border-primary/20 text-primary flex items-center justify-center">
              <Icon className="w-4 h-4" aria-hidden />
            </div>
            <div className="min-w-0 pt-1">
              <p className="text-sm">{event.title}</p>
              <p className="text-xs text-muted-foreground">
                {[event.detail, at?.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })].filter(Boolean).join(' · ')}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
