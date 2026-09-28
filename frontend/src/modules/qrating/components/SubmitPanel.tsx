import Editor from '@monaco-editor/react';
import { useTheme } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';
import { AccentButton, tone } from '@/components/explorer';
import type { RoundTask, SubmissionResult, Verdict } from '@/api/qrating';
import { HardwareVerifyButton } from './HardwareVerifyButton';

const VERDICT_STYLES: Record<Verdict | 'rate_limited', { label: string; className: string }> = {
  accepted: {
    label: 'Accepted',
    className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500',
  },
  wrong_answer: { label: 'Wrong answer', className: 'border-red-500/20 bg-red-100/10 text-red-500' },
  constraint_violated: {
    label: 'Over budget',
    className: 'border-amber-500/30 bg-amber-500/10 text-amber-500',
  },
  runtime_error: {
    label: 'Runtime error',
    className: 'border-red-500/20 bg-red-100/10 text-red-500',
  },
  timeout: { label: 'Timed out', className: 'border-amber-500/30 bg-amber-500/10 text-amber-500' },
  invalid_submission: {
    label: 'Invalid submission',
    className: 'border-red-500/20 bg-red-100/10 text-red-500',
  },
  rate_limited: {
    label: 'Too fast',
    className: 'border-zinc-500/20 bg-zinc-500/10 text-zinc-400',
  },
};

/** Circuit tasks are answered in OpenQASM, algorithmic tasks in Python. Both are
 *  text, so one editor serves both instead of two bespoke surfaces. */
const QASM_STARTER = (numQubits: number) =>
  `OPENQASM 2.0;\ninclude "qelib1.inc";\nqreg q[${numQubits}];\n\n// your circuit here\n`;

export const starterSource = (task: RoundTask) =>
  task.pillar === 'algorithmic'
    ? `def ${task.entry_point ?? 'solve'}():\n    pass\n`
    : QASM_STARTER(task.constraints.num_qubits ?? 2);

interface SubmitPanelProps {
  task: RoundTask;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  submitting: boolean;
  disabled?: boolean;
  disabledReason?: string;
  result?: SubmissionResult | null;
}

export function SubmitPanel({
  task,
  value,
  onChange,
  onSubmit,
  submitting,
  disabled,
  disabledReason,
  result,
}: SubmitPanelProps) {
  const { theme } = useTheme();
  const language = task.pillar === 'algorithmic' ? 'python' : 'plaintext';
  const verdict = result ? VERDICT_STYLES[result.verdict] : null;

  return (
    <div className="flex h-full flex-col gap-4">
      <div
        className={cn(
          'min-h-[280px] flex-1 overflow-hidden rounded-[1.5rem] border',
          tone.panel(theme),
        )}
      >
        <Editor
          height="100%"
          language={language}
          theme={theme === 'dark' ? 'vs-dark' : 'light'}
          value={value}
          onChange={(next) => onChange(next ?? '')}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            scrollBeyondLastLine: false,
            lineNumbers: 'on',
            automaticLayout: true,
            tabSize: 4,
            padding: { top: 16, bottom: 16 },
          }}
        />
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <AccentButton onClick={onSubmit} disabled={submitting || disabled}>
          {submitting ? 'Grading...' : 'Submit'}
        </AccentButton>
        <span className={cn('text-sm', tone.secondary(theme))}>
          {disabled
            ? disabledReason
            : task.pillar === 'algorithmic'
              ? `Python. Define ${task.entry_point}().`
              : 'OpenQASM 2.0.'}
        </span>
      </div>

      {result && verdict && (
        <div className={cn('rounded-2xl border p-4', verdict.className)}>
          <div className="flex items-center justify-between gap-3">
            <span className="font-medium">{verdict.label}</span>
            {result.verdict === 'accepted' && <span className="font-mono">+{result.score}</span>}
          </div>
          <p className="mt-1.5 text-sm opacity-90">{result.detail}</p>
          {(result.fidelity !== undefined || result.tests_passed !== undefined) && (
            <p className="mt-2 font-mono text-xs opacity-75">
              {result.tests_total !== undefined &&
                `tests ${result.tests_passed}/${result.tests_total}  `}
              {result.fidelity !== undefined && `fidelity ${result.fidelity}  `}
              {result.depth !== undefined && `depth ${result.depth}  `}
              {result.two_qubit_gates !== undefined && `2q ${result.two_qubit_gates}`}
            </p>
          )}
          {!result.is_rated && (
            <p className="mt-2 text-xs opacity-75">
              Unrated - this does not affect your Q-Rating.
            </p>
          )}
        </div>
      )}

      {/* Real silicon is offered only once the solution already passed, and only
          for the hardware pillar, where it actually means something. */}
      {result?.verdict === 'accepted' && task.pillar === 'hardware' && (
        <HardwareVerifyButton submissionId={result.submission_id} />
      )}
    </div>
  );
}
