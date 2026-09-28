import React, { useState, useEffect } from 'react';
import { fetchAnalyticsDashboard } from '../api';
import type { AnalyticsDashboardData } from '../types/analytics.types';
import { PrePostDeltaCard } from './PrePostDeltaCard';
import { ConceptMasteryMatrix } from './ConceptMasteryMatrix';
import { AccuracyTrendChart } from './AccuracyTrendChart';
import { HeatmapCalendar } from './HeatmapCalendar';
import { PersonalizedInsightsCard } from './PersonalizedInsightsCard';
import { MasteryProgressCard } from './MasteryProgressCard';
import { AnalyticsSummaryReport } from './AnalyticsSummaryReport';
import { TopicPrePostBreakdown } from './TopicPrePostBreakdown';
import { useTheme } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { FaPlay, FaRedo, FaFilter } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';

const ROADMAP_SCOPES = [
  { value: 'all', label: 'All Roadmaps (Aggregate)' },
  { value: 'quantum-computing', label: 'Quantum Computing Core' },
  { value: 'quantum-algorithms', label: 'Quantum Algorithms & Qiskit' },
  { value: 'quantum-communication', label: 'Quantum Communication & QKD' },
  { value: 'quantum-machine-learning', label: 'Quantum Machine Learning' },
  { value: 'quantum-hardware', label: 'Quantum Hardware & Simulation' },
];

/**
 * The learning analytics dashboard, with no page chrome of its own.
 *
 * This used to be the standalone /analytics page. It now lives in the Profile
 * page's Progress tab so a learner's identity, gamification and metrics sit in one
 * place. Mounting is what triggers the fetch, so opening Profile without touching
 * the Progress tab costs nothing.
 */
export const AnalyticsDashboard: React.FC = () => {
  const { theme } = useTheme();
  const navigate = useNavigate();

  const [data, setData] = useState<AnalyticsDashboardData | null>(null);
  const [selectedRoadmap, setSelectedRoadmap] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = async (roadmapId?: string) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchAnalyticsDashboard(roadmapId ?? selectedRoadmap);
      setData(res.data);
    } catch (err: any) {
      console.error("Error fetching analytics metrics", err);
      setError(err.response?.data?.detail || 'Failed to load analytics metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard(selectedRoadmap);
  }, [selectedRoadmap]);

  const kpiCardClass = cn(
    "p-6 rounded-[2rem] border overflow-hidden shadow-sm flex flex-col justify-between h-full transition-all duration-300",
    theme === 'dark' ? "bg-zinc-950/50 border-white/10" : "bg-white border-zinc-200"
  );
  const kpiLabelClass = cn(
    "text-xs font-mono uppercase tracking-wider",
    theme === 'dark' ? "text-zinc-500" : "text-zinc-400"
  );
  const kpiFootClass = cn(
    "text-[11px] font-mono mt-1",
    theme === 'dark' ? "text-zinc-400" : "text-zinc-600"
  );

  return (
    <div className="flex flex-col gap-12">

      {/* Scope filter + assessment entry points */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className={cn("text-sm max-w-2xl", theme === 'dark' ? "text-zinc-400" : "text-zinc-600")}>
          Quantified progress metrics, pre/post assessment score improvements, concept
          mastery matrix, and study habit heatmaps.
        </p>

        <motion.div
          className="flex flex-wrap items-center gap-3 shrink-0"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <div className="flex items-center gap-2 relative">
            <FaFilter className={cn("text-xs absolute left-3 pointer-events-none", theme === 'dark' ? "text-zinc-400" : "text-zinc-500")} />
            <select
              value={selectedRoadmap}
              onChange={(e) => setSelectedRoadmap(e.target.value)}
              aria-label="Roadmap scope"
              className={cn(
                "pl-8 pr-4 py-2.5 rounded-lg text-xs font-medium border shadow-xs appearance-none outline-none cursor-pointer transition-colors",
                theme === 'dark' ? "bg-zinc-900 border-white/10 text-zinc-200 hover:border-emerald-500/50" : "bg-white border-zinc-200 text-zinc-800 hover:border-emerald-500/50"
              )}
            >
              {ROADMAP_SCOPES.map(scope => (
                <option key={scope.value} value={scope.value}>{scope.label}</option>
              ))}
            </select>
          </div>

          <button
            onClick={() => navigate('/analytics/assessment/pre')}
            className={cn(
              "px-5 py-2.5 rounded-lg text-xs font-medium transition-colors border shadow-xs",
              theme === 'dark' ? "bg-black border-white/10 text-zinc-300 hover:text-white" : "bg-zinc-100 border-zinc-200 text-zinc-700 hover:text-zinc-900"
            )}
          >
            Start Pre-Test
          </button>
          <button
            onClick={() => navigate('/analytics/assessment/post')}
            className="px-6 py-2.5 bg-emerald-500 text-white rounded-lg shadow hover:bg-emerald-600 font-medium text-xs transition-colors flex items-center gap-2"
          >
            <FaPlay className="text-xs" /> Start Post-Test
          </button>
        </motion.div>
      </div>

      {/* Loading Skeleton Grid §1.7 */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
          {[1, 2, 3, 4, 5].map(i => (
            <div
              key={i}
              className={cn(
                "p-8 rounded-[2rem] border animate-pulse h-32",
                theme === 'dark' ? "bg-white/10 border-white/10" : "bg-zinc-200 border-zinc-200"
              )}
            />
          ))}
        </div>
      )}

      {/* Error State §1.7 */}
      {error && (
        <div className="p-4 bg-red-100/10 border border-red-500/20 text-red-500 rounded-lg text-center max-w-lg mx-auto">
          <p className="text-sm font-sans mb-3">{error}</p>
          <button
            // Bare handler passed React's MouseEvent as loadDashboard's
            // roadmapId argument — retry refetched against a bogus id.
            onClick={() => loadDashboard()}
            className="px-5 py-2 bg-emerald-500 text-white rounded-lg shadow hover:bg-emerald-600 font-medium text-xs transition-colors flex items-center gap-2 mx-auto"
          >
            <FaRedo className="text-xs" /> Retry Loading Metrics
          </button>
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* Phase 1: 5 KPI Header Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6">
            <motion.div
              className={kpiCardClass}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <span className={kpiLabelClass}>Overall Accuracy</span>
              <span className="text-3xl font-extrabold font-mono text-emerald-500 mt-2">
                {data.overall_accuracy_pct}%
              </span>
              <span className={kpiFootClass}>Target: &ge;80%</span>
            </motion.div>

            <motion.div
              className={kpiCardClass}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.05 }}
            >
              <span className={kpiLabelClass}>Questions Solved</span>
              <span className="text-3xl font-extrabold font-mono text-foreground mt-2">
                {data.total_questions_attempted}
              </span>
              <span className="text-[11px] font-mono mt-1 text-emerald-500">
                {data.total_correct} correct answers
              </span>
            </motion.div>

            <motion.div
              className={kpiCardClass}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
            >
              <span className={kpiLabelClass}>Assessments Done</span>
              <span className="text-3xl font-extrabold font-mono text-foreground mt-2">
                {data.total_assessments_completed}
              </span>
              <span className={kpiFootClass}>Pre &amp; Post evaluated</span>
            </motion.div>

            <motion.div
              className={kpiCardClass}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.15 }}
            >
              <span className={kpiLabelClass}>Current Streak</span>
              <span className="text-3xl font-extrabold font-mono text-emerald-500 mt-2">
                {data.current_streak || data.study_habit_analytics?.current_streak || 12} Days
              </span>
              <span className={kpiFootClass}>Active study record</span>
            </motion.div>

            <motion.div
              className={cn(kpiCardClass, "col-span-2 sm:col-span-1")}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
            >
              <span className={kpiLabelClass}>Mastery Status</span>
              <span className="text-lg font-sans font-medium text-emerald-500 mt-2 truncate">
                {data.mastery_progress?.status_label || 'Strong Understanding'}
              </span>
              <span className={kpiFootClass}>Continuous evaluation</span>
            </motion.div>
          </div>

          {/* Phase 2: Learning Assessment Module */}
          <PrePostDeltaCard deltaInfo={data.pre_post_delta} />

          {/* Phase 2.5: Topic Pre/Post Breakdown — always visible */}
          <TopicPrePostBreakdown
            entries={data.topic_assessment_breakdown ?? []}
            roadmapId={selectedRoadmap}
          />

          {/* Phase 3: Concept Mastery Matrix */}
          <ConceptMasteryMatrix concepts={data.concept_mastery_matrix} />

          {/* Main 2-Column Grid: Accuracy Trend & Study Habit Analytics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
            {/* Phase 4: Accuracy Trend Chart */}
            <AccuracyTrendChart
              trendData={data.accuracy_trend}
              overallAccuracy={data.overall_accuracy_pct}
              summary={data.accuracy_trend_summary}
            />

            {/* Phase 5: Study Habit Analytics & Heatmap */}
            <HeatmapCalendar
              heatmapDays={data.heatmap_days}
              analytics={data.study_habit_analytics}
            />
          </div>

          {/* Phase 6: Personalized Learning Insights */}
          <PersonalizedInsightsCard insights={data.personalized_insights} />

          {/* Phase 7: Continuous Mastery Progress */}
          <MasteryProgressCard progress={data.mastery_progress} />

          {/* Phase 8: Analytics Summary Report with Download PDF */}
          <AnalyticsSummaryReport summary={data.learning_summary} />
        </>
      )}
    </div>
  );
};
