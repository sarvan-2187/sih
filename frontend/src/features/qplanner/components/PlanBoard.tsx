import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  CircleDashed,
  ClipboardCheck,
  Layers,
  Lock,
  Timer,
  Video,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { useTheme } from '@/context/ThemeContext';
import { AccentButton, ExplorerPanel, Pill, tone } from '@/components/explorer';

import type { Plan, PlanDay, PlanSprint, PlanTask, TaskKind } from '../types/qplanner.types';
import { TASK_KIND_LABEL } from '../types/qplanner.types';

const KIND_ICON: Record<TaskKind, typeof Video> = {
  learn_video: Video,
  read_slides: BookOpen,
  practice_quiz: ClipboardCheck,
  revise_flashcards: Layers,
};

type Theme = ReturnType<typeof useTheme>['theme'];

/** Compact text-weight action for dense rows, where AccentButton's padding would crowd. */
function ghostClass(theme: Theme) {
  return cn(
    'inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium transition-colors',
    tone.secondary(theme),
    'hover:text-emerald-500',
  );
}

function ruleClass(theme: Theme) {
  return theme === 'dark' ? 'border-white/10' : 'border-zinc-200';
}

function formatDay(date: string): string {
  return new Date(date + 'T00:00:00').toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

/** 30 -> "30 min", 96 -> "1h 36m", 300 -> "5h". */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

/** Today's date as YYYY-MM-DD in the learner's own timezone, matching plan day dates. */
export function todayIso(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

/** Where a task hands off to the surface that actually does the work. */
function taskTarget(task: PlanTask): string {
  const ref = task.ref as Record<string, string>;
  switch (task.kind) {
    case 'learn_video':
    case 'read_slides':
      return ref.url ?? `/roadmap/${task.topic_slug}`;
    case 'practice_quiz':
      return `/quiz/${task.topic_slug}`;
    case 'revise_flashcards':
      return `/flashcards?category=${encodeURIComponent(ref.flashcard_category ?? '')}`;
    default:
      return `/roadmap/${task.topic_slug}`;
  }
}

/** Opens external URLs (videos) in a new tab and routes internal ones. */
function TaskLink({
  task,
  className,
  children,
  ariaLabel,
}: {
  task: PlanTask;
  className: string;
  children: React.ReactNode;
  ariaLabel?: string;
}) {
  const target = taskTarget(task);
  return target.startsWith('http') ? (
    <a href={target} target="_blank" rel="noopener noreferrer" className={className} aria-label={ariaLabel}>
      {children}
    </a>
  ) : (
    <Link to={target} className={className} aria-label={ariaLabel}>
      {children}
    </Link>
  );
}

export function TaskRow({
  task,
  done,
  busy,
  onToggle,
}: {
  task: PlanTask;
  done: boolean;
  busy: boolean;
  onToggle: (task: PlanTask, next: boolean) => void;
}) {
  const { theme } = useTheme();
  const Icon = KIND_ICON[task.kind];

  return (
    <li className="flex items-center gap-3 py-3">
      <button
        type="button"
        disabled={busy}
        aria-pressed={done}
        aria-label={(done ? 'Mark incomplete: ' : 'Mark complete: ') + task.title}
        onClick={() => onToggle(task, !done)}
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors disabled:opacity-50',
          done
            ? 'border-emerald-500 bg-emerald-500 text-white'
            : cn(tone.badge(theme), 'hover:border-emerald-500/50 hover:text-emerald-500'),
        )}
      >
        {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : <CircleDashed className="h-3.5 w-3.5" aria-hidden />}
      </button>

      <Icon className={cn('h-4 w-4 shrink-0', tone.muted(theme))} aria-hidden />

      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-sm font-medium', done && cn('line-through', tone.muted(theme)))}>
          {task.title}
        </p>
        <p className={cn('text-xs', tone.secondary(theme))}>
          {TASK_KIND_LABEL[task.kind]} · {task.minutes} min
        </p>
      </div>

      {done && <Pill variant="accent">Done</Pill>}

      <TaskLink task={task} className={ghostClass(theme)}>
        Open
      </TaskLink>

      <Link
        to={`/focus?topic=${encodeURIComponent(task.topic_slug)}&task=${encodeURIComponent(task.task_id)}`}
        className={ghostClass(theme)}
        aria-label={'Start the focus timer for ' + task.title}
        title="Study this with the timer"
      >
        <Timer className="h-4 w-4" aria-hidden />
      </Link>
    </li>
  );
}

export function TodayPanel({
  day,
  completed,
  busyTask,
  onToggle,
}: {
  day: PlanDay;
  completed: Set<string>;
  busyTask: string | null;
  onToggle: (task: PlanTask, next: boolean) => void;
}) {
  const { theme } = useTheme();
  const done = day.tasks.filter((task) => completed.has(task.task_id)).length;
  const minutes = day.tasks.reduce((total, task) => total + task.minutes, 0);

  return (
    <ExplorerPanel className="flex h-full flex-col gap-4">
      <div>
        <h2 className="text-lg font-medium tracking-tight">Today</h2>
        <p className={cn('text-sm', tone.secondary(theme))}>
          {day.tasks.length === 0
            ? 'Nothing scheduled — this is not one of your study days.'
            : `${done} of ${day.tasks.length} done · about ${formatMinutes(minutes)}`}
        </p>
      </div>

      {day.tasks.length === 0 ? (
        <p className={cn('py-6 text-center text-sm', tone.secondary(theme))}>
          Enjoy the break, or work ahead from a sprint below.
        </p>
      ) : (
        <ul className={cn('divide-y', theme === 'dark' ? 'divide-white/10' : 'divide-zinc-200')} aria-live="polite">
          {day.tasks.map((task) => (
            <TaskRow
              key={task.task_id}
              task={task}
              done={completed.has(task.task_id)}
              busy={busyTask === task.task_id}
              onToggle={onToggle}
            />
          ))}
        </ul>
      )}
    </ExplorerPanel>
  );
}

/** Round node sitting on the tree line; the chevron turns when its row is open. */
function TreeNodeButton({ open, onClick, label }: { open: boolean; onClick: () => void; label: string }) {
  const { theme } = useTheme();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      aria-label={label}
      className={cn(
        'relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors',
        theme === 'dark' ? 'bg-zinc-950' : 'bg-white',
        open
          ? 'border-emerald-500 text-emerald-500'
          : cn(ruleClass(theme), tone.secondary(theme), 'hover:text-emerald-500'),
      )}
    >
      <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-90')} aria-hidden />
    </button>
  );
}

function DayRow({
  day,
  dayNumber,
  completed,
  busyTask,
  onToggle,
  defaultOpen,
}: {
  day: PlanDay;
  dayNumber: number;
  completed: Set<string>;
  busyTask: string | null;
  onToggle: (task: PlanTask, next: boolean) => void;
  defaultOpen: boolean;
}) {
  const { theme } = useTheme();
  const [open, setOpen] = useState(defaultOpen);
  const isToday = day.date === todayIso();
  const minutes = day.tasks.reduce((total, task) => total + task.minutes, 0);
  const done = day.tasks.filter((task) => completed.has(task.task_id)).length;
  const allDone = day.tasks.length > 0 && done === day.tasks.length;
  const next = day.tasks.find((task) => !completed.has(task.task_id));

  return (
    <li>
      <div className="flex items-center gap-3 py-2">
        <TreeNodeButton
          open={open}
          onClick={() => setOpen((value) => !value)}
          label={`${open ? 'Hide' : 'Show'} Day ${dayNumber} tasks`}
        />
        <span className={cn('font-medium', allDone && tone.muted(theme))}>Day {dayNumber}</span>
        <span className={cn('hidden text-xs sm:inline', tone.muted(theme))}>{formatDay(day.date)}</span>

        <div className={cn('ml-auto flex items-center gap-3 text-sm', tone.secondary(theme))}>
          <span className="hidden tabular-nums sm:inline">
            Est. {formatMinutes(minutes)} · {done}/{day.tasks.length} done
          </span>
          {isToday && <Pill variant="accent">Today</Pill>}
          {next ? (
            <TaskLink
              task={next}
              ariaLabel={`Open the next task for Day ${dayNumber}: ${next.title}`}
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors',
                isToday
                  ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                  : cn('border', ruleClass(theme), 'hover:border-emerald-500/50 hover:text-emerald-500'),
              )}
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </TaskLink>
          ) : (
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500"
              title="All done"
            >
              <Check className="h-4 w-4" aria-label="All tasks done" />
            </span>
          )}
        </div>
      </div>

      {open && (
        <ul
          className={cn(
            'mb-2 ml-9 divide-y rounded-xl border px-3',
            ruleClass(theme),
            theme === 'dark' ? 'divide-white/10 bg-white/[0.02]' : 'divide-zinc-200 bg-zinc-50/60',
          )}
        >
          {day.tasks.map((task) => (
            <TaskRow
              key={task.task_id}
              task={task}
              done={completed.has(task.task_id)}
              busy={busyTask === task.task_id}
              onToggle={onToggle}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

/** The seven YYYY-MM-DD dates of a sprint week, starting at its start date. Built from
 *  local date parts so a timezone offset can never shift a day. */
export function weekDates(startIso: string): string[] {
  const [year, month, day] = startIso.split('-').map(Number);
  return Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(year, month - 1, day + offset);
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${mm}-${dd}`;
  });
}

/** A day in the sprint week with no study session scheduled. */
function RestDayRow({ date, dayNumber }: { date: string; dayNumber: number }) {
  const { theme } = useTheme();
  const isToday = date === todayIso();
  return (
    <li className="flex items-center gap-3 py-2">
      <span className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center" aria-hidden>
        <span className={cn('h-2 w-2 rounded-full', theme === 'dark' ? 'bg-white/20' : 'bg-zinc-300')} />
      </span>
      <span className={cn('font-medium', tone.muted(theme))}>Day {dayNumber}</span>
      <span className={cn('hidden text-xs sm:inline', tone.muted(theme))}>{formatDay(date)}</span>
      <div className={cn('ml-auto flex items-center gap-3 text-sm', tone.muted(theme))}>
        <span>Rest day</span>
        {isToday && <Pill>Today</Pill>}
      </div>
    </li>
  );
}

function SprintStatusDot({ sprint }: { sprint: PlanSprint }) {
  const { theme } = useTheme();
  if (sprint.status === 'completed') {
    return (
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white"
        aria-label="Completed"
      >
        <Check className="h-3.5 w-3.5" aria-hidden />
      </span>
    );
  }
  if (sprint.status === 'locked') {
    return (
      <span
        className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full border', ruleClass(theme), tone.muted(theme))}
        aria-label="Locked"
      >
        <Lock className="h-3 w-3" aria-hidden />
      </span>
    );
  }
  return <span className="h-6 w-6 shrink-0 rounded-full border-2 border-emerald-500" aria-label="Active" />;
}

function SprintCard({
  sprint,
  days,
  completed,
  busyTask,
  onToggle,
  onStartQuiz,
}: {
  sprint: PlanSprint;
  days: PlanDay[];
  completed: Set<string>;
  busyTask: string | null;
  onToggle: (task: PlanTask, next: boolean) => void;
  onStartQuiz: (sprint: PlanSprint) => void;
}) {
  const { theme } = useTheme();
  const [open, setOpen] = useState(sprint.status === 'active');
  const tasks = days.flatMap((day) => day.tasks);
  const done = tasks.filter((task) => completed.has(task.task_id)).length;
  const today = todayIso();
  // Open today's day if it falls in this sprint, otherwise the first one with work left.
  const focusDate =
    days.find((day) => day.date === today)?.date ??
    days.find((day) => day.tasks.some((task) => !completed.has(task.task_id)))?.date;

  return (
    <ExplorerPanel
      className={cn(
        'overflow-hidden p-0',
        sprint.status === 'active' && 'border-emerald-500/50',
        sprint.status === 'locked' && 'opacity-80',
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left"
      >
        <SprintStatusDot sprint={sprint} />
        <Pill variant={sprint.status === 'active' ? 'accent' : 'neutral'}>Sprint {sprint.index + 1}</Pill>
        <span className="min-w-0 truncate font-medium">{sprint.title}</span>
        <span className={cn('ml-auto hidden shrink-0 text-sm tabular-nums sm:inline', tone.secondary(theme))}>
          Est. {formatMinutes(sprint.planned_minutes)} · {done}/{tasks.length} done
        </span>
        <ChevronDown
          className={cn('ml-auto h-4 w-4 shrink-0 transition-transform sm:ml-0', tone.secondary(theme), open && 'rotate-180')}
          aria-hidden
        />
      </button>

      {open && (
        <div className={cn('border-t px-5 pb-4 pt-3', ruleClass(theme))}>
          {sprint.focus_line && <p className={cn('mb-3 text-sm', tone.secondary(theme))}>{sprint.focus_line}</p>}

          {/* The tree: a vertical rule running through each row's round node. */}
          <ol
            className={cn(
              'relative before:absolute before:bottom-5 before:left-3 before:top-5 before:w-px',
              theme === 'dark' ? 'before:bg-white/10' : 'before:bg-zinc-200',
            )}
          >
            {/* A sprint is one week, so it always shows Day 1..7. Days with no study
                session (not one of the learner's study days) appear as rest days. */}
            {weekDates(sprint.start_date).map((date, position) => {
              const day = days.find((candidate) => candidate.date === date);
              return day ? (
                <DayRow
                  key={date}
                  day={day}
                  dayNumber={position + 1}
                  completed={completed}
                  busyTask={busyTask}
                  onToggle={onToggle}
                  defaultOpen={date === focusDate}
                />
              ) : (
                <RestDayRow key={date} date={date} dayNumber={position + 1} />
              );
            })}

            {/* The sprint quiz is the last node: passing it unlocks the next sprint. */}
            <li className="flex items-center gap-3 py-2">
              <span
                className={cn(
                  'relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border',
                  theme === 'dark' ? 'bg-zinc-950' : 'bg-white',
                  sprint.quiz?.passed
                    ? 'border-emerald-500 text-emerald-500'
                    : cn(ruleClass(theme), tone.secondary(theme)),
                )}
                aria-hidden
              >
                <ClipboardCheck className="h-3.5 w-3.5" />
              </span>
              <span className="font-medium">Sprint quiz</span>
              <div className="ml-auto flex items-center gap-3">
                {sprint.quiz && (
                  <Pill variant={sprint.quiz.passed ? 'accent' : 'danger'}>
                    {Math.round(sprint.quiz.score_pct)}% · {sprint.quiz.passed ? 'passed' : 'try again'}
                  </Pill>
                )}
                {!sprint.quiz?.passed && (
                  <AccentButton variant="outline" onClick={() => onStartQuiz(sprint)} className="px-4 py-1.5">
                    {sprint.quiz ? 'Retake' : 'Take quiz'}
                  </AccentButton>
                )}
              </div>
            </li>
          </ol>
        </div>
      )}
    </ExplorerPanel>
  );
}

export function PlanBoard({
  plan,
  completed,
  busyTask,
  onToggle,
  onStartQuiz,
}: {
  plan: Plan;
  completed: Set<string>;
  busyTask: string | null;
  onToggle: (task: PlanTask, next: boolean) => void;
  onStartQuiz: (sprint: PlanSprint) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      {plan.sprints.map((sprint) => (
        <SprintCard
          key={sprint.index}
          sprint={sprint}
          days={plan.days.filter((day) => day.sprint_index === sprint.index)}
          completed={completed}
          busyTask={busyTask}
          onToggle={onToggle}
          onStartQuiz={onStartQuiz}
        />
      ))}
    </div>
  );
}
