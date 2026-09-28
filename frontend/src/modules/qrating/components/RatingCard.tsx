import { motion } from 'framer-motion';
import { useTheme } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';
import { ExplorerPanel, tone } from '@/components/explorer';
import type { MyRating, Pillar } from '@/api/qrating';
import { TierBadge } from './TierBadge';

const PILLAR_LABELS: Record<Pillar, string> = {
  simulation: 'Simulation',
  algorithmic: 'Algorithmic',
  hardware: 'Hardware',
};

interface RatingCardProps {
  rating: MyRating;
  unrated: boolean;
}

/** The headline number. Shows the confidence band, and says plainly when the
 *  rating is still provisional - an unearned 1200 must not look like a result. */
export function RatingCard({ rating, unrated }: RatingCardProps) {
  const { theme } = useTheme();

  return (
    <ExplorerPanel className="p-8">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className={cn('text-xs uppercase tracking-widest', tone.muted(theme))}>
            Your Q-Rating
          </p>
          <div className="mt-2 flex items-baseline gap-3">
            <motion.span
              key={rating.rating}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="font-mono text-5xl md:text-6xl font-bold tabular-nums"
              style={{ color: rating.colour }}
            >
              {rating.rating}
            </motion.span>
            <span className={cn('font-mono text-sm', tone.secondary(theme))}>
              &plusmn;{Math.round(rating.rd)}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <TierBadge tier={rating.tier} colour={rating.colour} size="lg" />
            {unrated && (
              <span className={cn('text-sm', tone.secondary(theme))}>
                provisional &mdash; compete once to make it count
              </span>
            )}
          </div>
        </div>

        <dl className="grid grid-cols-3 gap-x-8 gap-y-1 text-right">
          <dt className={cn('text-xs uppercase tracking-wider', tone.muted(theme))}>Peak</dt>
          <dt className={cn('text-xs uppercase tracking-wider', tone.muted(theme))}>Rounds</dt>
          <dt className={cn('text-xs uppercase tracking-wider', tone.muted(theme))}>Streak</dt>
          <dd className="font-mono text-xl font-medium tabular-nums">{rating.peak_rating}</dd>
          <dd className="font-mono text-xl font-medium tabular-nums">{rating.rounds_played}</dd>
          <dd className="font-mono text-xl font-medium tabular-nums">
            {rating.contest_streak?.current ?? 0}
            <span className={cn('text-sm', tone.secondary(theme))}>w</span>
          </dd>
        </dl>
      </div>

      {rating.next_tier && (
        <div className="mt-8">
          <div className={cn('mb-2 flex justify-between text-sm', tone.secondary(theme))}>
            <span>{rating.tier}</span>
            <span>
              {rating.next_tier_at !== null && `${rating.next_tier_at - rating.rating} to `}
              {rating.next_tier}
            </span>
          </div>
          {/* Hand-rolled track: the shadcn Progress component carries the purple
              `primary` token used on admin surfaces, not the emerald accent. */}
          <div className={cn('h-2 w-full overflow-hidden rounded-full', tone.skeleton(theme))}>
            <motion.div
              className="h-full rounded-full bg-emerald-500"
              initial={{ width: 0 }}
              animate={{ width: `${rating.progress_pct}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          </div>
        </div>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {(Object.keys(PILLAR_LABELS) as Pillar[]).map((pillar) => {
          const value = rating.pillar_ratings?.[pillar];
          return (
            <div
              key={pillar}
              className={cn(
                'rounded-2xl border px-4 py-3',
                theme === 'dark' ? 'bg-black border-white/10' : 'bg-zinc-50 border-zinc-200',
              )}
            >
              <p className={cn('text-xs uppercase tracking-wider', tone.muted(theme))}>
                {PILLAR_LABELS[pillar]}
              </p>
              <p className="mt-1 font-mono text-xl font-medium tabular-nums">
                {value ?? (
                  <span className={cn('text-sm font-normal', tone.secondary(theme))}>not rated</span>
                )}
              </p>
            </div>
          );
        })}
      </div>
    </ExplorerPanel>
  );
}
