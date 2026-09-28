import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FaMedal } from 'react-icons/fa';
import { useTheme } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';
import {
  EmptyState,
  ExplorerPanel,
  PageShell,
  SectionHeading,
  tone,
} from '@/components/explorer';
import { getPublicProfile, type Pillar } from '@/api/qrating';
import { RatingGraph } from '../components/RatingGraph';
import { TierBadge } from '../components/TierBadge';

const PILLARS: Pillar[] = ['simulation', 'algorithmic', 'hardware'];

/** The verifiable page. No login required: anyone handed a handle can audit how
 *  every point of the rating was earned, round by round. */
export default function PublicQRatingPage() {
  const { handle = '' } = useParams();
  const { theme } = useTheme();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['qrating', 'public', handle],
    queryFn: () => getPublicProfile(handle),
    retry: false,
  });

  if (isLoading) {
    return (
      <PageShell width="narrow">
        <div className={cn('h-12 w-64 rounded animate-pulse', tone.skeleton(theme))} />
        <div className={cn('h-48 w-full rounded-[2rem] animate-pulse', tone.skeleton(theme))} />
      </PageShell>
    );
  }

  if (isError || !data) {
    return (
      <PageShell width="reading">
        <EmptyState
          icon={<FaMedal className="w-6 h-6" />}
          title={`No public Q-Rating for "${handle}"`}
          hint="Either the handle does not exist, or its owner has not made their rating public."
        />
      </PageShell>
    );
  }

  const border = theme === 'dark' ? 'border-white/10' : 'border-zinc-200';

  return (
    <PageShell width="narrow">
      <div className="flex flex-wrap items-start justify-between gap-8">
        <div className="flex flex-col gap-2">
          <p className={cn('text-xs uppercase tracking-widest', tone.muted(theme))}>
            Verified Q-Rating
          </p>
          <h1 className="text-4xl md:text-5xl font-sans tracking-tight">{data.display_name}</h1>
          <p className={cn('font-mono', tone.secondary(theme))}>@{data.handle}</p>
        </div>
        <div className="text-right">
          <p
            className="font-mono text-5xl md:text-6xl font-bold tabular-nums"
            style={{ color: data.colour }}
          >
            {data.rating}
          </p>
          <p className={cn('font-mono text-sm', tone.secondary(theme))}>
            &plusmn;{Math.round(data.rd)} confidence
          </p>
          <div className="mt-3 flex justify-end">
            <TierBadge tier={data.tier} colour={data.colour} size="lg" />
          </div>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <ExplorerPanel className="p-4">
          <dt className={cn('text-xs uppercase tracking-wider', tone.muted(theme))}>Peak</dt>
          <dd className="mt-1 font-mono text-xl font-medium tabular-nums">{data.peak_rating}</dd>
        </ExplorerPanel>
        <ExplorerPanel className="p-4">
          <dt className={cn('text-xs uppercase tracking-wider', tone.muted(theme))}>Rounds</dt>
          <dd className="mt-1 font-mono text-xl font-medium tabular-nums">{data.rounds_played}</dd>
        </ExplorerPanel>
        {PILLARS.map((pillar) => (
          <ExplorerPanel key={pillar} className="p-4">
            <dt className={cn('text-xs uppercase tracking-wider', tone.muted(theme))}>{pillar}</dt>
            <dd className="mt-1 font-mono text-xl font-medium tabular-nums">
              {data.pillar_ratings?.[pillar] ?? (
                <span className={cn('text-sm font-normal', tone.secondary(theme))}>&mdash;</span>
              )}
            </dd>
          </ExplorerPanel>
        ))}
      </dl>

      <div className="flex flex-col gap-6">
        <SectionHeading>Rating history</SectionHeading>
        <RatingGraph history={data.ledger} />
      </div>

      <div className="flex flex-col gap-4">
        <SectionHeading>Contest ledger</SectionHeading>
        <p className={cn('text-sm', tone.secondary(theme))}>
          Every rated round, as recorded at settlement. Each row adds up: previous rating plus the
          change equals the new rating.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr
                className={cn(
                  'border-b text-left text-xs uppercase tracking-wider',
                  border,
                  tone.muted(theme),
                )}
              >
                <th className="py-3 pr-3 font-normal">Round</th>
                <th className="py-3 pr-3 font-normal">Date</th>
                <th className="py-3 pr-3 text-right font-normal">Rank</th>
                <th className="py-3 pr-3 text-right font-normal">Score</th>
                <th className="py-3 pr-3 text-right font-normal">Rating</th>
                <th className="py-3 text-right font-normal">Change</th>
              </tr>
            </thead>
            <tbody>
              {data.ledger.map((entry) => (
                <tr key={entry.round_number} className={cn('border-b last:border-0', border)}>
                  <td className="py-3 pr-3 font-medium">Round {entry.round_number}</td>
                  <td className={cn('py-3 pr-3', tone.secondary(theme))}>
                    {new Date(entry.at).toLocaleDateString()}
                  </td>
                  <td className="py-3 pr-3 text-right tabular-nums">
                    {entry.rank}
                    <span className={tone.muted(theme)}>/{entry.participants}</span>
                  </td>
                  <td className="py-3 pr-3 text-right font-mono tabular-nums">{entry.score}</td>
                  <td className="py-3 pr-3 text-right font-mono tabular-nums">
                    {entry.old_rating} &rarr; {entry.new_rating}
                  </td>
                  <td
                    className={cn(
                      'py-3 text-right font-mono font-medium tabular-nums',
                      entry.delta >= 0 ? 'text-emerald-500' : 'text-red-500',
                    )}
                  >
                    {entry.delta >= 0 ? '+' : ''}
                    {entry.delta}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.ledger.length === 0 && (
          <p className={cn('text-sm', tone.secondary(theme))}>No rated rounds yet.</p>
        )}
      </div>
    </PageShell>
  );
}
