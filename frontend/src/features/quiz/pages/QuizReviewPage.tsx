import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchQuizReview } from '../api';
import type { QuizReviewData } from '../types/quiz.types';
import { FaTrophy, FaCheckCircle, FaTimesCircle, FaRedo, FaArrowLeft, FaLightbulb, FaExclamationTriangle } from 'react-icons/fa';
import { useTheme } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';
import { AccentButton, EmptyState, PageShell } from '@/components/explorer';
import { motion } from 'framer-motion';

export const QuizReviewPage: React.FC = () => {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const { data: reviewResponse, isLoading, isError, error } = useQuery({
    queryKey: ['quiz-review', attemptId],
    queryFn: () => fetchQuizReview(attemptId || ''),
    enabled: Boolean(attemptId)
  });

  const reviewData: QuizReviewData | undefined = reviewResponse?.data;

  if (isLoading) {
    return (
      <PageShell width="reading">
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className={cn("text-sm", isDark ? "text-zinc-400" : "text-zinc-600")}>
            Loading your attempt...
          </p>
        </div>
      </PageShell>
    );
  }

  if (isError || !reviewData) {
    return (
      <PageShell width="reading">
        <EmptyState
          icon={<FaExclamationTriangle className="w-6 h-6 text-amber-500" />}
          title="Review unavailable"
          hint={(error as any)?.response?.data?.detail || 'Could not fetch quiz attempt review.'}
          action={
            <AccentButton onClick={() => navigate('/roadmap')}>Return to Roadmap</AccentButton>
          }
        />
      </PageShell>
    );
  }

  const { topic_slug, score, max_score, score_pct, xp_earned, review_items } = reviewData;
  const isPassed = score_pct >= 60;

  return (
    <PageShell width="reading" className="selection:bg-emerald-500 selection:text-white">
      {/* Glow Effects */}
      <div className="fixed top-0 right-1/4 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="relative z-10 flex flex-col gap-8">
        {/* Navigation & Header */}
        <div className="flex items-center justify-between gap-4">
          <button
            onClick={() => navigate('/roadmap')}
            className={cn(
              "flex items-center gap-2 text-xs font-medium px-4 py-2 rounded-xl border transition-colors",
              isDark ? "bg-black border-white/10 text-zinc-400 hover:text-white" : "bg-zinc-100 border-zinc-200 text-zinc-600 hover:text-zinc-900"
            )}
          >
            <FaArrowLeft className="text-[10px]" /> Return to Roadmap
          </button>
          <span className="font-mono text-xs text-emerald-500 uppercase tracking-wider font-medium">
            Attempt Review
          </span>
        </div>

        {/* Celebration Score Banner */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className={cn(
            "p-8 sm:p-10 rounded-[2rem] border text-center relative overflow-hidden shadow-2xl font-sans",
            isDark ? "bg-black/80 border-white/10 shadow-black/80" : "bg-zinc-50 border-zinc-200 shadow-zinc-200/60"
          )}
        >
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-2xl mb-4 shadow-sm">
            <FaTrophy />
          </div>

          <h1 className="text-3xl sm:text-4xl font-sans tracking-tight font-normal leading-snug mb-2">
            {isPassed ? 'Great Job! Quiz Completed' : 'Quiz Completed'}
          </h1>
          <p className={cn("text-sm max-w-md mx-auto mb-6", isDark ? "text-zinc-400" : "text-zinc-600")}>
            You scored <span className="font-mono font-bold text-emerald-500">{score} / {max_score}</span> points in {topic_slug.replace(/-/g, ' ')}.
          </p>

          {/* Stats Badges */}
          <div className="flex flex-wrap items-center justify-center gap-4 max-w-lg mx-auto">
            <div className={cn(
              "px-5 py-3 rounded-2xl border flex items-center gap-3 shadow-sm",
              isDark ? "bg-black border-white/10" : "bg-white border-zinc-200"
            )}>
              <span className={cn("text-xs font-mono uppercase", isDark ? "text-zinc-400" : "text-zinc-600")}>Score Percentage</span>
              <span className={cn("text-lg font-mono font-bold", isPassed ? "text-emerald-500" : "text-amber-500")}>
                {score_pct}%
              </span>
            </div>

            <div className="bg-emerald-500/10 border border-emerald-500/30 px-5 py-3 rounded-2xl flex items-center gap-3 shadow-sm">
              <span className="text-xs font-mono uppercase text-emerald-500 font-medium">XP Earned</span>
              <span className="text-lg font-mono font-bold text-emerald-500">
                +{xp_earned} XP
              </span>
            </div>
          </div>
        </motion.div>

        {/* Breakdown List */}
        <div className="space-y-4">
          <h2 className="text-lg font-sans font-normal tracking-tight flex items-center gap-2">
            <FaLightbulb className="text-emerald-500" />
            Detailed Question Breakdown
          </h2>

          <div className="space-y-4">
            {review_items.map((item, idx) => {
              const isCorrect = item.is_correct;
              return (
                <div
                  key={idx}
                  className={cn(
                    "p-6 rounded-2xl border transition-all shadow-sm font-sans",
                    isDark ? "bg-black/60 border-white/10" : "bg-zinc-50 border-zinc-200"
                  )}
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 font-mono text-xs font-medium flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span className={cn("text-xs font-mono uppercase font-medium", isCorrect ? "text-emerald-500" : "text-red-500")}>
                        {isCorrect ? 'Correct' : 'Incorrect'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs font-mono text-emerald-500 font-medium">
                      {isCorrect ? <FaCheckCircle className="text-emerald-500" /> : <FaTimesCircle className="text-red-500" />}
                      <span>+{item.xp_earned} XP</span>
                    </div>
                  </div>

                  <p className="text-base font-sans leading-relaxed mb-4 font-normal">
                    {item.prompt}
                  </p>

                  {/* Explanation */}
                  {item.explanation && (
                    <div className={cn(
                      "p-4 rounded-xl border text-xs leading-relaxed font-sans mt-3",
                      isDark ? "bg-black/80 border-white/10 text-zinc-300" : "bg-white border-zinc-200 text-zinc-700"
                    )}>
                      <span className="font-mono text-emerald-500 font-medium block mb-1">Explanation:</span>
                      {item.explanation}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-4 pt-4">
          <button
            onClick={() => navigate(`/quiz/${topic_slug}`)}
            className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 rounded-xl text-xs font-medium text-white transition-colors shadow flex items-center gap-2"
          >
            <FaRedo className="text-xs" /> Retake Quiz
          </button>
          <button
            onClick={() => navigate('/roadmap')}
            className={cn(
              "px-6 py-2.5 rounded-xl border text-xs font-medium transition-colors",
              isDark ? "bg-black border-white/10 text-zinc-400 hover:text-white" : "bg-zinc-100 border-zinc-200 text-zinc-600 hover:text-zinc-900"
            )}
          >
            Continue Learning
          </button>
        </div>
      </div>
    </PageShell>
  );
};
