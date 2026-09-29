import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Target } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useTheme } from '@/context/ThemeContext';
import { AccentButton, ExplorerPanel, IconBadge, ProgressBar, tone } from '@/components/explorer';

import { fetchPlan } from '../api';
import type { Plan } from '../types/qplanner.types';
import { TASK_KIND_LABEL } from '../types/qplanner.types';

const MAX_PREVIEW_TASKS = 3;

/**
 * Dashboard entry point for Qplanner: today's tasks, or a prompt to build a plan.
 * Laid out to match QRatingDashboardCard, which sits directly beneath it.
 * Read-only on purpose -- ticking things off happens on /qplanner, so completion
 * state lives in one place.
 */
export function QplannerTodayCard() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [plan, setPlan] = useState<Plan | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    fetchPlan()
      .then((response) => alive && setPlan(response.data))
      .catch(() => alive && setPlan(null)); // no plan yet, or unreachable: same CTA either way
    return () => {
      alive = false;
    };
  }, []);

  const done = new Set(plan?.completed_tasks ?? []);
  const tasks = plan?.today.tasks ?? [];
  const completedToday = tasks.filter((task) => done.has(task.task_id)).length;
  const pct = tasks.length === 0 ? 0 : (completedToday / tasks.length) * 100;

  return (
    <ExplorerPanel className="group">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <IconBadge size="sm">
            <Target className="h-4 w-4" aria-hidden />
          </IconBadge>
          <h2 className="text-lg font-medium">{plan ? 'Today in your plan' : 'Qplanner'}</h2>
        </div>
        {plan && (
          <button
            type="button"
            onClick={() => navigate('/qplanner')}
            className={cn('text-sm transition-colors hover:text-emerald-500', tone.muted(theme))}
          >
            View &rarr;
          </button>
        )}
      </div>

      {plan === undefined && (
        <div className="mt-5 flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-emerald-500" aria-label="Loading your plan" />
        </div>
      )}

      {plan === null && (
        <div className="mt-5 flex flex-col gap-4">
          <p className={cn('text-sm', tone.secondary(theme))}>
            Pick a goal and a deadline, and Qplanner turns the roadmap into weekly sprints.
          </p>
          <AccentButton onClick={() => navigate('/qplanner')}>Build a plan</AccentButton>
        </div>
      )}

      {plan && (
        <div className="mt-5 flex flex-col gap-3">
          <p className={cn('text-sm', tone.secondary(theme))}>
            {tasks.length === 0
              ? `No session scheduled today · ${plan.goal_label}`
              : `${completedToday} of ${tasks.length} tasks done · ${plan.goal_label}`}
          </p>

          {tasks.length > 0 && (
            <>
              <ProgressBar value={pct} label="Today's progress" />
              <ul className="flex flex-col gap-1.5 text-sm">
                {tasks.slice(0, MAX_PREVIEW_TASKS).map((task) => (
                  <li key={task.task_id} className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        'truncate',
                        done.has(task.task_id) && cn('line-through', tone.muted(theme)),
                      )}
                    >
                      {task.title}
                    </span>
                    <span className={cn('shrink-0 font-mono text-xs', tone.muted(theme))}>
                      {TASK_KIND_LABEL[task.kind]}
                    </span>
                  </li>
                ))}
              </ul>
              {tasks.length > MAX_PREVIEW_TASKS && (
                <p className={cn('text-xs', tone.muted(theme))}>
                  +{tasks.length - MAX_PREVIEW_TASKS} more
                </p>
              )}
            </>
          )}
        </div>
      )}
    </ExplorerPanel>
  );
}
