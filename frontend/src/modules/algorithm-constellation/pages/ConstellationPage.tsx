import React, { useEffect, useState, useMemo, useCallback, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, SlidersHorizontal, ChevronDown, RotateCw, ZoomIn, Circle, Zap } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAlgorithmApi } from '../../algorithm-explorer/hooks/useAlgorithmApi';
import type { AlgorithmSummary } from '../../algorithm-explorer/hooks/useAlgorithmApi';
import { AlgorithmSidePanel } from '../components/AlgorithmSidePanel';
import { QuantumFluencyRadar } from '../components/QuantumFluencyRadar';
import { useConstellationState } from '../hooks/useConstellationState';
import { ALL_DOMAINS, getAlgorithmDomain } from '../utils/domainMapper';
import type { Domain } from '../utils/domainMapper';

// Lazy-load the heavy 3D canvas to keep initial page load snappy
const ConstellationScene = lazy(() =>
  import('../components/ConstellationScene').then(m => ({ default: m.ConstellationScene }))
);

// ─── Overlay cursor hint shown during entry animation ─────────────────────────
function EntryHint({ isInteractive }: { isInteractive: boolean }) {
  return (
    <AnimatePresence>
      {!isInteractive && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
          className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
        >
          <div className="flex flex-col items-center gap-3">
            <motion.div
              className="w-16 h-16 rounded-full border-2 border-emerald-400/40 flex items-center justify-center"
              animate={{ scale: [1, 1.15, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <div className="w-3 h-3 rounded-full bg-emerald-400" />
            </motion.div>
            <p className="text-xs text-zinc-500 font-sans tracking-widest uppercase">
              Assembling constellation…
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
const ConstellationPage: React.FC = () => {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const { listAlgorithms, loading } = useAlgorithmApi();
  const [algorithms, setAlgorithms] = useState<AlgorithmSummary[]>([]);
  const [isInteractive, setIsInteractive] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const {
    search,
    filterDomain,
    filterDifficulty,
    selectedSlug,
    camera,
    setSearch,
    setFilterDomain,
    setFilterDifficulty,
    setSelectedSlug,
    setCamera,
  } = useConstellationState();

  // selectedDomain tracks the 3D domain the camera is focused on
  const [selectedDomain, setSelectedDomain] = useState<Domain | null>(null);

  // Fetch algorithms once
  useEffect(() => {
    let cancelled = false;
    listAlgorithms()
      .then(data => { if (!cancelled) setAlgorithms(data); })
      .catch(console.error);
    return () => { cancelled = true; };
  }, [listAlgorithms]);

  // Compute filtered algorithms based on search and filters
  const filteredAlgorithms = useMemo(() => {
    return algorithms.filter(alg => {
      if (search && !alg.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterDifficulty !== 'All' && alg.difficulty !== filterDifficulty) return false;
      // Note: filterDomain is in state but UI only uses selectedDomain (which changes camera focus).
      // If we wanted a hard filter, we'd add: if (filterDomain !== 'All' && getAlgorithmDomain(alg.category ?? '', alg.name) !== filterDomain) return false;
      return true;
    });
  }, [algorithms, search, filterDifficulty]);

  // Selected algorithm object
  const selectedAlgorithm = useMemo(
    () => algorithms.find(a => a.slug === selectedSlug) ?? null,
    [algorithms, selectedSlug]
  );

  // Domain handlers
  const handleSelectDomain = useCallback((domain: Domain | null) => {
    setSelectedDomain(domain);
    if (!domain) setSelectedSlug(null);
  }, [setSelectedSlug]);

  // Algorithm handlers
  const handleSelectAlgorithm = useCallback((slug: string | null) => {
    setSelectedSlug(slug);
  }, [setSelectedSlug]);

  // Navigate to algorithm detail
  const handleStartLearning = useCallback((slug: string) => {
    navigate(`/algorithms/${slug}`);
  }, [navigate]);

  // Navigate to algorithm in graph (jump camera focus via domain selection)
  const handleNavigateToRelated = useCallback((slug: string) => {
    const alg = algorithms.find(a => a.slug === slug);
    if (!alg) return;
    setSelectedSlug(slug);
  }, [algorithms, setSelectedSlug]);

  // Radar domain hover → no-op in 3D scene (handled at graph level in future)
  const handleDomainHover = useCallback((_: string | null) => {}, []);

  // Radar domain click → select domain in 3D
  const handleRadarDomainClick = useCallback((domain: string) => {
    const typed = domain as Domain;
    setSelectedDomain(prev => prev === typed ? null : typed);
  }, []);

  const isDark = theme === 'dark';

  return (
    <div
      className={cn(
        'relative w-full h-full overflow-hidden transition-colors duration-300 flex',
        isDark ? 'bg-zinc-950' : 'bg-zinc-50'
      )}
    >
      {/* ─── Main Content Area (shrinks when sidebar is open) ─── */}
      <div className={cn(
        'relative h-full transition-all duration-300 shrink-0 w-full flex flex-col'
      )}>
        {/* ─── 3D Canvas ───
          Fills whatever height the header leaves (order-2 in the column), so the
          globe is always centred in the visible area below the page header. */}
      <div className="relative order-2 flex-1 min-h-0">
        <Suspense fallback={null}>
          {!loading && algorithms.length > 0 && (
            <ConstellationScene
              algorithms={filteredAlgorithms}
              selectedDomain={selectedDomain}
              selectedSlug={selectedSlug}
              isDark={isDark}
              onSelectDomain={handleSelectDomain}
              onSelectAlgorithm={handleSelectAlgorithm}
              onInteractive={() => setIsInteractive(true)}
            />
          )}
        </Suspense>
      </div>

      {/* ─── Entry animation hint ─── */}
      <EntryHint isInteractive={isInteractive || loading} />

      {/* ─── Page header ───
          Same treatment as PageHero (Playground Hub, QStudio, QBook): large title,
          text-lg subtitle, identical padding and entrance timing. */}
      <div className="relative order-1 z-20 shrink-0 px-6 md:px-12 pt-12 pb-6 flex flex-col gap-6 transition-colors">
        {/* Title row */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="flex flex-col gap-4 max-w-3xl">
            <motion.h1
              className={cn('text-4xl md:text-5xl font-sans tracking-tight', isDark ? 'text-white' : 'text-zinc-900')}
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              Algorithm Constellation
            </motion.h1>
            <motion.p
              className={cn('text-lg', isDark ? 'text-zinc-400' : 'text-zinc-600')}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              {selectedDomain
                ? `${selectedDomain} — ${filteredAlgorithms.filter(a => getAlgorithmDomain(a.category ?? '', a.name) === selectedDomain).length} algorithms`
                : 'Every major quantum algorithm, mapped by domain. Click a domain node to explore.'}
            </motion.p>
          </div>

          {/* Breadcrumb when domain selected */}
          <AnimatePresence mode="wait">
            {selectedDomain && (
              <motion.button
                key={selectedDomain}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                onClick={() => handleSelectDomain(null)}
                className={cn(
                  'text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-full border font-sans transition-colors',
                  isDark
                    ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20'
                    : 'border-emerald-500/40 text-emerald-600 bg-emerald-50 hover:bg-emerald-100'
                )}
              >
                ← All domains
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* Search + filter row */}
        <div className="flex gap-2 items-center">
          <div className="relative flex-1 max-w-xs">
            <Search className={cn('absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5', isDark ? 'text-zinc-500' : 'text-zinc-600')} />
            <input
              type="text"
              placeholder="Search algorithms… (Press Enter)"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  const query = search.trim().toLowerCase();
                  if (!query) return;
                  const matches = algorithms.filter(a => a.name.toLowerCase().includes(query));
                  if (matches.length === 0) {
                    toast.error(`No algorithm found matching "${search}"`);
                  } else {
                    const bestMatch = matches.find(a => a.name.toLowerCase() === query) || matches[0];
                    const domain = getAlgorithmDomain(bestMatch.category ?? '', bestMatch.name);
                    setSelectedDomain(domain as Domain);
                    setSelectedSlug(bestMatch.slug);
                  }
                }
              }}
              disabled={!isInteractive}
              className={cn(
                'w-full pl-8 pr-3 py-2 rounded-xl border text-xs focus:outline-none',
                'focus:ring-2 focus:ring-emerald-500/30 transition-all font-sans',
                isDark
                  ? 'bg-zinc-900/60 border-zinc-800 text-white placeholder-zinc-600 disabled:opacity-40'
                  : 'bg-white border-zinc-200 text-zinc-900 placeholder-zinc-400 disabled:opacity-40'
              )}
            />
          </div>

          <button
            onClick={() => setShowFilters(f => !f)}
            disabled={!isInteractive}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-sans transition-all',
              showFilters
                ? isDark
                  ? 'border-emerald-500/50 text-emerald-400 bg-emerald-500/10'
                  : 'border-emerald-600/40 text-emerald-700 bg-emerald-50'
                : isDark
                  ? 'border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-200 disabled:opacity-40'
                  : 'border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:text-zinc-900 disabled:opacity-40'
            )}
          >
            <SlidersHorizontal size={13} />
            Filters
            <ChevronDown size={11} className={cn('transition-transform', showFilters && 'rotate-180')} />
          </button>

          {/* Domain quick filters (compact) */}
          <div className="hidden md:flex gap-1.5 flex-wrap">
            {ALL_DOMAINS.slice(0, 6).map(d => (
              <button
                key={d}
                disabled={!isInteractive}
                onClick={() => handleSelectDomain(selectedDomain === d ? null : d as Domain)}
                className={cn(
                  'px-2.5 py-1 rounded-full border text-[11px] font-sans transition-all',
                  selectedDomain === d
                    ? isDark
                      ? 'border-emerald-500/60 text-emerald-400 bg-emerald-500/15'
                      : 'border-emerald-600/50 text-emerald-700 bg-emerald-50'
                    : isDark
                      ? 'border-zinc-800 text-zinc-600 hover:text-zinc-300 hover:border-zinc-700 disabled:opacity-30'
                      : 'border-zinc-300 text-zinc-600 hover:text-zinc-900 hover:border-zinc-400 disabled:opacity-30'
                )}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* Expanded difficulty filter */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="flex gap-2 items-center pt-1 flex-wrap overflow-hidden"
            >
              <span className={cn('text-[11px] uppercase tracking-wider', isDark ? 'text-zinc-600' : 'text-zinc-600')}>
                Difficulty:
              </span>
              {['All', 'Beginner', 'Intermediate', 'Advanced'].map(d => (
                <button
                  key={d}
                  onClick={() => setFilterDifficulty(filterDifficulty === d ? 'All' : d)}
                  className={cn(
                    'px-2.5 py-1 rounded-lg border text-[11px] font-sans transition-all',
                    filterDifficulty === d
                      ? isDark
                        ? 'border-emerald-500/50 text-emerald-400 bg-emerald-500/12'
                        : 'border-emerald-600/40 text-emerald-700 bg-emerald-50'
                      : isDark ? 'border-zinc-800 text-zinc-500' : 'border-zinc-300 text-zinc-600'
                  )}
                >
                  {d}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ─── Left sidebar — Quantum Fluency Radar ─── */}
      <AnimatePresence>
        {isInteractive && (
          <motion.div
            initial={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 28, delay: 0.3 }}
            className={cn(
              'absolute bottom-6 left-5 z-20 w-64',
              'hidden xl:block'
            )}
          >
            <QuantumFluencyRadar
              algorithms={algorithms}
              onDomainHover={handleDomainHover}
              onDomainClick={handleRadarDomainClick}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Legend (bottom right) ─── */}
      <AnimatePresence>
        {isInteractive && !selectedSlug && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ delay: 0.5 }}
            className={cn(
              'absolute bottom-6 right-6 z-20 hidden lg:flex flex-col gap-1.5 text-[11px] font-sans',
              'px-3 py-2.5 rounded-xl border',
              isDark ? 'border-white/6 bg-zinc-950/60 backdrop-blur-lg text-zinc-500' : 'border-zinc-300 bg-white/90 backdrop-blur-lg text-zinc-600'
            )}
          >
            <p className={cn('uppercase tracking-widest text-[10px] mb-0.5', isDark ? 'text-zinc-600' : 'text-zinc-500')}>Controls</p>
            {[
              { Icon: RotateCw, action: 'Drag', rest: 'to rotate' },
              { Icon: ZoomIn, action: 'Scroll', rest: 'to zoom' },
              { Icon: Circle, action: 'Click domain', rest: 'to expand' },
              { Icon: Zap, action: 'Click algorithm', rest: 'for details' },
            ].map(({ Icon, action, rest }) => (
              <p key={action} className="flex items-center gap-1.5">
                <Icon size={11} className="shrink-0 opacity-70" />
                <span className={isDark ? 'text-zinc-400' : 'text-zinc-900'}>{action}</span>
                {rest}
              </p>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      </div>

      {/* ─── Algorithm side panel ─── */}
      <div className="absolute inset-y-0 right-0 z-30 pointer-events-none">
        <div className="pointer-events-auto h-full">
          <AlgorithmSidePanel
            algorithm={selectedAlgorithm}
            allAlgorithms={algorithms}
            onClose={() => setSelectedSlug(null)}
            onNavigateToAlgorithm={handleNavigateToRelated}
          />
        </div>
      </div>

      {/* ─── Loading state ─── */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-30">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <span className={cn('text-sm font-sans', isDark ? 'text-zinc-500' : 'text-zinc-600')}>
              Loading constellation…
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConstellationPage;
