import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { startQuizSession, submitQuizAttempt } from '../api';
import type { Question } from '../types/quiz.types';
import { QuestionRenderer } from '../components/QuestionRenderer';
import { QuizTimer } from '../components/QuizTimer';
import { QuizProgressDots } from '../components/QuizProgressDots';
import { FaAtom, FaArrowLeft, FaArrowRight, FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa';
import { toast } from 'sonner';
import { useTheme } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';
import { AccentButton, EmptyState, PageShell } from '@/components/explorer';
import { motion } from 'framer-motion';

export const QuizPage: React.FC = () => {
  const { topicSlug } = useParams<{ topicSlug: string }>();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const slug = topicSlug || 'introduction';

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answersMap, setAnswersMap] = useState<Record<number, any>>({});
  const [timeTakenMap, setTimeTakenMap] = useState<Record<number, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [isUntimed, setIsUntimed] = useState<boolean>(() => {
    return localStorage.getItem('qrious_quiz_untimed') === 'true';
  });

  const toggleUntimed = () => {
    setIsUntimed((prev) => {
      const next = !prev;
      localStorage.setItem('qrious_quiz_untimed', String(next));
      toast.info(next ? 'Untimed mode enabled — take all the time you need!' : 'Timed mode enabled.');
      return next;
    });
  };

  const questionStartTimeRef = useRef<number>(Date.now());

  const { data: quizData, isLoading, isError, error } = useQuery({
    queryKey: ['quiz-start', slug],
    queryFn: () => startQuizSession(slug),
  });

  const submitMutation = useMutation({
    mutationFn: submitQuizAttempt,
    onSuccess: (res) => {
      toast.success('Quiz submitted successfully!');
      navigate(`/quiz/review/${res.data.attempt_id}`);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Failed to submit quiz attempt.');
      setSubmitting(false);
    }
  });

  const questions: Question[] = quizData?.data?.questions || [];
  const currentQuestion = questions[currentIndex];

  useEffect(() => {
    questionStartTimeRef.current = Date.now();
  }, [currentIndex]);

  // Keyboard Navigation Hotkeys §7 (a11y)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      if (!currentQuestion) return;

      const opts = currentQuestion.options || [];
      const key = e.key.toLowerCase();

      if (['1', 'a'].includes(key) && opts[0]) handleSelectAnswer(opts[0].id || 0);
      else if (['2', 'b'].includes(key) && opts[1]) handleSelectAnswer(opts[1].id || 1);
      else if (['3', 'c'].includes(key) && opts[2]) handleSelectAnswer(opts[2].id || 2);
      else if (['4', 'd'].includes(key) && opts[3]) handleSelectAnswer(opts[3].id || 3);
      else if (e.key === 'ArrowLeft') handlePrev();
      else if (e.key === 'ArrowRight') handleNext();
      else if (e.key === 'Enter') {
        if (currentIndex === questions.length - 1) handleSubmit();
        else handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentQuestion, currentIndex, questions.length, answersMap, submitting]);

  const recordTimeForCurrent = () => {
    const elapsed = Math.round((Date.now() - questionStartTimeRef.current) / 1000);
    setTimeTakenMap((prev) => ({
      ...prev,
      [currentIndex]: (prev[currentIndex] || 0) + elapsed
    }));
  };

  const handleSelectAnswer = (val: any) => {
    setAnswersMap((prev) => ({
      ...prev,
      [currentIndex]: val
    }));
  };

  const handleNext = () => {
    recordTimeForCurrent();
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    recordTimeForCurrent();
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const handleSubmit = async () => {
    recordTimeForCurrent();
    setSubmitting(true);

    const formattedAnswers = questions.map((q, idx) => ({
      question_id: q._id,
      selected: answersMap[idx] !== undefined ? answersMap[idx] : null,
      time_taken_s: timeTakenMap[idx] || 5
    }));

    await submitMutation.mutateAsync({
      topic_slug: slug,
      answers: formattedAnswers,
      mode: 'practice'
    });
  };

  if (isLoading) {
    return (
      <PageShell width="reading">
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className={cn("text-sm", isDark ? "text-zinc-400" : "text-zinc-600")}>
            Initializing your quiz session...
          </p>
        </div>
      </PageShell>
    );
  }

  if (isError || questions.length === 0) {
    return (
      <PageShell width="reading">
        <EmptyState
          icon={<FaExclamationTriangle className="w-6 h-6 text-amber-500" />}
          title="Quiz not available"
          hint={(error as any)?.response?.data?.detail || 'No questions found for this topic.'}
          action={
            <AccentButton onClick={() => navigate('/roadmap')}>Return to Roadmap</AccentButton>
          }
        />
      </PageShell>
    );
  }

  const isLastQuestion = currentIndex === questions.length - 1;
  const answeredCount = Object.keys(answersMap).length;

  return (
    <PageShell width="reading" gap="tight" className="selection:bg-emerald-500 selection:text-white">
      {/* Background Ambient Glow */}
      <div className="fixed top-0 left-1/3 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="relative z-10 flex flex-col gap-6">
        {/* Header Bar */}
        <div className={cn(
          "flex items-center justify-between gap-4 p-4 sm:p-6 rounded-[2rem] border backdrop-blur-md shadow-lg",
          isDark ? "bg-black/60 border-white/10" : "bg-zinc-50 border-zinc-200"
        )}>
          <button
            onClick={() => navigate('/roadmap')}
            className={cn(
              "flex items-center gap-2 text-xs font-medium transition-colors px-3 py-1.5 rounded-xl border",
              isDark ? "bg-black border-white/10 text-zinc-400 hover:text-white" : "bg-white border-zinc-200 text-zinc-600 hover:text-zinc-900"
            )}
          >
            <FaArrowLeft className="text-[10px]" /> Exit Quiz
          </button>

          <div className="flex items-center gap-2.5 font-mono text-xs font-medium uppercase tracking-wider text-emerald-500">
            <FaAtom className="text-emerald-500 text-sm animate-spin-slow" />
            <span className="truncate max-w-[200px] sm:max-w-none">{slug.replace(/-/g, ' ')}</span>
          </div>

          {currentQuestion && (
            <QuizTimer
              key={currentIndex}
              totalSeconds={Math.max(180, (currentQuestion.time_limit_seconds || 60) * 3)}
              isPaused={submitting}
              isUntimed={isUntimed}
              onToggleUntimed={toggleUntimed}
              onTimeUp={() => {
                if (!submitting) {
                  toast.warning("Time limit reached! Take your time to complete your answer or click '+1m' for extra time.", {
                    duration: 5000
                  });
                }
              }}
            />
          )}
        </div>

        {/* Question Navigation Dots */}
        <div className={cn(
          "p-4 rounded-2xl border flex items-center justify-between gap-4 shadow-sm",
          isDark ? "bg-black/60 border-white/10" : "bg-zinc-50 border-zinc-200"
        )}>
          <QuizProgressDots
            total={questions.length}
            currentIndex={currentIndex}
            answersMap={answersMap}
            onSelectIndex={(idx) => {
              recordTimeForCurrent();
              setCurrentIndex(idx);
            }}
          />
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={toggleUntimed}
              className={cn(
                "px-2.5 py-1 rounded-lg border text-[11px] font-mono font-medium transition-all hover:scale-105",
                isUntimed
                  ? (isDark ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-emerald-50 border-emerald-200 text-emerald-700")
                  : (isDark ? "bg-zinc-900 border-white/10 text-zinc-400 hover:text-white" : "bg-zinc-100 border-zinc-200 text-zinc-600 hover:text-zinc-900")
              )}
            >
              {isUntimed ? "∞ Untimed" : "⏱ Timed"}
            </button>
            <div className="text-xs font-mono text-emerald-500 font-medium">
              {answeredCount}/{questions.length} Answered
            </div>
          </div>
        </div>

        {/* Active Question Card */}
        {currentQuestion && (
          <motion.div
            key={currentQuestion._id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className={cn(
              "rounded-[2rem] border p-6 sm:p-8 shadow-2xl font-sans relative overflow-hidden",
              isDark ? "bg-black/80 border-white/10 shadow-black/80" : "bg-zinc-50/80 border-zinc-200 shadow-zinc-200/60"
            )}
          >
            {/* Question Meta */}
            <div className="flex items-center justify-between gap-3 mb-5">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 font-mono text-[10px] font-medium uppercase tracking-wider">
                  {currentQuestion.difficulty || 'PRACTICE'}
                </span>
                <span className={cn(
                  "px-3 py-1 rounded-full border font-mono text-[10px] uppercase font-medium",
                  isDark ? "bg-black border-white/10 text-zinc-400" : "bg-white border-zinc-200 text-zinc-600"
                )}>
                  {currentQuestion.concept || 'Quantum Theory'}
                </span>
              </div>
              <span className="text-xs font-mono text-emerald-500 font-medium flex items-center gap-1">
                +{currentQuestion.xp_reward || 10} XP
              </span>
            </div>

            {/* Prompt */}
            <h3 className="text-xl sm:text-2xl font-sans text-left leading-relaxed font-normal mb-6">
              {currentQuestion.prompt}
            </h3>

            {/* Interactive Renderer */}
            <QuestionRenderer
              question={currentQuestion}
              selectedAnswer={answersMap[currentIndex]}
              onSelectAnswer={handleSelectAnswer}
              disabled={submitting}
            />
          </motion.div>
        )}

        {/* Footer Navigation Bar */}
        <div className="flex items-center justify-between gap-4 pt-2">
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0 || submitting}
            className={cn(
              "px-5 py-2.5 rounded-xl border font-sans text-xs font-medium flex items-center gap-2 transition-colors disabled:opacity-40",
              isDark ? "bg-black border-white/10 text-zinc-400 hover:text-white" : "bg-zinc-100 border-zinc-200 text-zinc-600 hover:text-zinc-900"
            )}
          >
            <FaArrowLeft className="text-[10px]" /> Previous
          </button>

          {!isLastQuestion ? (
            <button
              onClick={handleNext}
              disabled={submitting}
              className="px-6 py-2.5 bg-emerald-500 text-white rounded-xl shadow hover:bg-emerald-600 font-sans font-medium text-xs transition-colors flex items-center gap-2"
            >
              <span>Next Question</span>
              <FaArrowRight className="text-[10px]" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-7 py-2.5 bg-emerald-500 text-white rounded-xl shadow hover:bg-emerald-600 font-sans font-medium text-xs transition-all flex items-center gap-2 animate-pulse"
            >
              <FaCheckCircle className="text-xs" />
              <span>{submitting ? 'Submitting...' : 'Submit Quiz (+50 XP)'}</span>
            </button>
          )}
        </div>
      </div>
    </PageShell>
  );
};
