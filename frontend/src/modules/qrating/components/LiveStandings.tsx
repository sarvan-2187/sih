import { useTheme } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';
import { tone } from '@/components/explorer';
import type { RoundTask, StandingsRow } from '@/api/qrating';

interface LiveStandingsProps {
  rows: StandingsRow[];
  tasks?: RoundTask[];
  finalized?: boolean;
  compact?: boolean;
}

const formatClock = (seconds: number | null) => {
  if (seconds === null) return '';
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

export function LiveStandings({ rows, tasks = [], finalized, compact }: LiveStandingsProps) {
  const { theme } = useTheme();
  const border = theme === 'dark' ? 'border-white/10' : 'border-zinc-200';

  if (rows.length === 0) {
    return (
      <p className={cn('py-10 text-center text-sm', tone.secondary(theme))}>
        No solves yet. First one on the board takes the lead.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-sm">
        <thead>
          <tr
            className={cn(
              'border-b text-left text-xs uppercase tracking-wider',
              border,
              tone.muted(theme),
            )}
          >
            <th className="w-10 py-3 pr-2 font-normal">#</th>
            <th className="py-3 pr-3 font-normal">Learner</th>
            <th className="py-3 pr-3 text-right font-normal">Score</th>
            {!compact && <th className="py-3 pr-3 text-right font-normal">Penalty</th>}
            {!compact &&
              tasks.map((task) => (
                <th key={task.slug} className="py-3 pr-3 text-center font-normal" title={task.title}>
                  {task.label}
                </th>
              ))}
            {finalized && <th className="py-3 text-right font-normal">Rating</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.firebase_uid}
              className={cn(
                'border-b transition-colors last:border-0',
                border,
                // Your own row stays findable in a long table.
                row.is_you && (theme === 'dark' ? 'bg-emerald-500/10' : 'bg-emerald-500/5'),
              )}
            >
              <td className={cn('py-3 pr-2 tabular-nums', tone.muted(theme))}>{row.rank}</td>
              <td className={cn('py-3 pr-3', row.is_you && 'font-medium text-emerald-500')}>
                {row.display_name}
                {row.is_you && (
                  <span className="ml-2 text-xs uppercase tracking-wider">you</span>
                )}
              </td>
              <td className="py-3 pr-3 text-right font-mono tabular-nums">{row.score}</td>
              {!compact && (
                <td className={cn('py-3 pr-3 text-right tabular-nums', tone.secondary(theme))}>
                  {Math.round(row.penalty_seconds / 60)}m
                </td>
              )}
              {!compact &&
                tasks.map((task, index) => {
                  const cell = row.per_task?.[index];
                  return (
                    <td key={task.slug} className="py-3 pr-3 text-center text-xs tabular-nums">
                      {cell?.solved ? (
                        <span className="text-emerald-500">
                          +{cell.points}
                          <span className={cn('block text-xs', tone.muted(theme))}>
                            {formatClock(cell.solved_at)}
                            {cell.wrong_attempts > 0 && ` (-${cell.wrong_attempts})`}
                          </span>
                        </span>
                      ) : cell?.wrong_attempts ? (
                        <span className="text-red-500/70">-{cell.wrong_attempts}</span>
                      ) : (
                        <span className={tone.muted(theme)}>&middot;</span>
                      )}
                    </td>
                  );
                })}
              {finalized && (
                <td className="py-3 text-right tabular-nums">
                  <span
                    className={cn(
                      'font-mono font-medium',
                      (row.rating_delta ?? 0) > 0 && 'text-emerald-500',
                      (row.rating_delta ?? 0) < 0 && 'text-red-500',
                    )}
                  >
                    {(row.rating_delta ?? 0) > 0 ? '+' : ''}
                    {row.rating_delta ?? 0}
                  </span>
                  <span className={cn('block font-mono text-xs', tone.muted(theme))}>
                    {row.new_rating}
                  </span>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
