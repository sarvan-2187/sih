import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { apiErrorMessage } from '@/api/verification';

import { fetchSprintQuiz, submitSprintQuiz } from '../api';
import type { PlanSprint, SprintQuizOutcome, SprintQuizPaper } from '../types/qplanner.types';

/** The gate between sprints: pass and the next one unlocks. Questions arrive
 *  without their correct answers and are graded server-side, same as any quiz. */
export function SprintQuizDialog({
  sprint,
  onClose,
  onPassed,
}: {
  sprint: PlanSprint | null;
  onClose: () => void;
  onPassed: () => void;
}) {
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
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Sprint quiz — {sprint?.title}</DialogTitle>
          <DialogDescription>
            {paper
              ? `${paper.total_questions} questions across this sprint's topics. ${paper.pass_mark_pct}% to pass.`
              : 'Loading questions…'}
          </DialogDescription>
        </DialogHeader>

        {!paper ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-primary" aria-label="Loading quiz" />
          </div>
        ) : outcome ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <p className="text-3xl font-semibold">{Math.round(outcome.score_pct)}%</p>
            <p className={cn('text-sm', outcome.passed ? 'text-primary' : 'text-destructive')}>
              {outcome.passed
                ? 'Passed — the next sprint is unlocked.'
                : `You need ${outcome.pass_mark_pct}% to unlock the next sprint.`}
            </p>
            <p className="text-sm text-muted-foreground">+{outcome.xp_earned} XP</p>
          </div>
        ) : (
          <ol className="flex flex-col gap-6">
            {paper.questions.map((question, position) => {
              const options = Array.isArray(question.options) ? (question.options as string[]) : [];
              return (
                <li key={question._id} className="flex flex-col gap-2">
                  <p className="text-sm font-medium">
                    {position + 1}. {String(question.question ?? '')}
                  </p>
                  <div className="flex flex-col gap-2">
                    {options.map((option) => {
                      const chosen = answers[question._id] === option;
                      return (
                        <Button
                          key={option}
                          type="button"
                          variant={chosen ? 'default' : 'outline'}
                          className="h-auto justify-start whitespace-normal py-2 text-left"
                          aria-pressed={chosen}
                          onClick={() =>
                            setAnswers((current) => ({ ...current, [question._id]: option }))
                          }
                        >
                          {option}
                        </Button>
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
            <Button onClick={onClose}>Done</Button>
          ) : (
            <Button onClick={submit} disabled={!paper || submitting || answered === 0}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
              Submit {paper ? `(${answered}/${paper.total_questions})` : ''}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
