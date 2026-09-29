import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { puzzles, type PuzzleTier } from '../data/puzzles';
import { cn } from '@/lib/utils';
import { FaPlay, FaLock, FaCheckCircle, FaFire } from 'react-icons/fa';
import { useTheme } from '@/context/ThemeContext';
import { motion } from 'framer-motion';
import { apiClient } from '@/lib/apiClient';
import { CircuitCopilotSidebar } from '@/modules/gates-playground/components/CircuitCopilotSidebar';
import { useQriousCodeCircuit } from '@/features/qrious-code/QriousCode';
import { SchrodingerLauncher } from '@/modules/gates-playground/components/SchrodingerLauncher';
import { CatOverlay } from '@/modules/gates-playground/components/CatOverlay';
import { COPILOT_WIDTH } from '@/modules/gates-playground/constants/layout';
import type { CircuitContext } from '@/modules/gates-playground/hooks/useAiTutorApi';
import { useSidebar } from '@/components/ui/sidebar';
import { toast } from 'sonner';

// Legacy per-page Circuit Copilot launcher + Schrodinger's-cat animation. Superseded by the
// app-wide Qrious Code panel (header button, see features/qrious-code). Switched off rather
// than deleted so it can be restored after the demo: set this to true.
const LEGACY_CIRCUIT_COPILOT_UI = false;

export default function PuzzlesLandingPage() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [showSolutions, setShowSolutions] = useState(false);
  const [userCompletedLevels, setUserCompletedLevels] = useState<string[]>([]);
  const [dailyStatus, setDailyStatus] = useState<{
    daily_puzzle_id: string;
    solved_today: boolean;
    current_streak: number;
    longest_streak: number;
    global_solve_count: number;
  } | null>(null);

  const [aiTutorOpen, setAiTutorOpen] = useState(false);
  const [isCatInCopilot, setIsCatInCopilot] = useState(false);
  const [copilotWidth, setCopilotWidth] = useState(COPILOT_WIDTH);

  const { setOpen: setMainSidebarOpen } = useSidebar();

  const launcherRef = useRef<HTMLButtonElement | null>(null);
  const gateAAnchorRef = useRef<HTMLDivElement | null>(null);
  const gateBAnchorRef = useRef<HTMLDivElement | null>(null);
  const copilotCatAnchorRef = useRef<HTMLDivElement | null>(null);

  const openAiTutor = () => {
    setMainSidebarOpen(false);
    setAiTutorOpen(true);
  };

  const closeAiTutor = () => {
    setMainSidebarOpen(true);
    setAiTutorOpen(false);
    setIsCatInCopilot(false);
  };

  const toggleAiTutor = () => {
    if (!aiTutorOpen) {
      openAiTutor();
    } else {
      closeAiTutor();
    }
  };

  const handleApplyCode = (_code: string) => {
    toast.info("OpenQASM code application is only available within an active puzzle playground.");
  };

  useEffect(() => {
    async function fetchCompletedPuzzles() {
      try {
        const response = await apiClient.get<{ data: string[] }>('/api/v1/learning/puzzles/completed');
        if (response.data && Array.isArray(response.data.data)) {
          setUserCompletedLevels(response.data.data);
        }
      } catch (err) {
        console.error("Failed to load completed puzzles", err);
      }
    }

    async function fetchDailyStatus() {
      try {
        const response = await apiClient.get<{ data: any }>('/api/v1/learning/puzzles/daily/status');
        if (response.data && response.data.data) {
          setDailyStatus(response.data.data);
        }
      } catch (err) {
        console.error("Failed to load daily puzzle status", err);
      }
    }

    fetchCompletedPuzzles();
    fetchDailyStatus();
  }, []);

  const tiers = [
    {
      id: 'Beginner' as PuzzleTier,
      title: 'Beginner',
      desc: 'Master the basics of single-qubit gates, superposition, and phase.',
    },
    {
      id: 'Intermediate' as PuzzleTier,
      title: 'Intermediate',
      desc: 'Dive into two-qubit interactions, entanglement, and CNOT operations.',
    },
    {
      id: 'Advanced' as PuzzleTier,
      title: 'Advanced',
      desc: 'Explore quantum algorithms, phase kickback, and complex state preparation.',
    }
  ];

  const currentCircuitContext: CircuitContext = {
    qasm: `// Quantum Puzzles Selection Board\n// Completed levels: ${userCompletedLevels.join(', ')}\n// Total puzzles solved: ${userCompletedLevels.length}\n// Daily challenge solved today: ${dailyStatus?.solved_today ? 'Yes' : 'No'}\n// Current streak: ${dailyStatus?.current_streak || 0} days`,
    qubits: 0,
    cbits: 0,
    gateCount: 0,
  };

  // Lets the global Qrious Code panel see this circuit and apply code into it.
  useQriousCodeCircuit(currentCircuitContext, handleApplyCode);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] w-full overflow-hidden">
      <div className={cn(
        "flex-1 overflow-y-auto transition-colors duration-300 py-12 px-6 md:px-12 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']",
        theme === 'dark' ? "text-white" : "text-zinc-900"
      )}>
        <div className="max-w-[1600px] mx-auto flex flex-col gap-16">
          <div className="flex flex-col gap-4 max-w-3xl">
            <motion.h1
              className="text-4xl md:text-5xl font-sans tracking-tight"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              Quantum Puzzles
            </motion.h1>
            <motion.p
              className={cn("text-lg", theme === 'dark' ? "text-zinc-400" : "text-zinc-600")}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              Test your understanding of quantum mechanics. Build intuition by solving interactive circuit challenges across three difficulty tiers.
            </motion.p>
          </div>

          {/* Daily Challenge Section */}
          {dailyStatus && puzzles.find(p => p.id === dailyStatus.daily_puzzle_id) && (() => {
            const dailyPuzzle = puzzles.find(p => p.id === dailyStatus.daily_puzzle_id)!;
            const getDifficulty = (tier: string) => {
              if (tier === 'Beginner') return 'Easy';
              if (tier === 'Intermediate') return 'Medium';
              return 'Hard';
            };
            return (
              <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-sans tracking-tight">Daily Challenge</h2>
                    <p className={cn("text-sm mt-1", theme === 'dark' ? "text-zinc-400" : "text-zinc-600")}>
                      Solve the daily quantum puzzle to keep your streak alive and earn bonus XP!
                    </p>
                  </div>
                  
                  {/* Daily Streak Indicator */}
                  <div className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-xl border shadow-sm transition-all duration-300",
                    theme === 'dark' 
                      ? "bg-zinc-950/50 border-white/10" 
                      : "bg-white border-zinc-200"
                  )}>
                    <FaFire className="w-5 h-5 animate-pulse text-orange-500" />
                    <span className={cn("font-mono text-sm font-medium", theme === 'dark' ? "text-white" : "text-zinc-900")}>
                      Streak: {dailyStatus.current_streak} Days
                    </span>
                  </div>
                </div>

                {/* Daily Challenge Card */}
                <motion.div
                  className={cn(
                    "p-8 rounded-[2rem] border overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 group flex flex-col justify-between min-h-[220px] relative hover:scale-[1.01]",
                    theme === 'dark'
                      ? "bg-zinc-950/50 border-white/10 hover:border-emerald-500/50 hover:bg-white/5"
                      : "bg-white border-zinc-200 hover:border-emerald-500/30"
                  )}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                >
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className={cn(
                          "text-[10px] font-mono tracking-wider px-2 py-0.5 rounded border uppercase font-medium",
                          dailyPuzzle.tier === 'Beginner'
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : dailyPuzzle.tier === 'Intermediate'
                              ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
                              : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        )}>
                          {getDifficulty(dailyPuzzle.tier)}
                        </span>
                        <span className={cn("text-xs font-mono", theme === 'dark' ? "text-zinc-400" : "text-zinc-500")}>
                          Today's Problem
                        </span>
                      </div>
                      
                      {/* Solve Rate / Global Count */}
                      <div className={cn("text-xs font-mono flex items-center gap-1.5", theme === 'dark' ? "text-zinc-400" : "text-zinc-500")}>
                        <span>{dailyStatus.global_solve_count} solved today</span>
                      </div>
                    </div>

                    <h3 className="font-sans text-2xl font-normal leading-snug max-w-4xl">{dailyPuzzle.prompt}</h3>
                  </div>

                  <div className="mt-6 flex items-center justify-end">
                    {dailyStatus.solved_today ? (
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1.5 text-sm text-emerald-500 font-medium">
                          <FaCheckCircle className="w-4 h-4" /> Completed (+10 XP)
                        </span>
                        <button
                          onClick={() => navigate(`/puzzles/${dailyPuzzle.id}?daily=true`)}
                          className={cn(
                            "px-5 py-2 rounded-lg border transition-colors text-xs font-medium",
                            theme === 'dark' 
                              ? "border-white/10 hover:bg-white/5 text-zinc-300" 
                              : "border-zinc-200 hover:bg-zinc-50 text-zinc-700"
                          )}
                        >
                          Replay
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => navigate(`/puzzles/${dailyPuzzle.id}?daily=true`)}
                        className="px-6 py-2.5 bg-emerald-500 text-white rounded-lg shadow hover:bg-emerald-600 font-medium transition-colors flex items-center gap-2 text-sm"
                      >
                        Solve Challenge <FaPlay className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </motion.div>
              </div>
            );
          })()}

          {/* ── View Switcher: Sliding Pill Control (Puzzles | Hints & Solutions) ── */}
          <div className="flex items-center justify-start">
            <div className={cn(
              "relative flex items-center p-1.5 rounded-2xl border shadow-sm",
              theme === 'dark' ? "bg-zinc-950/80 border-white/10" : "bg-zinc-100 border-zinc-200"
            )}>
              <button
                onClick={() => setShowSolutions(false)}
                className={cn(
                  "relative px-6 py-2 text-sm font-medium rounded-xl transition-colors duration-200 z-10 flex items-center gap-2 select-none",
                  !showSolutions
                    ? "text-white"
                    : theme === 'dark' ? "text-zinc-400 hover:text-white" : "text-zinc-600 hover:text-zinc-900"
                )}
              >
                {!showSolutions && (
                  <motion.div
                    layoutId="activePuzzleTabPill"
                    className="absolute inset-0 bg-emerald-500 rounded-xl shadow-md -z-10"
                    transition={{ type: "spring", stiffness: 450, damping: 35 }}
                  />
                )}
                <span>Puzzles</span>
              </button>

              <button
                onClick={() => setShowSolutions(true)}
                className={cn(
                  "relative px-6 py-2 text-sm font-medium rounded-xl transition-colors duration-200 z-10 flex items-center gap-2 select-none",
                  showSolutions
                    ? "text-white"
                    : theme === 'dark' ? "text-zinc-400 hover:text-white" : "text-zinc-600 hover:text-zinc-900"
                )}
              >
                {showSolutions && (
                  <motion.div
                    layoutId="activePuzzleTabPill"
                    className="absolute inset-0 bg-emerald-500 rounded-xl shadow-md -z-10"
                    transition={{ type: "spring", stiffness: 450, damping: 35 }}
                  />
                )}
                <span>Hints &amp; Solutions</span>
              </button>
            </div>
          </div>

          {/* ── Main Content Area: Puzzles View vs Hints & Solutions View ── */}
          {!showSolutions ? (
            <div className="flex flex-col gap-16 animate-in fade-in duration-300">
              {tiers.map((tier) => {
                const tierPuzzles = puzzles.filter(p => p.tier === tier.id);

                return (
                  <div key={tier.id} className="flex flex-col gap-8">
                    <div className="flex items-center gap-5">
                      <div>
                        <h2 className="text-3xl font-sans tracking-tight">{tier.title}</h2>
                        <p className={cn("text-sm mt-1", theme === 'dark' ? "text-zinc-400" : "text-zinc-600")}>{tier.desc}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                      {tierPuzzles.map((puzzle, index) => {
                        const isCompleted = userCompletedLevels.includes(puzzle.id);
                        const isLocked = false; 

                        return (
                          <motion.div
                            key={puzzle.id}
                            className={cn(
                              "p-8 rounded-[2rem] border overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 group flex flex-col justify-between h-[280px] relative",
                              theme === 'dark'
                                ? "bg-zinc-950/50 border-white/10 hover:border-emerald-500/50 hover:bg-white/5"
                                : "bg-white border-zinc-200 hover:border-emerald-500/30"
                            )}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: "-50px" }}
                            transition={{ duration: 0.5, delay: index * 0.05 }}
                          >
                            <div className="flex flex-col gap-3">
                              <div className="flex items-center justify-between">
                                <span className={cn(
                                  "text-xs font-mono px-2 py-1 rounded",
                                  theme === 'dark' ? "bg-white/10 text-zinc-300" : "bg-zinc-100 text-zinc-600"
                                )}>
                                  Level {puzzle.level}
                                </span>
                                {isCompleted && (
                                  <FaCheckCircle className="text-emerald-500 w-5 h-5" />
                                )}
                              </div>
                              
                              <h3 className="font-sans text-xl mt-2 line-clamp-2">{puzzle.prompt}</h3>
                              
                              <div className="flex flex-wrap gap-2 mt-2">
                                {puzzle.topicsToLearn.slice(0, 3).map(topic => (
                                  <span key={topic} className={cn(
                                    "text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border",
                                    theme === 'dark' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  )}>
                                    {topic}
                                  </span>
                                ))}
                                {puzzle.topicsToLearn.length > 3 && (
                                  <span className={cn(
                                    "text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border",
                                    theme === 'dark' ? "bg-zinc-500/10 text-zinc-400 border-zinc-500/20" : "bg-zinc-50 text-zinc-700 border-zinc-200"
                                  )}>
                                    +{puzzle.topicsToLearn.length - 3}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="mt-6 flex items-center justify-end">
                              {isLocked ? (
                                <div className={cn(
                                  "w-10 h-10 rounded-full flex items-center justify-center",
                                  theme === 'dark' ? "bg-white/5 text-zinc-500" : "bg-zinc-100 text-zinc-400"
                                )}>
                                  <FaLock />
                                </div>
                              ) : (
                                <button
                                  onClick={() => navigate(`/puzzles/${puzzle.id}`)}
                                  className="px-6 py-2 bg-emerald-500 text-white rounded-lg shadow hover:bg-emerald-600 font-medium transition-colors disabled:opacity-50 flex items-center gap-2 text-sm"
                                >
                                  {isCompleted ? 'Replay' : 'Play'} <FaPlay className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col gap-20 text-left animate-in fade-in duration-300">
              <div>
                <h2 className="text-3xl font-sans tracking-tight">Hints &amp; Solutions Library</h2>
                <p className={cn("text-sm mt-1", theme === 'dark' ? "text-zinc-400" : "text-zinc-600")}>
                  Explore step-by-step guidance, hints, and formal solution reasoning for every puzzle.
                </p>
              </div>

              {tiers.map((tier, tierIndex) => (
                <div key={`sol-tier-${tier.id}`} className="flex flex-col gap-6">
                  {tierIndex > 0 && (
                    <div className={cn("h-px -mt-10 mb-2", theme === 'dark' ? "bg-white/5" : "bg-zinc-200")} />
                  )}
                  <div className="flex items-center gap-3">
                    <h3 className={cn("text-xl font-semibold tracking-tight", theme === 'dark' ? "text-white" : "text-zinc-900")}>{tier.title}</h3>
                    <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">Tier</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {puzzles.filter(p => p.tier === tier.id).map(puzzle => (
                      <div key={`sol-${puzzle.id}`} className={cn(
                        "p-6 rounded-[2rem] border shadow-sm flex flex-col justify-between gap-4 transition-all duration-300",
                        theme === 'dark' ? "bg-zinc-950/50 border-white/10" : "bg-white border-zinc-200"
                      )}>
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <span className={cn("font-mono text-xs px-2 py-0.5 rounded", theme === 'dark' ? "bg-white/10 text-zinc-300" : "bg-zinc-100 text-zinc-600")}>
                              Level {puzzle.level}
                            </span>
                            <button
                              onClick={() => navigate(`/puzzles/${puzzle.id}`)}
                              className="text-xs text-emerald-500 hover:text-emerald-400 flex items-center gap-1 font-medium transition-colors"
                            >
                              Open Puzzle <FaPlay className="w-2.5 h-2.5" />
                            </button>
                          </div>
                          <h4 className="font-sans font-medium text-lg mt-1">{puzzle.prompt}</h4>
                          {puzzle.hint && (
                            <p className={cn(
                              "text-xs p-2.5 rounded-xl font-mono leading-relaxed",
                              theme === 'dark'
                                ? "bg-zinc-800/80 text-zinc-300 border border-zinc-700"
                                : "bg-zinc-100 text-zinc-600 border border-zinc-200"
                            )}>
                              <span className="text-amber-400/80 mr-1">💡</span>
                              <span className="text-zinc-400 font-medium">Hint:</span> {puzzle.hint}
                            </p>
                          )}
                        </div>

                        <div className={cn("text-xs p-3.5 rounded-xl space-y-1.5 font-sans leading-relaxed", theme === 'dark' ? "bg-zinc-900/80 text-zinc-300 border border-zinc-800" : "bg-zinc-50 text-zinc-700 border border-zinc-200")}>
                          <span className={cn("block font-medium text-xs mb-1", theme === 'dark' ? "text-zinc-400" : "text-zinc-500")}>Solution &amp; Reasoning:</span>
                          <p>{puzzle.wrongFeedback}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Legacy Circuit Copilot UI, now served app-wide by Qrious Code. Restore: LEGACY_CIRCUIT_COPILOT_UI = true. */}
      {LEGACY_CIRCUIT_COPILOT_UI && (
      <>
      {/* Floating Action Button for AI Copilot */}
      <div className="fixed bottom-10 right-10 z-50">
        <SchrodingerLauncher anchorRef={launcherRef} onClick={toggleAiTutor} isOpen={aiTutorOpen} />
      </div>

      {/* Persistent Layout Anchors for Teleportation Geometry */}
      <div ref={gateAAnchorRef} className="fixed bottom-16 pointer-events-none w-0 h-0 z-0 bg-transparent" style={{ right: aiTutorOpen ? copilotWidth : COPILOT_WIDTH }} aria-hidden="true" />
      <div ref={gateBAnchorRef} className="fixed top-32 pointer-events-none w-0 h-0 z-0 bg-transparent" style={{ right: aiTutorOpen ? copilotWidth : COPILOT_WIDTH }} aria-hidden="true" />

      <CircuitCopilotSidebar
        anchorRef={copilotCatAnchorRef}
        isOpen={aiTutorOpen}
        onClose={closeAiTutor}
        circuitContext={currentCircuitContext}
        onApplyCode={handleApplyCode}
        isCatInCopilot={isCatInCopilot}
        copilotWidth={copilotWidth}
        setCopilotWidth={setCopilotWidth}
      />

      <CatOverlay 
        isOpen={aiTutorOpen} 
        launcherAnchorRef={launcherRef} 
        gateAAnchorRef={gateAAnchorRef}
        gateBAnchorRef={gateBAnchorRef}
        copilotCatAnchorRef={copilotCatAnchorRef} 
        isCatInCopilot={isCatInCopilot}
        onCatArrived={() => setIsCatInCopilot(true)}
      />
      </>
      )}
    </div>
  );
}
