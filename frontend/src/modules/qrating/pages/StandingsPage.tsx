import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';
import { AccentButton, ExplorerPanel, PageHero, PageShell, tone } from '@/components/explorer';
import { getRound, getRoundTasks, getStandings } from '@/api/qrating';
import { LiveStandings } from '../components/LiveStandings';

export default function StandingsPage() {
  const { roundId = '' } = useParams();
  const navigate = useNavigate();
  const { theme } = useTheme();

  const roundQuery = useQuery({
    queryKey: ['qrating', 'round', roundId],
    queryFn: () => getRound(roundId),
  });
  // Reading standings after the clock runs out is what settles the round, so
  // this page is also the thing that publishes everyone's rating change.
  const standingsQuery = useQuery({
    queryKey: ['qrating', 'round', roundId, 'standings'],
    queryFn: () => getStandings(roundId),
  });
  const tasksQuery = useQuery({
    queryKey: ['qrating', 'round', roundId, 'tasks'],
    queryFn: () => getRoundTasks(roundId),
    enabled: roundQuery.data?.phase !== 'scheduled',
  });

  if (standingsQuery.isLoading || roundQuery.isLoading) {
    return (
      <PageShell>
        <div className={cn('h-12 w-72 rounded animate-pulse', tone.skeleton(theme))} />
        <p className={cn('text-sm', tone.secondary(theme))}>Settling the round...</p>
        <div className={cn('h-80 w-full rounded-[2rem] animate-pulse', tone.skeleton(theme))} />
      </PageShell>
    );
  }

  const phase = standingsQuery.data?.meta?.phase;
  const yourRow = standingsQuery.data?.meta?.your_row;

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
        title={roundQuery.data?.title ?? 'Standings'}
        subtitle={`${phase === 'finalized' ? 'Final standings' : 'Live standings'} · ${
          standingsQuery.data?.meta?.total ?? 0
        } participants`}
        action={
          yourRow && (
            <ExplorerPanel className="px-6 py-4 text-right">
              <p className={cn('text-xs uppercase tracking-widest', tone.muted(theme))}>
                You finished
              </p>
              <p className="mt-1 font-mono text-3xl font-medium tabular-nums">#{yourRow.rank}</p>
              {yourRow.rating_delta !== undefined && (
                <p
                  className={cn(
                    'font-mono text-sm',
                    yourRow.rating_delta >= 0 ? 'text-emerald-500' : 'text-red-500',
                  )}
                >
                  {yourRow.rating_delta >= 0 ? '+' : ''}
                  {yourRow.rating_delta} &rarr; {yourRow.new_rating}
                </p>
              )}
            </ExplorerPanel>
          )
        }
      />

      <LiveStandings
        rows={standingsQuery.data?.data ?? []}
        tasks={tasksQuery.data ?? []}
        finalized={phase === 'finalized'}
      />

      <AccentButton variant="outline" onClick={() => navigate(`/qrating/rounds/${roundId}`)}>
        Open the tasks (unrated practice)
      </AccentButton>
    </PageShell>
  );
}
