import { useTheme } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';
import { tone } from '@/components/explorer';
import type { Pillar, RoundTask } from '@/api/qrating';

const PILLAR_STYLES: Record<Pillar, { label: string; className: string }> = {
  simulation: { label: 'Simulation', className: 'bg-cyan-500/15 text-cyan-500 border-cyan-500/30' },
  algorithmic: {
    label: 'Algorithmic',
    className: 'bg-violet-500/15 text-violet-500 border-violet-500/30',
  },
  hardware: { label: 'Hardware', className: 'bg-amber-500/15 text-amber-500 border-amber-500/30' },
};

const CONSTRAINT_LABELS: Record<string, string> = {
  num_qubits: 'qubits',
  max_gates: 'max gates',
  max_depth: 'max depth',
  max_two_qubit_gates: 'max 2-qubit gates',
  min_fidelity: 'min fidelity',
  allowed_gates: 'allowed gates',
};

export function PillarTag({ pillar }: { pillar: Pillar }) {
  const style = PILLAR_STYLES[pillar];
  return (
    <span
      className={cn(
        'rounded-full border px-2.5 py-0.5 text-xs uppercase tracking-wider',
        style.className,
      )}
    >
      {style.label}
    </span>
  );
}

export function TaskStatement({ task }: { task: RoundTask }) {
  const { theme } = useTheme();
  const constraints = Object.entries(task.constraints ?? {});

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className={cn('font-mono text-sm', tone.muted(theme))}>{task.label}</span>
        <h2 className="text-2xl font-sans tracking-tight">{task.title}</h2>
        <PillarTag pillar={task.pillar} />
        <span className="ml-auto font-mono text-emerald-500">{task.points} pts</span>
      </div>

      {/* Statements are authored as plain text with hard wraps, so preserve them
          rather than pulling in a markdown renderer for a handful of tasks. */}
      <p className={cn('whitespace-pre-wrap leading-relaxed', tone.secondary(theme))}>
        {task.statement_md}
      </p>

      {constraints.length > 0 && (
        <dl
          className={cn(
            'flex flex-wrap gap-x-6 gap-y-2 rounded-2xl border px-4 py-3 text-sm',
            theme === 'dark' ? 'bg-black border-white/10' : 'bg-zinc-50 border-zinc-200',
          )}
        >
          {constraints.map(([key, value]) => (
            <div key={key} className="flex gap-2">
              <dt className={tone.muted(theme)}>{CONSTRAINT_LABELS[key] ?? key}</dt>
              <dd className="font-mono">{Array.isArray(value) ? value.join(', ') : String(value)}</dd>
            </div>
          ))}
        </dl>
      )}

      {task.examples?.length > 0 && (
        <div className="flex flex-col gap-3">
          {task.examples.map((example) => (
            <div
              key={example.label}
              className={cn('rounded-2xl border px-4 py-3', tone.panel(theme))}
            >
              <p className="text-sm font-medium">{example.label}</p>
              <p className={cn('mt-1 font-mono text-xs', tone.secondary(theme))}>
                {example.detail}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
