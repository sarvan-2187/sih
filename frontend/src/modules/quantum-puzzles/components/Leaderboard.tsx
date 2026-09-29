import React, { useEffect, useState } from 'react';
import { FaTrophy } from 'react-icons/fa';

import { apiClient } from '@/lib/apiClient';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { ExplorerPanel, IconBadge, Pill, tone } from '@/components/explorer';

interface LeaderboardUser {
  rank: number;
  firebase_uid: string;
  display_name: string;
  xp_total: number;
  daily_solves_count: number;
  combined_score: number;
}

// Rows after the podium that are shown before "Show more", and how many each click adds.
const LIST_PAGE = 7;
const PODIUM_SIZE = 3;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? '' : '';
  return (first + last).toUpperCase();
}

function formatScore(score: number): string {
  return score.toLocaleString();
}

/**
 * Dashboard leaderboard. The endpoint returns every learner already ranked by score
 * (XP + 50 per daily puzzle solved), so the learner's own row can always be found and
 * pinned, and "points to the next rank" is a real gap, not an estimate.
 */
export const Leaderboard: React.FC = () => {
  const { theme } = useTheme();
  const { currentUser } = useAuth();
  // undefined = loading; null = hidden (educators have no ranking)
  const [users, setUsers] = useState<LeaderboardUser[] | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [listLimit, setListLimit] = useState(LIST_PAGE);

  useEffect(() => {
    let alive = true;
    apiClient
      .get<{ data: LeaderboardUser[]; meta?: { is_educator?: boolean } }>('/api/v1/learning/puzzles/leaderboard')
      .then((response) => {
        if (!alive) return;
        if (response.data?.meta?.is_educator) {
          setUsers(null);
          return;
        }
        setUsers(Array.isArray(response.data?.data) ? response.data.data : []);
      })
      .catch(() => {
        if (!alive) return;
        setError('Could not load the rankings. Refresh to try again.');
        setUsers([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (users === null) return null;

  const rule = theme === 'dark' ? 'border-white/10' : 'border-zinc-200';
  const podium = (users ?? []).slice(0, PODIUM_SIZE);
  const rest = (users ?? []).slice(PODIUM_SIZE);
  const shown = rest.slice(0, listLimit);
  const me = (users ?? []).find((user) => user.firebase_uid === currentUser?.uid);
  const meIsVisible = me !== undefined && me.rank <= PODIUM_SIZE + shown.length;
  const ahead = me && me.rank > 1 ? users?.[me.rank - 2] : undefined;
  const gap = me && ahead ? Math.max(1, ahead.combined_score - me.combined_score + 1) : 0;

  const header = (
    <div className="flex items-center gap-3">
      <IconBadge size="sm">
        <FaTrophy className="h-4 w-4" aria-hidden />
      </IconBadge>
      <div>
        <h2 className="text-lg font-medium">Leaderboard</h2>
        <p className={cn('text-xs', tone.muted(theme))}>Score is your XP plus 50 per daily puzzle solved.</p>
      </div>
    </div>
  );

  if (users === undefined || error || users.length === 0) {
    return (
      <ExplorerPanel className="flex flex-col gap-5">
        {header}
        {users === undefined ? (
          <div className={cn('h-40 animate-pulse rounded-xl', tone.skeleton(theme))} aria-label="Loading the leaderboard" />
        ) : error ? (
          <p className="text-sm text-red-500">{error}</p>
        ) : (
          <p className={cn('text-sm', tone.secondary(theme))}>
            No rankings yet. Solve today's puzzle to take the first spot.
          </p>
        )}
      </ExplorerPanel>
    );
  }

  // Wide layout: the podium and your standing on the left, the ranked list on the right.
  return (
    <ExplorerPanel className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div className="flex flex-col gap-6">
        {header}
        <Podium entries={podium} currentUid={currentUser?.uid} />
        {me && (
          <p className={cn('text-sm', tone.secondary(theme))}>
            {me.rank === 1
              ? "You're in first place."
              : `You're #${me.rank}. ${formatScore(gap)} pts to pass #${me.rank - 1}${ahead ? ` (${ahead.display_name})` : ''}.`}
          </p>
        )}
      </div>

      <div className={cn('flex flex-col gap-3 lg:border-l lg:pl-8', rule)}>
        {shown.length > 0 ? (
          <ol className={cn('flex flex-col divide-y', theme === 'dark' ? 'divide-white/10' : 'divide-zinc-200')}>
            {shown.map((user) => (
              <RankRow key={user.firebase_uid} user={user} isMe={user.firebase_uid === currentUser?.uid} />
            ))}
          </ol>
        ) : (
          <p className={cn('text-sm', tone.secondary(theme))}>Only the top three have scores so far.</p>
        )}

        {me && !meIsVisible && (
          <ol className={cn('border-t pt-1', rule)} aria-label="Your position">
            <RankRow user={me} isMe />
          </ol>
        )}

        {rest.length > listLimit && (
          <button
            type="button"
            onClick={() => setListLimit((limit) => limit + LIST_PAGE)}
            className={cn('self-start text-sm font-medium transition-colors hover:text-emerald-500', tone.secondary(theme))}
          >
            Show more
          </button>
        )}
      </div>
    </ExplorerPanel>
  );
};

/** Top three as a podium, ordered 2 · 1 · 3 like a real one; step height marks the place. */
function Podium({ entries, currentUid }: { entries: LeaderboardUser[]; currentUid?: string }) {
  const { theme } = useTheme();
  const order = [entries[1], entries[0], entries[2]].filter(Boolean) as LeaderboardUser[];
  const stepHeight: Record<number, string> = { 1: 'h-16', 2: 'h-11', 3: 'h-8' };

  return (
    <ol className="grid grid-cols-3 items-end gap-2" aria-label="Top three">
      {order.map((user) => {
        const isMe = user.firebase_uid === currentUid;
        const first = user.rank === 1;
        return (
          <li key={user.firebase_uid} className="flex min-w-0 flex-col items-center gap-1.5 text-center">
            <span
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-full border text-sm font-medium',
                first ? 'border-emerald-500 text-emerald-500' : tone.badge(theme),
                isMe && 'ring-2 ring-emerald-500 ring-offset-2',
                isMe && (theme === 'dark' ? 'ring-offset-zinc-950' : 'ring-offset-white'),
              )}
              aria-hidden
            >
              {initials(user.display_name)}
            </span>
            <span className="line-clamp-2 w-full text-xs font-medium leading-tight" title={user.display_name}>
              {user.display_name}
              {isMe && <span className="text-emerald-500"> (you)</span>}
            </span>
            <span className={cn('text-xs tabular-nums', tone.secondary(theme))}>
              {formatScore(user.combined_score)} pts
            </span>
            <span
              className={cn(
                'flex w-full items-start justify-center rounded-t-lg pt-1 text-sm font-semibold tabular-nums',
                stepHeight[user.rank],
                first
                  ? 'bg-emerald-500/15 text-emerald-500'
                  : theme === 'dark'
                    ? 'bg-white/5 text-zinc-400'
                    : 'bg-zinc-100 text-zinc-500',
              )}
              aria-label={`Rank ${user.rank}`}
            >
              {user.rank}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function RankRow({ user, isMe }: { user: LeaderboardUser; isMe: boolean }) {
  const { theme } = useTheme();
  return (
    <li className={cn('flex items-center gap-3 py-2.5', isMe && '-mx-2 rounded-lg bg-emerald-500/10 px-2')}>
      <span className={cn('w-8 shrink-0 text-sm tabular-nums', tone.muted(theme))}>#{user.rank}</span>
      <span
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-medium',
          tone.badge(theme),
        )}
        aria-hidden
      >
        {initials(user.display_name)}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm" title={user.display_name}>
        {user.display_name}
      </span>
      {isMe && <Pill variant="accent">You</Pill>}
      <span className="shrink-0 text-sm tabular-nums">{formatScore(user.combined_score)}</span>
    </li>
  );
}
