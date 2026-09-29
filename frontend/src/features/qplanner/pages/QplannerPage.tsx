import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { ExplorerTabPanel, ExplorerTabs, PageHero, PageShell } from '@/components/explorer';
import { apiErrorMessage } from '@/api/verification';

import { fetchPlan, replan, setTaskComplete } from '../api';
import { PlanBoard, TodayPanel } from '../components/PlanBoard';
import { PlanCalendar, PlanGraph } from '../components/PlanViews';
import { PlanOverview } from '../components/PlanOverview';
import { PlanSetup } from '../components/PlanSetup';
import { SprintQuizDialog } from '../components/SprintQuizDialog';
import type { Plan, PlanSprint, PlanTask } from '../types/qplanner.types';

type PlanView = 'board' | 'calendar' | 'flow';

const PLAN_VIEWS: { value: PlanView; label: string }[] = [
  { value: 'board', label: 'Sprints' },
  { value: 'calendar', label: 'Calendar' },
  { value: 'flow', label: 'Flow' },
];

export default function QplannerPage() {
  // undefined = still loading, null = no plan yet
  const [plan, setPlan] = useState<Plan | null | undefined>(undefined);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [busyTask, setBusyTask] = useState<string | null>(null);
  const [quizSprint, setQuizSprint] = useState<PlanSprint | null>(null);
  const [replanning, setReplanning] = useState(false);
  const [view, setView] = useState<PlanView>('board');

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
    <PageShell>
      <PageHero
        title="Qplanner"
        subtitle="Turn a goal into weekly sprints and daily tasks, built around what you already know."
      />

      {plan === undefined ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-5 w-5 animate-spin text-emerald-500" aria-label="Loading your plan" />
        </div>
      ) : plan === null ? (
        <PlanSetup onPlanCreated={adopt} />
      ) : (
        <>
          <PlanOverview key={plan.id} plan={plan} completed={completed} onReplan={rebuild} replanning={replanning} />

          <TodayPanel day={plan.today} completed={completed} busyTask={busyTask} onToggle={toggleTask} />

          <div className="flex flex-col gap-6">
            <ExplorerTabs
              tabs={PLAN_VIEWS}
              value={view}
              onChange={setView}
              label="Plan views"
              idPrefix="qplanner"
            />

            <ExplorerTabPanel idPrefix="qplanner" value={view}>
              {view === 'board' && (
                <PlanBoard
                  plan={plan}
                  completed={completed}
                  busyTask={busyTask}
                  onToggle={toggleTask}
                  onStartQuiz={setQuizSprint}
                />
              )}
              {view === 'calendar' && <PlanCalendar plan={plan} completed={completed} />}
              {view === 'flow' && <PlanGraph plan={plan} />}
            </ExplorerTabPanel>
          </div>
        </>
      )}

      <SprintQuizDialog sprint={quizSprint} onClose={() => setQuizSprint(null)} onPassed={load} />
    </PageShell>
  );
}
