import { useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, SkipForward, RotateCcw, AlertTriangle, Target } from 'lucide-react';
import { usePomodoro } from '../features/focus/hooks/usePomodoro';
import { updateTopicProgress } from '../features/roadmap/api';
import { CircularProgress, formatTime } from '../features/focus/components/PomodoroFAB';
import { useTheme } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';
import type { PomodoroPhase } from '../features/focus/types/pomodoro.types';
import { PHASE_DURATIONS, PHASE_LABELS } from '../features/focus/types/pomodoro.types';

const PHASE_META: Record<PomodoroPhase, { label: string; color: string; ring: string; btn: string; dot: string }> = {
  work: {
    label: 'Focus Session',
    color: 'text-emerald-400',
    ring: 'shadow-[0_0_80px_rgba(16,185,129,0.25)]',
    btn: 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/30',
    dot: 'bg-emerald-500',
  },
  shortBreak: {
    label: 'Short Break',
    color: 'text-amber-400',
    ring: 'shadow-[0_0_80px_rgba(245,158,11,0.25)]',
    btn: 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/30',
    dot: 'bg-amber-500',
  },
  longBreak: {
    label: 'Long Break',
    color: 'text-blue-400',
    ring: 'shadow-[0_0_80px_rgba(59,130,246,0.25)]',
    btn: 'bg-blue-600 hover:bg-blue-500 shadow-blue-500/30',
    dot: 'bg-blue-500',
  },
};

export default function FocusModePage() {
  const { state, dispatch } = usePomodoro();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const meta = PHASE_META[state.phase];

  // Qplanner sends learners here with ?topic=<slug>, so a focus session counts
  // toward that topic's progress instead of evaporating.
  const [searchParams] = useSearchParams();
  const topicSlug = searchParams.get('topic');
  const sessionsAtMount = useRef(state.totalCompleted);
  const reported = useRef(0);

  useEffect(() => {
    if (!topicSlug) return;
    const finishedHere = state.totalCompleted - sessionsAtMount.current;
    if (finishedHere <= reported.current) return;
    reported.current = finishedHere;

    // The backend $incs time and takes max(previous, sent) for the percentage, so
    // a rough 25%-per-pomodoro estimate can only ever move progress forward.
    updateTopicProgress(topicSlug, PHASE_DURATIONS.work, Math.min(100, finishedHere * 25))
      .catch(() => { /* a lost progress ping must not interrupt the timer */ });
  }, [state.totalCompleted, topicSlug]);

  const pct = Math.round(((PHASE_DURATIONS[state.phase] - state.secondsLeft) / PHASE_DURATIONS[state.phase]) * 100);

  return (
    <div className={cn(
      'relative min-h-full flex flex-col items-center justify-center px-6 py-12 overflow-hidden',
      isDark ? 'text-white' : 'text-zinc-900'
    )}>

      {/* Ambient glow background */}
      <div className={cn(
        'absolute inset-0 pointer-events-none',
        state.isRunning && state.phase === 'work'
          ? 'opacity-100' : 'opacity-40',
        'transition-opacity duration-1000'
      )}>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-emerald-500/10 blur-3xl" />
      </div>



      {topicSlug && (
        <div className="relative z-10 mb-6 flex items-center gap-2 rounded-full border border-current/20 px-4 py-2 text-sm">
          <Target className="h-4 w-4" aria-hidden />
          <span>
            Studying <strong>{topicSlug.replace(/-/g, ' ')}</strong>
          </span>
          <Link to="/qplanner" className="underline underline-offset-2">
            back to plan
          </Link>
        </div>
      )}

      {/* Phase label */}
      <motion.p
        key={state.phase + (state.isRunning ? 'running' : 'idle')}
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn('text-sm font-mono uppercase tracking-[0.2em] mb-8', meta.color)}
      >
        {!state.isRunning && state.phase === 'work' ? 'Focus Time' : meta.label}
      </motion.p>

      {/* Giant circular timer */}
      <div className={cn('relative mb-8 rounded-full', meta.ring)}>
        <CircularProgress secondsLeft={state.secondsLeft} phase={state.phase} size={260} />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
          <span className={cn('text-6xl font-mono font-medium tracking-tight', isDark ? 'text-white' : 'text-zinc-900')}>
            {formatTime(state.secondsLeft)}
          </span>
          <span className={cn('text-xs font-mono', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
            {pct}% elapsed
          </span>
        </div>
      </div>

      {/* Phase tabs */}
      <div className={cn('flex rounded-2xl p-1.5 mb-8 gap-1 w-full max-w-xs', isDark ? 'bg-white/5' : 'bg-zinc-100')}>
        {(['work', 'shortBreak', 'longBreak'] as PomodoroPhase[]).map((p) => (
          <button key={p}
            onClick={() => dispatch({ type: 'SET_PHASE', payload: p })}
            className={cn(
              'flex-1 py-2 rounded-xl text-xs font-mono transition-all',
              state.phase === p
                ? cn('shadow-sm font-medium', isDark ? 'bg-zinc-800 text-white' : 'bg-white text-zinc-900')
                : isDark ? 'text-zinc-500 hover:text-zinc-300' : 'text-zinc-400 hover:text-zinc-600'
            )}>
            {PHASE_LABELS[p]}
          </button>
        ))}
      </div>

      {/* Session dots */}
      <div className="flex items-center gap-3 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={cn(
            'w-3 h-3 rounded-full transition-all duration-300',
            i < state.pomodoroCount ? meta.dot : isDark ? 'bg-white/15' : 'bg-zinc-200'
          )} />
        ))}
        <span className={cn('text-xs font-mono ml-1', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
          {state.pomodoroCount} / 4 sessions
        </span>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-6">
        <button onClick={() => dispatch({ type: 'RESET' })}
          className={cn('w-12 h-12 rounded-full flex items-center justify-center transition-all',
            isDark ? 'hover:bg-white/10 text-zinc-400 hover:text-white' : 'hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900')} title="Reset">
          <RotateCcw className="w-5 h-5" />
        </button>

        {/* Main play/pause */}
        <motion.button
          onClick={() => dispatch({ type: 'TOGGLE_RUNNING' })}
          whileTap={{ scale: 0.93 }}
          className={cn('w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-xl text-white', meta.btn)}
          title={state.isRunning ? 'Pause' : 'Start'}>
          {/* Wave ring */}
          {state.isRunning && (
            <span className={cn('absolute w-20 h-20 rounded-full animate-ping opacity-20',
              state.phase === 'work' ? 'bg-emerald-500' : state.phase === 'shortBreak' ? 'bg-amber-500' : 'bg-blue-500')} />
          )}
          {state.isRunning
            ? <Pause className="w-8 h-8 relative z-10" />
            : <Play className="w-8 h-8 translate-x-0.5 relative z-10" />
          }
        </motion.button>

        <button onClick={() => dispatch({ type: 'SKIP' })}
          className={cn('w-12 h-12 rounded-full flex items-center justify-center transition-all',
            isDark ? 'hover:bg-white/10 text-zinc-400 hover:text-white' : 'hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900')} title="Skip">
          <SkipForward className="w-5 h-5" />
        </button>
      </div>

      {state.isRunning && state.phase === 'work' && (
        <motion.p
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className={cn('mt-8 text-xs font-mono text-center', isDark ? 'text-zinc-600' : 'text-zinc-400')}>
          Leaving fullscreen will reset your timer and forfeit XP
        </motion.p>
      )}
    </div>
  );
}
