import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTheme } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';
import { tone } from '@/components/explorer';
import type { LedgerEntry, LadderRung } from '@/api/qrating';

interface RatingGraphProps {
  history: LedgerEntry[];
  ladder?: LadderRung[];
  height?: number;
}

/** Rating over rounds, with the tier thresholds drawn in so progress is legible
 *  as "how far to the next tier", not just as a number going up. */
export function RatingGraph({ history, ladder = [], height = 260 }: RatingGraphProps) {
  const { theme } = useTheme();
  const axis = theme === 'dark' ? '#a1a1aa' : '#52525b';
  const grid = theme === 'dark' ? 'rgba(255,255,255,0.08)' : '#e4e4e7';

  if (history.length === 0) {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-[2rem] border border-dashed text-sm',
          theme === 'dark' ? 'border-white/10' : 'border-zinc-200',
          tone.secondary(theme),
        )}
        style={{ height }}
      >
        Compete in a round and your rating history appears here.
      </div>
    );
  }

  // Seed the line with the starting rating so a first round shows a slope, not a dot.
  const points = [
    { round: history[0].round_number - 1, rating: history[0].old_rating, delta: 0, rank: null as number | null },
    ...history.map((entry) => ({
      round: entry.round_number,
      rating: entry.new_rating,
      delta: entry.delta,
      rank: entry.rank,
    })),
  ];

  const ratings = points.map((point) => point.rating);
  const low = Math.min(...ratings) - 60;
  const high = Math.max(...ratings) + 60;
  const bands = ladder.filter((rung) => rung.from_rating > low && rung.from_rating < high);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={points} margin={{ top: 8, right: 12, bottom: 4, left: -16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
        <XAxis
          dataKey="round"
          tickFormatter={(value) => `R${value}`}
          tick={{ fontSize: 11, fill: axis }}
          stroke={grid}
        />
        <YAxis domain={[low, high]} tick={{ fontSize: 11, fill: axis }} width={52} stroke={grid} />
        {bands.map((rung) => (
          <ReferenceLine
            key={rung.tier}
            y={rung.from_rating}
            stroke={rung.colour}
            strokeDasharray="4 4"
            strokeOpacity={0.7}
            label={{ value: rung.tier, position: 'insideTopLeft', fontSize: 10, fill: rung.colour }}
          />
        ))}
        <Tooltip
          contentStyle={{
            fontSize: 12,
            borderRadius: 12,
            background: theme === 'dark' ? '#09090b' : '#ffffff',
            border: `1px solid ${grid}`,
            color: axis,
          }}
          formatter={(value) => [String(value), 'Rating']}
          labelFormatter={(value) => `Round ${value}`}
        />
        {/* Emerald is the fixed accent in both themes - see DESIGN_SYSTEM.md 1.3. */}
        <Line
          type="monotone"
          dataKey="rating"
          stroke="#10b981"
          strokeWidth={2.5}
          dot={{ r: 3, fill: '#10b981' }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
