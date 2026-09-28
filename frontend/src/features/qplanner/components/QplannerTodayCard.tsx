import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Loader2, Target } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

import { fetchPlan } from '../api';
import type { Plan } from '../types/qplanner.types';
import { TASK_KIND_LABEL } from '../types/qplanner.types';

const MAX_PREVIEW_TASKS = 3;

/**
 * Dashboard entry point for Qplanner: today's tasks, or a prompt to build a plan.
 * Read-only on purpose -- ticking things off happens on /qplanner, so there is one
 * place where completion state lives.
 */
export function QplannerTodayCard() {
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

  if (plan === undefined) {
    return (
      <Card>
        <CardContent className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-primary" aria-label="Loading your plan" />
        </CardContent>
      </Card>
    );
  }

  if (plan === null) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-4 w-4 text-primary" aria-hidden />
            Plan your learning
          </CardTitle>
          <CardDescription>
            Pick a goal and a deadline, and Qplanner turns the roadmap into weekly sprints.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild size="sm">
            <Link to="/qplanner">
              Build a plan
              <ArrowRight className="ml-1 h-4 w-4" aria-hidden />
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const done = new Set(plan.completed_tasks);
  const tasks = plan.today.tasks;
  const completedToday = tasks.filter((task) => done.has(task.task_id)).length;
  const pct = tasks.length === 0 ? 0 : Math.round((completedToday / tasks.length) * 100);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Target className="h-4 w-4 text-primary" aria-hidden />
          Today in your plan
        </CardTitle>
        <CardDescription>
          {tasks.length === 0
            ? 'No session scheduled today.'
            : `${completedToday} of ${tasks.length} tasks done · ${plan.goal_label}`}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {tasks.length > 0 && (
          <>
            <Progress value={pct} className="h-2" aria-label="Today's progress" />
            <ul className="flex flex-col gap-1 text-sm">
              {tasks.slice(0, MAX_PREVIEW_TASKS).map((task) => (
                <li key={task.task_id} className="flex items-center justify-between gap-2">
                  <span className="truncate">{task.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {TASK_KIND_LABEL[task.kind]}
                  </span>
                </li>
              ))}
            </ul>
            {tasks.length > MAX_PREVIEW_TASKS && (
              <p className="text-xs text-muted-foreground">
                +{tasks.length - MAX_PREVIEW_TASKS} more
              </p>
            )}
          </>
        )}

        <Button asChild size="sm" variant="outline" className="self-start">
          <Link to="/qplanner">
            Open Qplanner
            <ArrowRight className="ml-1 h-4 w-4" aria-hidden />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
