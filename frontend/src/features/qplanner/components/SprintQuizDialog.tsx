import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { useTheme } from '@/context/ThemeContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AccentButton, tone } from '@/components/explorer';
import { apiErrorMessage } from '@/api/verification';

import { fetchSprintQuiz, submitSprintQuiz } from '../api';
import type { PlanSprint, SprintQuizOutcome, SprintQuizPaper } from '../types/qplanner.types';

/**
 * The gate between sprints: pass and the next one unlocks. Questions arrive without their
 * correct answers and are graded server-side, same as any quiz.
 *
 * Radix Dialog is kept for its focus trap, Escape handling and aria wiring; only the surface
 * is restyled to the explorer tokens so the modal matches the page underneath it.
 */
export function SprintQuizDialog({
  sprint,
  onClose,
  onPassed,
}: {
  sprint: PlanSprint | null;
  onClose: () => void;
  onPassed: () => void;
}) {
  const { theme } = useTheme();
  const [paper, setPaper] = useState<SprintQuizPaper | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [outcome, setOutcome] = useState<SprintQuizOutcome | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!sprint) return;
    setPaper(null);
    setAnswers({});
    setOutcome(null);

    fetchSprintQuiz(sprint.index)
      .then((response) => setPaper(response.data))
      .catch((error) => {
        toast.error(apiErrorMessage(error, 'No quiz is available for this sprint yet'));
        onClose();
      });
  }, [sprint, onClose]);

  async function submit() {
    if (!sprint || !paper) return;
    setSubmitting(true);
    try {
      const response = await submitSprintQuiz(
        sprint.index,
        paper.questions.map((question) => ({
          question_id: question._id,
          selected: answers[question._id] ?? null,
        })),
      );
      setOutcome(response.data);
      if (response.data.passed) {
        toast.success(`Sprint cleared at ${Math.round(response.data.score_pct)}%`);
        onPassed();
      } else {
        toast.error(
          `${Math.round(response.data.score_pct)}% — you need ${response.data.pass_mark_pct}% to move on`,
        );
      }
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Could not submit the quiz'));
    } finally {
      setSubmitting(false);
    }
  }

  const answered = paper ? paper.questions.filter((question) => answers[question._id]).length : 0;

  return (
    <Dialog open={sprint !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn(
          'max-h-[85vh] max-w-2xl overflow-y-auto rounded-[2rem] border p-8 font-sans',
          // Opaque on purpose: tone.panel is 50% transparent in dark mode, which would
          // let the page show through the modal.
          theme === 'dark' ? 'border-white/10 bg-zinc-950' : 'border-zinc-200 bg-white',
          tone.primary(theme),
        )}
      >
        <DialogHeader>
          <DialogTitle className="text-2xl font-sans font-normal tracking-tight">
            Sprint quiz — {sprint?.title}
          </DialogTitle>
          <DialogDescription className={tone.secondary(theme)}>
            {paper
              ? `${paper.total_questions} questions across this sprint's topics. ${paper.pass_mark_pct}% to pass.`
              : 'Loading questions…'}
          </DialogDescription>
        </DialogHeader>

        {!paper ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-emerald-500" aria-label="Loading quiz" />
          </div>
        ) : outcome ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <p
              className={cn(
                'font-mono text-5xl font-bold',
                outcome.passed ? 'text-emerald-500' : 'text-red-500',
              )}
            >
              {Math.round(outcome.score_pct)}%
            </p>
            <p className={cn('text-sm', outcome.passed ? 'text-emerald-500' : 'text-red-500')}>
              {outcome.passed
                ? 'Passed — the next sprint is unlocked.'
                : `You need ${outcome.pass_mark_pct}% to unlock the next sprint.`}
            </p>
            <p className={cn('font-mono text-sm', tone.secondary(theme))}>+{outcome.xp_earned} XP</p>
          </div>
        ) : (
          <ol className="flex flex-col gap-8">
            {paper.questions.map((question, position) => {
              const options = Array.isArray(question.options) ? question.options : [];
              return (
                <li key={question._id} className="flex flex-col gap-3">
                  <p className="text-sm font-medium leading-relaxed">
                    <span className={cn('mr-2 font-mono', tone.muted(theme))}>{position + 1}.</span>
                    {question.prompt}
                  </p>
                  <div className="flex flex-col gap-2">
                    {options.map((option) => {
                      // The grader compares option ids, so the id is what gets submitted.
                      const chosen = answers[question._id] === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          aria-pressed={chosen}
                          onClick={() =>
                            setAnswers((current) => ({ ...current, [question._id]: option.id }))
                          }
                          className={cn(
                            'rounded-xl border px-4 py-3 text-left text-sm transition-colors',
                            chosen
                              ? 'border-emerald-500 bg-emerald-500 text-white shadow'
                              : cn(
                                  theme === 'dark' ? 'border-white/10 bg-white/5' : 'border-zinc-200 bg-zinc-50',
                                  'hover:border-emerald-500/50',
                                ),
                          )}
                        >
                          {option.text}
                        </button>
                      );
                    })}
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        <DialogFooter>
          {outcome ? (
            <AccentButton onClick={onClose}>Done</AccentButton>
          ) : (
            <AccentButton onClick={submit} disabled={!paper || submitting || answered === 0}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              Submit {paper ? `(${answered}/${paper.total_questions})` : ''}
            </AccentButton>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
