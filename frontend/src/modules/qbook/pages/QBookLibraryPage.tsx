import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaPlus } from 'react-icons/fa';
import { useTheme } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { useQBookApi } from '../hooks/useQBookApi';
import { NotebookTile } from '../components/NotebookTile';
import type { NotebookSummary } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { SAMPLE_QML_NOTEBOOKS, type QmlNotebookTemplate } from '../data/sampleQmlNotebooks';

const QBookLibraryPage: React.FC = () => {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const { listNotebooks, createNotebook, updateNotebook, deleteNotebook, loading, error } = useQBookApi();
  const [notebooks, setNotebooks] = useState<NotebookSummary[]>([]);
  const [creating, setCreating] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setNotebooks(await listNotebooks());
    } catch (err) {
      console.error(err);
    }
  }, [listNotebooks]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const notebook = await createNotebook();
      navigate(`/qbook/${notebook.id}`);
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const handleLoadTemplate = async (template: QmlNotebookTemplate) => {
    setCreating(true);
    try {
      const notebook = await createNotebook(template.title);
      await updateNotebook(notebook.id, {
        cells: template.cells.map((c) => ({
          id: uuidv4(),
          cell_type: c.type,
          source: c.content,
          outputs: [],
          execution_count: null,
        })),
      });
      navigate(`/qbook/${notebook.id}`);
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    setNotebooks((prev) => prev.filter((n) => n.id !== id));
    try {
      await deleteNotebook(id);
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
              QBook
            </motion.h1>
            <motion.p
              className={cn("text-lg", theme === 'dark' ? "text-zinc-400" : "text-zinc-600")}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              Your own notebooks — run Python and Qiskit, cell by cell.
            </motion.p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleCreate}
              disabled={creating}
              className="px-6 py-2.5 bg-emerald-500 text-white rounded-lg shadow hover:bg-emerald-600 font-medium transition-colors disabled:opacity-50 text-sm flex items-center gap-2 w-fit"
            >
              <FaPlus className="w-3.5 h-3.5" /> {creating ? 'Creating…' : 'New Notebook'}
            </button>
          </div>
        </div>

        {/* Templates Section */}
        <div className="flex flex-col gap-4">
          <h2 className="text-xl font-bold tracking-tight">QML Templates</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {SAMPLE_QML_NOTEBOOKS.map((template) => (
              <div 
                key={template.id} 
                className={cn(
                  "p-6 rounded-2xl border shadow-sm flex flex-col gap-3 transition-colors",
                  theme === 'dark' ? "bg-zinc-900/50 border-white/10 hover:bg-zinc-900" : "bg-white border-zinc-200 hover:bg-zinc-50"
                )}
              >
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <h3 className="font-semibold text-lg">{template.title}</h3>
                    <p className={cn("text-sm mt-1", theme === 'dark' ? "text-zinc-400" : "text-zinc-600")}>
                      {template.description}
                    </p>
                  </div>
                  <button
                    onClick={() => handleLoadTemplate(template)}
                    disabled={creating}
                    className="px-4 py-2 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white rounded-lg font-medium transition-colors text-sm whitespace-nowrap"
                  >
                    Load Template
                  </button>
                </div>
                <div className="flex gap-2 flex-wrap mt-2">
                  {template.tags.map(tag => (
                    <span key={tag} className={cn(
                      "text-xs px-2 py-1 rounded-full",
                      theme === 'dark' ? "bg-white/10 text-zinc-300" : "bg-zinc-100 text-zinc-700"
                    )}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <h2 className="text-xl font-bold tracking-tight mt-4">Your Notebooks</h2>

        {error && (
          <div className="p-4 bg-red-100/10 border border-red-500/20 text-red-500 rounded-lg">{error}</div>
        )}

        {loading && notebooks.length === 0 && (
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

        {!loading && notebooks.length === 0 && (
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
            <p className="text-lg font-medium">No notebooks yet</p>
            <p className={cn("text-sm", theme === 'dark' ? "text-zinc-400" : "text-zinc-600")}>
              Create your first notebook to start running code.
            </p>
          </motion.div>
        )}

        {notebooks.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
            {notebooks.map((notebook) => (
              <NotebookTile key={notebook.id} notebook={notebook} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default QBookLibraryPage;
