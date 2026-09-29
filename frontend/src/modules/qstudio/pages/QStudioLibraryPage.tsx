import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaPlus } from 'react-icons/fa';
import { useTheme } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { useQStudioApi } from '../hooks/useQStudioApi';
import { StudySpaceTile } from '../components/StudySpaceTile';
import type { StudySpaceSummary } from '../types';

const QStudioLibraryPage: React.FC = () => {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const { listStudySpaces, createStudySpace, deleteStudySpace, loading, error } = useQStudioApi();
  const [studySpaces, setStudySpaces] = useState<StudySpaceSummary[]>([]);
  const [creating, setCreating] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setStudySpaces(await listStudySpaces());
    } catch (err) {
      console.error(err);
    }
  }, [listStudySpaces]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const studySpace = await createStudySpace();
      navigate(`/qstudio/${studySpace.id}`);
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    setStudySpaces((prev) => prev.filter((s) => s.id !== id));
    try {
      await deleteStudySpace(id);
    } catch (err) {
      console.error(err);
      refresh();
    }
  };

  return (
    <div className={cn(
      "w-full h-full transition-colors duration-300 py-12 px-6 md:px-12",
      theme === 'dark' ? "text-white" : "text-zinc-900",
    )}>
      <div className="max-w-[1600px] mx-auto flex flex-col gap-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="flex flex-col gap-4 max-w-3xl">
            <motion.h1
              className="text-4xl md:text-5xl font-sans tracking-tight"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              QStudio
            </motion.h1>
            <motion.p
              className={cn("text-lg", theme === 'dark' ? "text-zinc-400" : "text-zinc-600")}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              Add your sources, then turn them into mind maps, flashcards, and more.
            </motion.p>
          </div>

          <button
            onClick={handleCreate}
            disabled={creating}
            className="px-6 py-2.5 bg-emerald-500 text-white rounded-lg shadow hover:bg-emerald-600 font-medium transition-colors disabled:opacity-50 text-sm flex items-center gap-2 w-fit"
          >
            <FaPlus className="w-3.5 h-3.5" /> {creating ? 'Creating…' : 'New Study Space'}
          </button>
        </div>

        {error && (
          <div className="p-4 bg-red-100/10 border border-red-500/20 text-red-500 rounded-lg">{error}</div>
        )}

        {loading && studySpaces.length === 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
            {[1, 2, 3].map((idx) => (
              <div
                key={idx}
                className={cn(
                  "p-8 rounded-[2rem] border shadow-sm h-[250px] animate-pulse",
                  theme === 'dark' ? "bg-zinc-950/50 border-white/10" : "bg-white border-zinc-200",
                )}
              >
                <div className={cn("w-12 h-12 rounded-2xl mb-6", theme === 'dark' ? "bg-white/10" : "bg-zinc-200")} />
                <div className={cn("h-6 w-3/4 rounded mb-4", theme === 'dark' ? "bg-white/10" : "bg-zinc-200")} />
                <div className={cn("h-4 w-1/2 rounded", theme === 'dark' ? "bg-white/5" : "bg-zinc-100")} />
              </div>
            ))}
          </div>
        )}

        {!loading && studySpaces.length === 0 && (
          <motion.div
            className="flex flex-col items-center justify-center py-20 gap-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className={cn(
              "w-16 h-16 rounded-2xl border flex items-center justify-center",
              theme === 'dark' ? "bg-black border-white/10 text-zinc-400" : "bg-zinc-50 border-zinc-200 text-zinc-700",
            )}>
              <FaPlus className="w-6 h-6" />
            </div>
            <p className="text-lg font-medium">No study spaces yet</p>
            <p className={cn("text-sm", theme === 'dark' ? "text-zinc-400" : "text-zinc-600")}>
              Create your first study space to start adding sources.
            </p>
          </motion.div>
        )}

        {studySpaces.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
            {studySpaces.map((studySpace) => (
              <StudySpaceTile key={studySpace.id} studySpace={studySpace} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default QStudioLibraryPage;
