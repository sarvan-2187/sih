import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { startAssessment, submitAssessment } from '../api';
import type { AssessmentQuestion, AssessmentSubmitResponse } from '../types/analytics.types';
import { useTheme } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';
import { PageShell } from '@/components/explorer';
import { motion } from 'framer-motion';
import { FaCheckCircle, FaTimes, FaArrowRight, FaAtom } from 'react-icons/fa';
import { toast } from 'sonner';

export const AssessmentPage: React.FC = () => {
  const { type = 'pre' } = useParams<{ type: 'pre' | 'post' }>();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [searchParams] = useSearchParams();
  const topicSlug = searchParams.get('topic_slug');

  const [loading, setLoading] = useState(true);
  const [assessmentId, setAssessmentId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<AssessmentQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<AssessmentSubmitResponse | null>(null);

  useEffect(() => {
    async function initSession() {
      try {
        setLoading(true);
        const res = await startAssessment(type.toLowerCase() as 'pre' | 'post', 10, undefined, topicSlug || undefined);
        setAssessmentId(res.data.assessment_id);
        setQuestions(res.data.questions || []);
      } catch (err: any) {
        toast.error('Failed to initialize assessment session.');
      } finally {
        setLoading(false);
      }
    }
    initSession();
  }, [type]);

  const currentQuestion = questions[currentIndex];

  const handleSelectOption = (optionVal: any) => {
    if (!currentQuestion) return;
    setUserAnswers((prev) => ({
      ...prev,
      [currentQuestion._id]: optionVal
    }));
  };

  const handleSubmitAssessment = async () => {
    if (!assessmentId || submitting) return;

    const formattedAnswers = questions.map((q) => ({
      question_id: q._id,
      selected: userAnswers[q._id] !== undefined ? userAnswers[q._id] : null,
      time_taken_s: 15
    }));

    try {
      setSubmitting(true);
      const res = await submitAssessment(assessmentId, formattedAnswers);
      setResult(res.data);
      toast.success(`${type.toUpperCase()} Assessment completed successfully!`);
    } catch (err: any) {
      toast.error('Failed to submit assessment answers.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <PageShell width="reading">
        <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className={cn("text-sm", theme === 'dark' ? "text-zinc-400" : "text-zinc-600")}>
            Generating your {type.toUpperCase()} assessment...
          </p>
        </div>
      </PageShell>
    );
  }

  if (result) {
    return (
      <PageShell width="reading">
        <div className="flex flex-col gap-8 text-center">
          <motion.div
            className={cn(
              "p-8 sm:p-12 rounded-[2rem] border overflow-hidden shadow-md transition-all duration-300 font-sans space-y-6",
              theme === 'dark' ? "bg-zinc-950/50 border-white/10" : "bg-white border-zinc-200"
            )}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <div className="w-20 h-20 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-4xl flex items-center justify-center mx-auto shadow-sm">
              <FaCheckCircle />
            </div>

            <div>
              <span className="text-xs font-mono uppercase tracking-widest text-emerald-500 font-bold">
                {result.type.toUpperCase()} ASSESSMENT COMPLETE
              </span>
              <h1 className="text-4xl font-sans tracking-tight mt-2">
                Your Score: {result.score_pct}%
              </h1>
              <p className={cn("text-sm font-sans mt-2 max-w-md mx-auto", theme === 'dark' ? "text-zinc-400" : "text-zinc-600")}>
                You answered {result.total_correct} out of {result.total_questions} questions correctly. Total XP awarded: <strong>+{result.xp_earned} XP</strong>
              </p>
            </div>

            {/* Answer breakdown */}
            <div className="space-y-3 text-left pt-4">
              <h3 className={cn("text-xs font-mono font-semibold uppercase tracking-wider", theme === 'dark' ? "text-zinc-500" : "text-zinc-400")}>
                Question Breakdown & Explanations
              </h3>
              <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                {result.graded_answers.map((ga, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "p-4 rounded-xl border font-sans text-xs space-y-1",
                      ga.correct
                        ? theme === 'dark' ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-emerald-50 border-emerald-200 text-emerald-800"
                        : theme === 'dark' ? "bg-red-500/10 border-red-500/30 text-red-400" : "bg-red-50 border-red-200 text-red-800"
                    )}
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span>Q{idx + 1}. Concept: {ga.concept.replace(/_/g, ' ')}</span>
                      <span>{ga.correct ? '✓ Correct (+XP)' : '✗ Incorrect'}</span>
                    </div>
                    {ga.explanation && (
                      <p className={cn("text-[11px] leading-relaxed pt-1", theme === 'dark' ? "text-zinc-300" : "text-zinc-700")}>
                        {ga.explanation}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-center gap-4 pt-4">
              <button
                onClick={() => navigate('/profile?tab=progress')}
                className="px-6 py-2.5 bg-emerald-500 text-white rounded-lg shadow hover:bg-emerald-600 font-medium text-xs transition-colors flex items-center gap-2"
              >
                View Analytics Dashboard <FaArrowRight className="text-xs" />
              </button>
            </div>
          </motion.div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell width="reading">
      <div className="flex flex-col gap-8">
        {/* Header bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-2xl border flex items-center justify-center text-emerald-500 text-lg",
              theme === 'dark' ? "bg-black border-white/10" : "bg-zinc-50 border-zinc-200"
            )}>
              <FaAtom />
            </div>
            <div>
              <span className="text-[10px] font-mono text-emerald-500 uppercase font-bold tracking-wider">
                {type.toUpperCase()} ASSESSMENT SESSION {topicSlug && `- ${topicSlug.replace(/-/g, ' ')}`}
              </span>
              <h2 className="text-xl font-sans tracking-tight">Quantum Concept Mastery Test</h2>
            </div>
          </div>

          <button
            onClick={() => navigate('/profile?tab=progress')}
            className={cn("p-2 rounded-full border transition-colors", theme === 'dark' ? "bg-black border-white/10 text-zinc-400 hover:text-white" : "bg-zinc-100 border-zinc-200 text-zinc-600 hover:text-zinc-900")}
          >
            <FaTimes className="text-sm" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className={theme === 'dark' ? "text-zinc-400" : "text-zinc-600"}>
              Question {currentIndex + 1} of {questions.length}
            </span>
            <span className="text-emerald-500 font-bold">
              {questions.length > 0 ? Math.round(((currentIndex + 1) / questions.length) * 100) : 0}% Complete
            </span>
          </div>
          <div className={cn("w-full rounded-full h-2 overflow-hidden", theme === 'dark' ? "bg-black" : "bg-zinc-100")}>
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-300"
              style={{ width: questions.length > 0 ? `${((currentIndex + 1) / questions.length) * 100}%` : '0%' }}
            />
          </div>
        </div>

        {/* Question Container Card §1.4 */}
        {currentQuestion && (
          <motion.div
            key={currentQuestion._id}
            className={cn(
              "p-8 rounded-[2rem] border overflow-hidden shadow-sm transition-all duration-300 font-sans space-y-6",
              theme === 'dark' ? "bg-zinc-950/50 border-white/10" : "bg-white border-zinc-200"
            )}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="space-y-2">
              <span className="text-[10px] font-mono text-emerald-500 uppercase font-semibold">
                Topic: {(currentQuestion.topic_slug || 'quantum').replace(/_/g, ' ')}
              </span>
              <h3 className="text-xl font-sans leading-snug tracking-tight">
                {currentQuestion.prompt}
              </h3>
            </div>

            {/* Options */}
            {currentQuestion.options && currentQuestion.options.length > 0 && (
              <div className="space-y-3">
                {currentQuestion.options.map((opt) => {
                  const isSelected = userAnswers[currentQuestion._id] === opt.id;
                  return (
                    <div
                      key={opt.id}
                      onClick={() => handleSelectOption(opt.id)}
                      className={cn(
                        "p-4 rounded-2xl border flex items-center justify-between cursor-pointer transition-all font-sans text-sm",
                        isSelected
                          ? "bg-emerald-500/10 border-emerald-500 text-emerald-500 font-semibold shadow-sm"
                          : theme === 'dark'
                            ? "bg-black/60 border-white/10 hover:border-white/20 text-zinc-300"
                            : "bg-zinc-50 border-zinc-200 hover:border-zinc-300 text-zinc-800"
                      )}
                    >
                      <span>{opt.text}</span>
                      <div className={cn(
                        "w-5 h-5 rounded-full border flex items-center justify-center text-xs",
                        isSelected ? "border-emerald-500 bg-emerald-500 text-white" : theme === 'dark' ? "border-white/20" : "border-zinc-300"
                      )}>
                        {isSelected && '✓'}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Navigation Buttons */}
            <div className={cn("pt-4 border-t flex items-center justify-between", theme === 'dark' ? "border-white/10" : "border-zinc-200")}>
              <button
                onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                disabled={currentIndex === 0}
                className={cn(
                  "px-4 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-30",
                  theme === 'dark' ? "bg-white/10 text-zinc-300 hover:text-white" : "bg-zinc-100 text-zinc-700 hover:text-zinc-900"
                )}
              >
                Previous
              </button>

              {currentIndex < questions.length - 1 ? (
                <button
                  onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                  className="px-6 py-2 bg-emerald-500 text-white rounded-lg shadow hover:bg-emerald-600 font-medium text-xs transition-colors flex items-center gap-1.5"
                >
                  Next Question <FaArrowRight className="text-xs" />
                </button>
              ) : (
                <button
                  onClick={handleSubmitAssessment}
                  disabled={submitting}
                  className="px-6 py-2 bg-emerald-500 text-white rounded-lg shadow hover:bg-emerald-600 font-medium text-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  {submitting ? 'Grading Answers...' : 'Submit Assessment'}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </PageShell>
  );
};
