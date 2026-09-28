import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import axios from 'axios';
import { FaBolt } from 'react-icons/fa';
import { useTheme } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';
import {
  AccentButton,
  EmptyState,
  ExplorerPanel,
  PageShell,
  tone,
} from '@/components/explorer';
import {
  getRound,
  getRoundTasks,
  getStandings,
  submitSolution,
  type RoundTask,
  type SubmissionResult,
} from '@/api/qrating';
import { LiveStandings } from '../components/LiveStandings';
import { RoundCountdown, useCountdown } from '../components/RoundCountdown';
import { SubmitPanel, starterSource } from '../components/SubmitPanel';
import { PillarTag, TaskStatement } from '../components/TaskStatement';

const STANDINGS_POLL_MS = 30_000;

export default function RoundArenaPage() {
  const { roundId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { theme } = useTheme();

  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  /** Drafts per task, so switching tabs never loses work mid-round. */
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Record<string, SubmissionResult>>({});

  const roundQuery = useQuery({
    queryKey: ['qrating', 'round', roundId],
    queryFn: () => getRound(roundId),
    refetchInterval: 60_000,
  });
  const round = roundQuery.data;
  const locked = round?.phase === 'scheduled';

  const tasksQuery = useQuery({
    queryKey: ['qrating', 'round', roundId, 'tasks'],
    queryFn: () => getRoundTasks(roundId),
    enabled: !!round && !locked,
  });

  const standingsQuery = useQuery({
    queryKey: ['qrating', 'round', roundId, 'standings'],
    queryFn: () => getStandings(roundId),
    enabled: !!round && !locked,
    refetchInterval: round?.phase === 'live' ? STANDINGS_POLL_MS : false,
  });

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

  const countdown = useCountdown(locked ? round?.seconds_until_start : round?.seconds_remaining);

  const submit = useMutation({
    mutationFn: (task: RoundTask) => {
      const source = drafts[task.slug] ?? '';
      return submitSolution({
        task_slug: task.slug,
        round_id: roundId,
        ...(task.pillar === 'algorithmic'
          ? { source_code: source }
          : { qasm: source, num_qubits: task.constraints.num_qubits }),
      });
    },
    onSuccess: (result, task) => {
      setResults((current) => ({ ...current, [task.slug]: result }));
      if (result.verdict === 'accepted') {
        toast.success(`${task.label} accepted. +${result.score} points.`);
        queryClient.invalidateQueries({ queryKey: ['qrating', 'round', roundId, 'standings'] });
      } else {
        toast.error(`${task.label}: ${result.detail}`);
      }
    },
    onError: (error) => {
      // 429 is the submission cooldown, and its message already says how long.
      const detail = axios.isAxiosError(error)
        ? (error.response?.data as { detail?: string } | undefined)?.detail
        : undefined;
      toast.error(detail ?? 'Could not submit. Try again.');
    },
  });

  if (roundQuery.isLoading) {
    return (
      <PageShell>
        <div className={cn('h-10 w-64 rounded animate-pulse', tone.skeleton(theme))} />
        <div className={cn('h-64 w-full rounded-[2rem] animate-pulse', tone.skeleton(theme))} />
      </PageShell>
    );
  }

  if (!round) {
    return (
      <PageShell>
        <EmptyState
          icon={<FaBolt className="w-6 h-6" />}
          title="That round could not be found"
          hint="It may have been removed, or the link is wrong."
          action={<AccentButton onClick={() => navigate('/qrating')}>Back to Q-Rating</AccentButton>}
        />
      </PageShell>
    );
  }

  if (locked) {
    return (
      <PageShell width="reading">
        <EmptyState
          icon={<FaBolt className="w-6 h-6" />}
          title={round.title}
          hint="The tasks unlock the moment the round starts. Nobody gets a head start."
          action={
            <div className="flex flex-col items-center gap-6">
              <RoundCountdown seconds={countdown} label="Starts in" urgent={countdown < 300} />
              <AccentButton variant="outline" onClick={() => navigate('/qrating')}>
                Back to Q-Rating
              </AccentButton>
            </div>
          }
        />
      </PageShell>
    );
  }

  const solvedSlugs = new Set(
    Object.entries(results)
      .filter(([, result]) => result.verdict === 'accepted')
      .map(([slug]) => slug),
  );
  const yourRow = standingsQuery.data?.meta?.your_row ?? null;
  const ended = round.phase !== 'live';
  const border = theme === 'dark' ? 'border-white/10' : 'border-zinc-200';

  return (
    <PageShell gap="tight">
      <div className={cn('flex flex-wrap items-end justify-between gap-6 border-b pb-6', border)}>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => navigate('/qrating')}
            className={cn('w-fit text-sm transition-colors hover:text-emerald-500', tone.muted(theme))}
          >
            &larr; Q-Rating
          </button>
          <h1 className="text-3xl md:text-4xl font-sans tracking-tight">{round.title}</h1>
        </div>
        <div className="flex items-end gap-8">
          <div>
            <p className={cn('text-xs uppercase tracking-widest', tone.muted(theme))}>Your score</p>
            <p className="mt-1 font-mono text-2xl font-medium tabular-nums text-emerald-500">
              {yourRow?.score ?? 0}
            </p>
          </div>
          {ended ? (
            <AccentButton
              variant="outline"
              onClick={() => navigate(`/qrating/rounds/${roundId}/standings`)}
            >
              Final standings
            </AccentButton>
          ) : (
            <RoundCountdown seconds={countdown} label="Time left" urgent={countdown < 600} />
          )}
        </div>
      </div>

      {ended && (
        <p className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-3 text-sm text-amber-500">
          This round has ended. You can still solve the tasks, but submissions are no longer rated.
        </p>
      )}

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-8">
          <div className={cn('flex flex-wrap gap-3 border-b pb-5', border)}>
            {tasks.map((task) => {
              const isActive = task.slug === activeTask?.slug;
              const isSolved = solvedSlugs.has(task.slug);
              return (
                <button
                  key={task.slug}
                  onClick={() => setActiveSlug(task.slug)}
                  className={cn(
                    'flex items-center gap-2.5 rounded-2xl border px-4 py-2.5 text-sm transition-all duration-300',
                    isActive
                      ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-500'
                      : cn(tone.panel(theme), tone.panelHover(theme)),
                    isSolved && !isActive && 'border-emerald-500/30',
                  )}
                >
                  <span className={cn('font-mono text-xs', !isActive && tone.muted(theme))}>
                    {task.label}
                  </span>
                  <span className="max-w-[10rem] truncate">{task.title}</span>
                  <span className="font-mono text-xs">{task.points}</span>
                  {isSolved && <span className="text-emerald-500">&#10003;</span>}
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

        <aside className="flex flex-col gap-6">
          <ExplorerPanel>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-medium">Standings</h2>
              {round.phase === 'live' && (
                <span
                  className={cn(
                    'flex items-center gap-2 text-xs uppercase tracking-wider',
                    tone.muted(theme),
                  )}
                >
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> live
                </span>
              )}
            </div>
            <div className="mt-3">
              <LiveStandings rows={standingsQuery.data?.data ?? []} compact />
            </div>
          </ExplorerPanel>

          <ExplorerPanel>
            <h2 className="text-lg font-medium">Scoring</h2>
            <ul className={cn('mt-3 flex flex-col gap-2 text-sm', tone.secondary(theme))}>
              <li>Points for each task solved.</li>
              <li>Ties broken on total time.</li>
              <li>Each wrong submission on a task you go on to solve adds 5 minutes.</li>
              <li>Wrong submissions on tasks you never solve cost nothing.</li>
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              <PillarTag pillar="simulation" />
              <PillarTag pillar="algorithmic" />
              <PillarTag pillar="hardware" />
            </div>
          </ExplorerPanel>
        </aside>
      </div>
    </PageShell>
  );
}
