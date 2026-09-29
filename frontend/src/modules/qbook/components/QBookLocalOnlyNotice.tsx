import { FaBook, FaInfoCircle } from 'react-icons/fa';
import { useTheme } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

/**
 * notebook_service runs locally via Docker only for this MVP (PLANS/qbook.md §1,
 * mirroring video_service's current posture) — it isn't deployed anywhere.
 * import.meta.env.PROD is Vite's prod-build flag (true on the Vercel deployment,
 * false under `npm run dev`), so this only renders when the frontend itself isn't
 * being run locally.
 */
export function QBookLocalOnlyNotice() {
  const { theme } = useTheme();

  return (
    <motion.div
      className={cn(
        "rounded-[2rem] border shadow-sm overflow-hidden",
        theme === 'dark' ? "bg-zinc-950/50 border-white/10" : "bg-white border-zinc-200",
      )}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="p-8 flex items-start gap-4 border-b border-inherit">
        <div className={cn(
          "w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0",
          theme === 'dark' ? "bg-black border-white/10 text-emerald-400" : "bg-zinc-50 border-zinc-200 text-emerald-600",
        )}>
          <FaBook className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-2xl font-sans tracking-tight">QBook</h2>
          <p className={cn("text-sm mt-1", theme === 'dark' ? "text-zinc-400" : "text-zinc-600")}>
            Run Python and Qiskit notebooks, cell by cell.
          </p>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center py-14 px-8 text-center gap-3">
        <div className={cn(
          "w-14 h-14 rounded-2xl border flex items-center justify-center mb-2",
          theme === 'dark' ? "bg-black border-white/10 text-zinc-400" : "bg-zinc-50 border-zinc-200 text-zinc-500",
        )}>
          <FaInfoCircle className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-semibold">Local-only feature (MVP)</h3>
        <p className={cn("max-w-md", theme === 'dark' ? "text-zinc-400" : "text-zinc-600")}>
          QBook's notebook execution service isn't deployed to any cloud host yet — only
          demoed via Docker on a developer's own machine. It isn't available on this
          deployed site.
        </p>
      </div>
    </motion.div>
  );
}
