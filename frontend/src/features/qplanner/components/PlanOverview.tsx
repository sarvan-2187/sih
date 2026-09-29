import { useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Loader2, RefreshCw } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useTheme } from '@/context/ThemeContext';
import { AccentButton, ExplorerPanel, Pill, ProgressBar, tone } from '@/components/explorer';

import type { Plan, PlanTask } from '../types/qplanner.types';
import { formatMinutes, todayIso, weekDates } from './PlanBoard';

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function PanelLabel({ children }: { children: string }) {
  const { theme } = useTheme();
  return <h3 className={cn('text-xs font-medium uppercase tracking-wider', tone.muted(theme))}>{children}</h3>;
}

/** Plan header plus the four-cell progress bento (overall, sprint week, today, pace). */
export function PlanOverview({
  plan,
  completed,
  onReplan,
  replanning,
}: {
  plan: Plan;
  completed: Set<string>;
  onReplan: () => void;
  replanning: boolean;
}) {
  const { theme } = useTheme();
  const today = todayIso();
  const tasksByDate = new Map(plan.days.map((day) => [day.date, day.tasks]));
  const allTasks = plan.days.flatMap((day) => day.tasks);
  const doneTasks = allTasks.filter((t) => completed.has(t.task_id));
  const minutesOf = (tasks: PlanTask[]) => tasks.reduce((sum, t) => sum + t.minutes, 0);

  const activeIndex = Math.max(0, plan.sprints.findIndex((s) => s.status === 'active'));
  const [shown, setShown] = useState(activeIndex);
  const sprint = plan.sprints[Math.min(shown, plan.sprints.length - 1)];
  const sprintsDone = plan.sprints.filter((s) => s.status === 'completed').length;
  const pct = allTasks.length ? Math.round((doneTasks.length / allTasks.length) * 100) : 0;

  const todayTasks = plan.today.tasks;
  const todayDone = todayTasks.filter((t) => completed.has(t.task_id));
  const todayPct = todayTasks.length ? (todayDone.length / todayTasks.length) * 100 : 0;

  const drift = plan.drift;
  const pace =
    drift.status === 'behind'
      ? `${Math.abs(drift.delta)} task${Math.abs(drift.delta) === 1 ? '' : 's'} behind schedule`
      : drift.status === 'ahead'
        ? `${drift.delta} task${drift.delta === 1 ? '' : 's'} ahead of schedule`
        : 'On track';

  const ring = 2 * Math.PI * 44;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-medium tracking-tight">{plan.goal_label}</h2>
            {plan.ai_generated ? (
              <Pill variant="accent">Tailored</Pill>
            ) : (
              <Pill title="AI copy was unavailable when this plan was built">Basic</Pill>
            )}
          </div>
          <p className={cn('text-sm', tone.secondary(theme))}>
            Started {formatDate(plan.start_date)} · Currently on Sprint {activeIndex + 1} · Ends{' '}
            {formatDate(plan.deadline)}
          </p>
        </div>
        {/* The plan is never reshuffled automatically -- rebuilding is the learner's call. */}
        <AccentButton variant="outline" onClick={onReplan} disabled={replanning}>
          {replanning ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />}
          Re-plan from today
        </AccentButton>
      </div>

      {plan.strategy_note && (
        <p className={cn('max-w-3xl text-sm leading-relaxed', tone.secondary(theme))}>{plan.strategy_note}</p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <ExplorerPanel className="flex flex-col gap-5">
          <PanelLabel>Overall progress</PanelLabel>
          <div className="flex items-center gap-8">
            <svg viewBox="0 0 100 100" className="h-28 w-28 shrink-0" role="img" aria-label={`${pct}% of tasks done`}>
              <circle cx="50" cy="50" r="44" fill="none" strokeWidth="8" className={theme === 'dark' ? 'stroke-white/10' : 'stroke-zinc-200'} />
              <circle
                cx="50"
                cy="50"
                r="44"
                fill="none"
                strokeWidth="8"
                strokeLinecap="round"
                transform="rotate(-90 50 50)"
                className="stroke-emerald-500 transition-all duration-500"
                strokeDasharray={ring}
                strokeDashoffset={ring * (1 - pct / 100)}
              />
              <text x="50" y="50" textAnchor="middle" dominantBaseline="central" className="fill-current text-xl font-medium">
                {pct}%
              </text>
            </svg>
            <dl className="grid flex-1 gap-2 text-sm">
              <Row label="Sprints" value={`${sprintsDone} / ${plan.sprints.length}`} />
              <Row label="Tasks" value={`${doneTasks.length} / ${allTasks.length}`} />
              <Row label="Time" value={`${formatMinutes(minutesOf(doneTasks))} / ${formatMinutes(minutesOf(allTasks))}`} />
            </dl>
          </div>
        </ExplorerPanel>

        <ExplorerPanel className="flex flex-col gap-5">
          <div className="flex items-center justify-between gap-3">
            <PanelLabel>Sprint progress</PanelLabel>
            <div className="flex items-center gap-2">
              <StepButton label="Previous sprint" disabled={shown === 0} onClick={() => setShown(shown - 1)}>
                <ChevronLeft className="h-4 w-4" aria-hidden />
              </StepButton>
              <span className="w-20 text-center text-sm font-medium">Sprint {sprint.index + 1}</span>
              <StepButton
                label="Next sprint"
                disabled={shown >= plan.sprints.length - 1}
                onClick={() => setShown(shown + 1)}
              >
                <ChevronRight className="h-4 w-4" aria-hidden />
              </StepButton>
            </div>
          </div>
          <ol className="relative flex justify-between">
            <span className={cn('absolute left-4 right-4 top-4 h-px', theme === 'dark' ? 'bg-white/10' : 'bg-zinc-200')} aria-hidden />
            {weekDates(sprint.start_date).map((date, i) => {
              const tasks = tasksByDate.get(date) ?? [];
              const rest = tasks.length === 0;
              const done = !rest && tasks.every((t) => completed.has(t.task_id));
              const isToday = date === today;
              return (
                <li key={date} className="relative flex flex-col items-center gap-2" title={rest ? 'Rest day' : `${tasks.length} tasks`}>
                  <span
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-full border text-sm tabular-nums',
                      done
                        ? 'border-emerald-500 bg-emerald-500 text-white'
                        : isToday
                          ? cn('border-emerald-500 text-emerald-500', theme === 'dark' ? 'bg-zinc-950' : 'bg-white')
                          : cn(tone.badge(theme), rest && 'opacity-50'),
                    )}
                  >
                    {i + 1}
                  </span>
                  <span className={cn('text-xs', isToday ? 'font-medium' : tone.muted(theme))}>
                    {rest ? 'Rest' : `Day ${i + 1}`}
                  </span>
                </li>
              );
            })}
          </ol>
          {sprint.title && <p className={cn('text-sm', tone.secondary(theme))}>{sprint.title}</p>}
        </ExplorerPanel>

        <ExplorerPanel className="flex flex-col gap-4">
          <PanelLabel>Today's progress</PanelLabel>
          <dl className="grid gap-3 text-sm">
            <Row label="Tasks" value={`${todayDone.length} / ${todayTasks.length}`} />
            <Row label="Done" value={formatMinutes(minutesOf(todayDone))} />
            <Row label="Scheduled" value={formatMinutes(minutesOf(todayTasks))} />
          </dl>
          <ProgressBar value={todayPct} label="Today's tasks done" />
        </ExplorerPanel>

        <ExplorerPanel className="flex flex-col gap-4">
          <PanelLabel>Pace</PanelLabel>
          <p
            className={cn('text-lg font-medium', drift.status === 'behind' ? 'text-red-500' : 'text-emerald-500')}
            aria-live="polite"
          >
            {pace}
          </p>
          <p className={cn('text-sm', tone.secondary(theme))}>
            {drift.completed} of {drift.expected} tasks due so far are done. Est. completion{' '}
            {formatDate(plan.deadline)}.
          </p>
          {plan.personalized_tips.length > 0 && (
            <ul className={cn('list-disc space-y-1 pl-5 text-sm', tone.secondary(theme))}>
              {plan.personalized_tips.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          )}
        </ExplorerPanel>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const { theme } = useTheme();
  return (
    <div className="flex items-baseline justify-between gap-6">
      <dt className={tone.secondary(theme)}>{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}

function StepButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  const { theme } = useTheme();
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn('rounded-md border p-1 transition-colors hover:text-emerald-500 disabled:opacity-30', tone.badge(theme))}
    >
      {children}
    </button>
  );
}
