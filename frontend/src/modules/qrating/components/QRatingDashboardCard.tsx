import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FaBolt, FaMedal } from 'react-icons/fa';
import { useTheme } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';
import { AccentButton, ExplorerPanel, IconBadge, tone } from '@/components/explorer';
import { getMyRating, listRounds } from '@/api/qrating';
import { RoundCountdown, formatDuration, useCountdown } from './RoundCountdown';
import { TierBadge } from './TierBadge';

const secondsUntil = (iso: string) =>
  Math.max(0, Math.floor((new Date(iso).getTime() - Date.now()) / 1000));

/** Dashboard card: your rating, plus the countdown to the next round. The point
 *  is that a learner landing on the dashboard always knows when Sunday is. */
export function QRatingDashboardCard() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const ratingQuery = useQuery({ queryKey: ['qrating', 'me'], queryFn: getMyRating });
  const roundsQuery = useQuery({ queryKey: ['qrating', 'rounds'], queryFn: listRounds });

  const live = roundsQuery.data?.meta?.live_round ?? null;
  const next = roundsQuery.data?.meta?.next_round ?? null;
  const countdown = useCountdown(next ? secondsUntil(next.starts_at) : 0);
  const rating = ratingQuery.data?.data;

  return (
    <ExplorerPanel className="group">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <IconBadge size="sm">
            <FaMedal className="w-4 h-4" />
          </IconBadge>
          <h2 className="text-lg font-medium">Q-Rating</h2>
        </div>
        <button
          onClick={() => navigate('/qrating')}
          className={cn('text-sm transition-colors hover:text-emerald-500', tone.muted(theme))}
        >
          View &rarr;
        </button>
      </div>

      {rating && (
        <div className="mt-5 flex flex-wrap items-baseline gap-3">
          <span
            className="font-mono text-4xl font-bold tabular-nums"
            style={{ color: rating.colour }}
          >
            {rating.rating}
          </span>
          <TierBadge tier={rating.tier} colour={rating.colour} size="sm" />
          {ratingQuery.data?.meta?.unrated && (
            <span className={cn('text-sm', tone.secondary(theme))}>provisional</span>
          )}
        </div>
      )}

      {live ? (
        <div className="mt-5 flex flex-col gap-3">
          <p className="flex items-center gap-2.5 font-medium">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            {live.title} is live
          </p>
          <p className={cn('text-sm', tone.secondary(theme))}>
            {formatDuration(secondsUntil(live.ends_at))} left
          </p>
          <AccentButton
            className="w-full justify-center"
            onClick={() => navigate(`/qrating/rounds/${live.id}`)}
          >
            <FaBolt className="w-3.5 h-3.5" /> Enter the arena
          </AccentButton>
        </div>
      ) : next ? (
        <div className="mt-5 flex flex-col gap-4">
          <RoundCountdown
            seconds={countdown}
            label={`${next.title} starts in`}
            urgent={countdown < 3600}
          />
          <AccentButton
            variant="outline"
            className="w-full justify-center"
            onClick={() => navigate('/qrating')}
          >
            Register
          </AccentButton>
        </div>
      ) : (
        <p className={cn('mt-5 text-sm', tone.secondary(theme))}>
          No round scheduled. Practice tasks are open in the meantime.
        </p>
      )}
    </ExplorerPanel>
  );
}
