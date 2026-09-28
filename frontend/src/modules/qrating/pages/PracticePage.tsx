import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import axios from 'axios';
import { FaFlask } from 'react-icons/fa';
import { useTheme } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';
import { CardSkeletonGrid, EmptyState, PageHero, PageShell, tone } from '@/components/explorer';
import {
  getPracticeTasks,
  submitSolution,
  type RoundTask,
  type SubmissionResult,
} from '@/api/qrating';
import { SubmitPanel, starterSource } from '../components/SubmitPanel';
import { TaskStatement } from '../components/TaskStatement';

/** Practice is always unrated, on purpose: it keeps the contest rating scarce
 *  while making the task archive useful forever. */
export default function PracticePage() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Record<string, SubmissionResult>>({});

  const tasksQuery = useQuery({ queryKey: ['qrating', 'practice'], queryFn: getPracticeTasks });
  const tasks = tasksQuery.data ?? [];

  const activeTask: RoundTask | undefined = useMemo(
    () => tasks.find((task) => task.slug === activeSlug) ?? tasks[0],
    [tasks, activeSlug],
  );

  useEffect(() => {
    if (activeTask && !(activeTask.slug in drafts)) {
      setDrafts((current) => ({ ...current, [activeTask.slug]: starterSource(activeTask) }));
    }
  }, [activeTask, drafts]);

  const submit = useMutation({
    mutationFn: (task: RoundTask) => {
      const source = drafts[task.slug] ?? '';
      return submitSolution({
        task_slug: task.slug,
        ...(task.pillar === 'algorithmic'
          ? { source_code: source }
          : { qasm: source, num_qubits: task.constraints.num_qubits }),
      });
    },
    onSuccess: (result, task) => {
      setResults((current) => ({ ...current, [task.slug]: result }));
      if (result.verdict === 'accepted') toast.success(`${task.title} solved.`);
      else toast.error(result.detail);
    },
    onError: (error) => {
      const detail = axios.isAxiosError(error)
        ? (error.response?.data as { detail?: string } | undefined)?.detail
        : undefined;
      toast.error(detail ?? 'Could not submit. Try again.');
    },
  });

  const border = theme === 'dark' ? 'border-white/10' : 'border-zinc-200';

  return (
    <PageShell>
      <PageHero
        eyebrow={
          <button
            onClick={() => navigate('/qrating')}
            className={cn('w-fit text-sm transition-colors hover:text-emerald-500', tone.muted(theme))}
          >
            &larr; Q-Rating
          </button>
        }
        title="Practice archive"
        subtitle="Every task from past rounds, graded exactly as it was on the day. Nothing here moves your rating - only live rounds do that."
      />

      {tasksQuery.isLoading && <CardSkeletonGrid count={3} height={200} />}

      {!tasksQuery.isLoading && tasks.length === 0 && (
        <EmptyState
          icon={<FaFlask className="w-6 h-6" />}
          title="Nothing in the archive yet"
          hint="Tasks appear here once their round has finished."
        />
      )}

      {tasks.length > 0 && (
        <div className="flex flex-col gap-8">
          <div className={cn('flex flex-wrap gap-3 border-b pb-5', border)}>
            {tasks.map((task) => {
              const isActive = task.slug === activeTask?.slug;
              return (
                <button
                  key={task.slug}
                  onClick={() => setActiveSlug(task.slug)}
                  className={cn(
                    'flex items-center gap-2.5 rounded-2xl border px-4 py-2.5 text-sm transition-all duration-300',
                    isActive
                      ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-500'
                      : cn(tone.panel(theme), tone.panelHover(theme)),
                  )}
                >
                  <span className="max-w-[11rem] truncate">{task.title}</span>
                  {task.difficulty !== undefined && (
                    <span className={cn('font-mono text-xs', !isActive && tone.muted(theme))}>
                      {task.difficulty}
                    </span>
                  )}
                  {results[task.slug]?.verdict === 'accepted' && (
                    <span className="text-emerald-500">&#10003;</span>
                  )}
                </button>
              );
            })}
          </div>

          {activeTask && (
            <div className="grid gap-10 xl:grid-cols-2">
              <TaskStatement task={activeTask} />
              <SubmitPanel
                task={activeTask}
                value={drafts[activeTask.slug] ?? ''}
                onChange={(value) =>
                  setDrafts((current) => ({ ...current, [activeTask.slug]: value }))
                }
                onSubmit={() => submit.mutate(activeTask)}
                submitting={submit.isPending}
                result={results[activeTask.slug] ?? null}
              />
            </div>
          )}
        </div>
      )}
    </PageShell>
  );
}
