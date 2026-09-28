import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  Check,
  CircleDashed,
  ClipboardCheck,
  Layers,
  Lock,
  PlayCircle,
  Timer,
  Video,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

import type { Plan, PlanDay, PlanSprint, PlanTask, TaskKind } from '../types/qplanner.types';
import { TASK_KIND_LABEL } from '../types/qplanner.types';

const KIND_ICON: Record<TaskKind, typeof Video> = {
  learn_video: Video,
  read_slides: BookOpen,
  practice_quiz: ClipboardCheck,
  revise_flashcards: Layers,
};

function formatDay(date: string): string {
  return new Date(date + 'T00:00:00').toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
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
  const Icon = KIND_ICON[task.kind];
  const target = taskTarget(task);
  const external = target.startsWith('http');

  return (
    <li className="flex items-center gap-3 py-2">
      <Button
        type="button"
        size="icon"
        variant={done ? 'default' : 'outline'}
        className="h-7 w-7 shrink-0 rounded-full"
        disabled={busy}
        aria-pressed={done}
        aria-label={(done ? 'Mark incomplete: ' : 'Mark complete: ') + task.title}
        onClick={() => onToggle(task, !done)}
      >
        {done ? (
          <Check className="h-3.5 w-3.5" aria-hidden />
        ) : (
          <CircleDashed className="h-3.5 w-3.5" aria-hidden />
        )}
      </Button>

      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />

      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-sm', done && 'text-muted-foreground line-through')}>
          {task.title}
        </p>
        <p className="text-xs text-muted-foreground">
          {TASK_KIND_LABEL[task.kind]} · {task.minutes} min
        </p>
      </div>

      <Button asChild size="sm" variant="ghost" className="shrink-0">
        {external ? (
          <a href={target} target="_blank" rel="noopener noreferrer">Open</a>
        ) : (
          <Link to={target}>Open</Link>
        )}
      </Button>

      <Button asChild size="sm" variant="ghost" className="shrink-0" title="Study this with the timer">
        <Link
          to={`/focus?topic=${encodeURIComponent(task.topic_slug)}&task=${encodeURIComponent(task.task_id)}`}
          aria-label={'Start the focus timer for ' + task.title}
        >
          <Timer className="h-4 w-4" aria-hidden />
        </Link>
      </Button>
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
  const done = day.tasks.filter((task) => completed.has(task.task_id)).length;
  const minutes = day.tasks.reduce((total, task) => total + task.minutes, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Today</CardTitle>
        <CardDescription>
          {day.tasks.length === 0
            ? 'Nothing scheduled — this is not one of your study days.'
            : `${done} of ${day.tasks.length} done · about ${minutes} minutes`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {day.tasks.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Enjoy the break, or work ahead from a sprint below.
          </p>
        ) : (
          <ul className="divide-y" aria-live="polite">
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
      </CardContent>
    </Card>
  );
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
  const [open, setOpen] = useState(sprint.status === 'active');
  const tasks = days.flatMap((day) => day.tasks);
  const done = tasks.filter((task) => completed.has(task.task_id)).length;
  const pct = tasks.length === 0 ? 0 : Math.round((done / tasks.length) * 100);

  return (
    <Card className={cn(sprint.status === 'active' && 'border-primary')}>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base">
              Week {sprint.index + 1}: {sprint.title}
            </CardTitle>
            {sprint.focus_line && <CardDescription>{sprint.focus_line}</CardDescription>}
          </div>
          <Badge
            variant={
              sprint.status === 'completed'
                ? 'default'
                : sprint.status === 'active'
                  ? 'secondary'
                  : 'outline'
            }
            className="shrink-0 capitalize"
          >
            {sprint.status === 'locked' && <Lock className="mr-1 h-3 w-3" aria-hidden />}
            {sprint.status}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <Progress value={pct} className="h-2" aria-label={`Week ${sprint.index + 1} progress`} />
          <span className="shrink-0 text-xs text-muted-foreground">
            {done}/{tasks.length}
          </span>
        </div>

        <p className="text-xs text-muted-foreground">
          {formatDay(sprint.start_date)} – {formatDay(sprint.end_date)} ·{' '}
          {sprint.topic_slugs.length} topics · {sprint.planned_minutes} min
        </p>

        {sprint.why_it_matters && (
          <p className="text-sm text-muted-foreground">{sprint.why_it_matters}</p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => setOpen((value) => !value)}>
            {open ? 'Hide tasks' : 'Show tasks'}
          </Button>

          {sprint.quiz ? (
            <Badge variant={sprint.quiz.passed ? 'default' : 'destructive'}>
              Sprint quiz {Math.round(sprint.quiz.score_pct)}%
            </Badge>
          ) : (
            <Button size="sm" variant="outline" onClick={() => onStartQuiz(sprint)}>
              <PlayCircle className="mr-1 h-4 w-4" aria-hidden />
              Take sprint quiz
            </Button>
          )}
        </div>

        {open && (
          <div className="flex flex-col gap-3 pt-1">
            {days.map((day) => (
              <div key={day.date}>
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  {formatDay(day.date)}
                </p>
                <ul className="divide-y">
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
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
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
    <div className="grid gap-4 lg:grid-cols-2">
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
