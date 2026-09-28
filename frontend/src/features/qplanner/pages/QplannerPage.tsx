import { useCallback, useEffect, useState } from 'react';
import {
  CalendarRange,
  Loader2,
  RefreshCw,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { IconBadge, PageHero, PageShell } from '@/components/explorer';
import { apiErrorMessage } from '@/api/verification';

import { fetchPlan, replan, setTaskComplete } from '../api';
import { PlanBoard, TodayPanel } from '../components/PlanBoard';
import { PlanCalendar, PlanGraph } from '../components/PlanViews';
import { PlanSetup } from '../components/PlanSetup';
import { SprintQuizDialog } from '../components/SprintQuizDialog';
import type { Drift, Plan, PlanSprint, PlanTask } from '../types/qplanner.types';

function DriftBanner({
  drift,
  onReplan,
  replanning,
}: {
  drift: Drift;
  onReplan: () => void;
  replanning: boolean;
}) {
  const behind = drift.status === 'behind';
  const ahead = drift.status === 'ahead';
  const Icon = behind ? TrendingDown : TrendingUp;

  const message = behind
    ? `You're ${Math.abs(drift.delta)} task${Math.abs(drift.delta) === 1 ? '' : 's'} behind schedule.`
    : ahead
      ? `You're ${drift.delta} task${drift.delta === 1 ? '' : 's'} ahead. Nice.`
      : 'On track.';

  return (
    <div
      aria-live="polite"
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4',
        behind && 'border-destructive',
      )}
    >
      <div className="flex items-center gap-2 text-sm">
        <Icon className={cn('h-4 w-4', behind ? 'text-destructive' : 'text-primary')} aria-hidden />
        <span>{message}</span>
        <span className="text-muted-foreground">
          {drift.completed} of {drift.total} tasks done.
        </span>
      </div>

      {/* The plan is never reshuffled automatically -- rebuilding is the learner's call. */}
      <Button size="sm" variant="outline" onClick={onReplan} disabled={replanning}>
        {replanning ? (
          <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <RefreshCw className="mr-1 h-4 w-4" aria-hidden />
        )}
        Re-plan from today
      </Button>
    </div>
  );
}

export default function QplannerPage() {
  // undefined = still loading, null = no plan yet
  const [plan, setPlan] = useState<Plan | null | undefined>(undefined);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [busyTask, setBusyTask] = useState<string | null>(null);
  const [quizSprint, setQuizSprint] = useState<PlanSprint | null>(null);
  const [replanning, setReplanning] = useState(false);

  const adopt = useCallback((next: Plan) => {
    setPlan(next);
    setCompleted(new Set(next.completed_tasks));
  }, []);

  const load = useCallback(() => {
    fetchPlan()
      .then((response) => adopt(response.data))
      .catch((error) => {
        setPlan(null);
        // a 404 is the normal first visit, not a failure worth shouting about
        if (error?.response?.status !== 404) {
          toast.error(apiErrorMessage(error, 'Could not load your plan'));
        }
      });
  }, [adopt]);

  useEffect(load, [load]);

  async function toggleTask(task: PlanTask, next: boolean) {
    setBusyTask(task.task_id);
    // optimistic: ticking should feel instant, and a failure rolls it back
    setCompleted((current) => {
      const updated = new Set(current);
      if (next) updated.add(task.task_id);
      else updated.delete(task.task_id);
      return updated;
    });

    try {
      const response = await setTaskComplete(task.task_id, next);
      setPlan((current) => (current ? { ...current, drift: response.data.drift } : current));
    } catch (error) {
      setCompleted((current) => {
        const rolledBack = new Set(current);
        if (next) rolledBack.delete(task.task_id);
        else rolledBack.add(task.task_id);
        return rolledBack;
      });
      toast.error(apiErrorMessage(error, 'Could not update that task'));
    } finally {
      setBusyTask(null);
    }
  }

  async function rebuild() {
    setReplanning(true);
    try {
      const response = await replan();
      adopt(response.data);
      toast.success('Plan rebuilt from today');
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Could not rebuild the plan'));
    } finally {
      setReplanning(false);
    }
  }

  return (
    <PageShell width="narrow">
      <PageHero
        eyebrow={
          <IconBadge>
            <Target className="h-6 w-6" aria-hidden />
          </IconBadge>
        }
        title="Qplanner"
        subtitle="Turn a goal into weekly sprints and daily tasks, built around what you already know."
      />

        {plan === undefined ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-5 w-5 animate-spin text-primary" aria-label="Loading your plan" />
          </div>
        ) : plan === null ? (
          <PlanSetup onPlanCreated={adopt} />
        ) : (
          <>
            <DriftBanner drift={plan.drift} onReplan={rebuild} replanning={replanning} />

            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <TodayPanel
                  day={plan.today}
                  completed={completed}
                  busyTask={busyTask}
                  onToggle={toggleTask}
                />
              </div>

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base">{plan.goal_label}</CardTitle>
                    {plan.ai_generated ? (
                      <Badge variant="secondary" className="shrink-0">
                        <Sparkles className="mr-1 h-3 w-3" aria-hidden />
                        Tailored
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="shrink-0" title="AI copy was unavailable">
                        Basic
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 text-sm">
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <CalendarRange className="h-4 w-4" aria-hidden />
                    {plan.sprints.length} sprints, by {plan.deadline}
                  </p>
                  {plan.strategy_note && <p>{plan.strategy_note}</p>}
                  {plan.personalized_tips.length > 0 && (
                    <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                      {plan.personalized_tips.map((tip) => (
                        <li key={tip}>{tip}</li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="board">
              <TabsList>
                <TabsTrigger value="board">Sprints</TabsTrigger>
                <TabsTrigger value="calendar">Calendar</TabsTrigger>
                <TabsTrigger value="flow">Flow</TabsTrigger>
              </TabsList>

              <TabsContent value="board" className="mt-4">
                <PlanBoard
                  plan={plan}
                  completed={completed}
                  busyTask={busyTask}
                  onToggle={toggleTask}
                  onStartQuiz={setQuizSprint}
                />
              </TabsContent>

              <TabsContent value="calendar" className="mt-4">
                <PlanCalendar plan={plan} completed={completed} />
              </TabsContent>

              <TabsContent value="flow" className="mt-4">
                <PlanGraph plan={plan} />
              </TabsContent>
            </Tabs>
          </>
        )}
      <SprintQuizDialog sprint={quizSprint} onClose={() => setQuizSprint(null)} onPassed={load} />
    </PageShell>
  );
}
