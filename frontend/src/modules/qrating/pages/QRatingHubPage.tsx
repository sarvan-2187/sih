import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FaBolt, FaTrophy, FaFlask, FaMedal } from 'react-icons/fa';
import { useTheme } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';
import {
  AccentButton,
  ExplorerPanel,
  IconBadge,
  PageHero,
  PageShell,
  SectionHeading,
  tone,
} from '@/components/explorer';
import { getLeaderboard, getMyRating, listRounds, registerForRound } from '@/api/qrating';
import { RatingCard } from '../components/RatingCard';
import { RatingGraph } from '../components/RatingGraph';
import { RoundCountdown, formatDuration, useCountdown } from '../components/RoundCountdown';
import { TierBadge } from '../components/TierBadge';

const secondsUntil = (iso: string) =>
  Math.max(0, Math.floor((new Date(iso).getTime() - Date.now()) / 1000));

export default function QRatingHubPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { theme } = useTheme();

  const ratingQuery = useQuery({ queryKey: ['qrating', 'me'], queryFn: getMyRating });
  const roundsQuery = useQuery({ queryKey: ['qrating', 'rounds'], queryFn: listRounds });
  const leaderboardQuery = useQuery({
    queryKey: ['qrating', 'leaderboard'],
    queryFn: () => getLeaderboard(10),
  });

  const liveRound = roundsQuery.data?.meta?.live_round ?? null;
  const nextRound = roundsQuery.data?.meta?.next_round ?? null;
  const countdown = useCountdown(nextRound ? secondsUntil(nextRound.starts_at) : 0);

  const register = useMutation({
    mutationFn: registerForRound,
    onSuccess: (result) => {
      toast.success(
        result.newly_registered ? 'You are in. See you at the start.' : 'Already registered.',
      );
      queryClient.invalidateQueries({ queryKey: ['qrating', 'rounds'] });
    },
    onError: () => toast.error('Could not register for that round.'),
  });

  const pastRounds = (roundsQuery.data?.data ?? []).filter((round) => round.phase === 'finalized');

  return (
    <PageShell>
      <PageHero
        title="Q-Rating"
        subtitle="One comparable number for quantum skill, earned in weekly timed rounds across simulation, algorithmic and hardware-aware tasks."
        action={
          <AccentButton variant="outline" onClick={() => navigate('/qrating/practice')}>
            <FaFlask className="w-3.5 h-3.5" /> Practice archive
          </AccentButton>
        }
      />

      {liveRound && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-[1.5rem] border border-emerald-500/40 bg-emerald-500/5 p-6">
          <div className="flex items-center gap-4">
            <span className="flex h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-500" />
            <div>
              <p className="text-lg font-medium">{liveRound.title} is live right now</p>
              <p className={cn('text-sm', tone.secondary(theme))}>
                {formatDuration(secondsUntil(liveRound.ends_at))} remaining &middot;{' '}
                {liveRound.task_count} tasks
              </p>
            </div>
          </div>
          <AccentButton onClick={() => navigate(`/qrating/rounds/${liveRound.id}`)}>
            <FaBolt className="w-3.5 h-3.5" /> Enter the arena
          </AccentButton>
        </div>
      )}

      <div className="grid gap-12 lg:grid-cols-3">
        <div className="flex flex-col gap-12 lg:col-span-2">
          {ratingQuery.data && (
            <RatingCard rating={ratingQuery.data.data} unrated={!!ratingQuery.data.meta?.unrated} />
          )}

          <div className="flex flex-col gap-6">
            <SectionHeading>Rating history</SectionHeading>
            <RatingGraph
              history={ratingQuery.data?.data.history ?? []}
              ladder={ratingQuery.data?.meta?.ladder ?? []}
            />
          </div>

          {pastRounds.length > 0 && (
            <div className="flex flex-col gap-6">
              <SectionHeading>Past rounds</SectionHeading>
              <div className="flex flex-col">
                {pastRounds.map((round) => (
                  <button
                    key={round.id}
                    onClick={() => navigate(`/qrating/rounds/${round.id}/standings`)}
                    className={cn(
                      'flex items-center justify-between gap-4 border-b py-4 text-left transition-colors last:border-0',
                      theme === 'dark'
                        ? 'border-white/10 hover:text-emerald-500'
                        : 'border-zinc-200 hover:text-emerald-600',
                    )}
                  >
                    <div>
                      <p className="font-medium">{round.title}</p>
                      <p className={cn('text-sm', tone.secondary(theme))}>
                        {new Date(round.starts_at).toLocaleDateString()} &middot; {round.task_count}{' '}
                        tasks
                      </p>
                    </div>
                    <span className="text-sm text-emerald-500">Standings &rarr;</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <aside className="flex flex-col gap-8">
          <ExplorerPanel>
            <div className="flex items-center gap-3">
              <IconBadge size="sm">
                <FaMedal className="w-4 h-4" />
              </IconBadge>
              <h2 className="text-lg font-medium">Next round</h2>
            </div>
            {nextRound ? (
              <div className="mt-5 flex flex-col gap-4">
                <p className="font-medium">{nextRound.title}</p>
                <RoundCountdown seconds={countdown} label="Starts in" urgent={countdown < 3600} />
                <p className={cn('text-sm', tone.secondary(theme))}>
                  {new Date(nextRound.starts_at).toLocaleString()} &middot;{' '}
                  {nextRound.duration_minutes} minutes &middot; {nextRound.task_count} tasks
                </p>
                <AccentButton
                  className="w-full justify-center"
                  disabled={register.isPending}
                  onClick={() => register.mutate(nextRound.id)}
                >
                  Register
                </AccentButton>
              </div>
            ) : (
              <p className={cn('mt-4 text-sm', tone.secondary(theme))}>
                No round scheduled yet. Practice tasks stay open in the meantime.
              </p>
            )}
          </ExplorerPanel>

          <ExplorerPanel>
            <div className="flex items-center gap-3">
              <IconBadge size="sm">
                <FaTrophy className="w-4 h-4" />
              </IconBadge>
              <h2 className="text-lg font-medium">Top rated</h2>
            </div>
            {leaderboardQuery.data?.length ? (
              <ol className="mt-5 flex flex-col gap-3">
                {leaderboardQuery.data.map((row) => (
                  <li key={row.firebase_uid} className="flex items-center gap-2 text-sm">
                    <span className={cn('w-5 tabular-nums', tone.muted(theme))}>{row.rank}</span>
                    <span
                      className={cn('flex-1 truncate', row.is_you && 'font-medium text-emerald-500')}
                    >
                      {row.display_name}
                    </span>
                    <TierBadge tier={row.tier} colour={row.colour} size="sm" />
                    <span className="w-12 text-right font-mono tabular-nums">{row.rating}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className={cn('mt-4 text-sm', tone.secondary(theme))}>
                Nobody is rated yet. The first round decides the board.
              </p>
            )}
          </ExplorerPanel>

          <ExplorerPanel>
            <h2 className="text-lg font-medium">The ladder</h2>
            <ul className="mt-4 flex flex-col gap-2">
              {(ratingQuery.data?.meta?.ladder ?? []).map((rung) => (
                <li key={rung.tier} className="flex items-center justify-between text-xs">
                  <TierBadge tier={rung.tier} colour={rung.colour} size="sm" />
                  <span className={cn('font-mono', tone.secondary(theme))}>
                    {rung.from_rating}
                    {rung.to_rating === null ? '+' : `-${rung.to_rating}`}
                  </span>
                </li>
              ))}
            </ul>
          </ExplorerPanel>
        </aside>
      </div>
    </PageShell>
  );
}
