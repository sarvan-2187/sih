import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FaArrowLeft, FaCircle, FaDownload, FaFilePdf, FaPlus } from 'react-icons/fa';
import { useTheme } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { useQBookApi } from '../hooks/useQBookApi';
import { useQBookKernelSocket } from '../hooks/useQBookKernelSocket';
import type { KernelStatus } from '../hooks/useQBookKernelSocket';
import { NotebookCell } from '../components/NotebookCell';
import { DatasetManagerPanel } from '../components/DatasetManagerPanel';
import type { Notebook, NotebookCell as NotebookCellType, NotebookCellOutput } from '../types';

const KERNEL_STATUS_COPY: Record<KernelStatus, string> = {
  idle: 'Kernel idle',
  connecting: 'Connecting to kernel…',
  connected: 'Kernel connected',
  error: 'Kernel unreachable',
};

const KernelStatusBadge: React.FC<{ status: KernelStatus; message: string | null }> = ({ status, message }) => {
  const { theme } = useTheme();
  const dotColor = {
    idle: theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400',
    connecting: 'text-amber-500',
    connected: 'text-emerald-500',
    error: 'text-red-500',
  }[status];

  return (
    <div
      title={message || undefined}
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium w-fit",
        theme === 'dark' ? "bg-zinc-950/50 border-white/10 text-zinc-300" : "bg-white border-zinc-200 text-zinc-600",
      )}
    >
      <FaCircle className={cn("w-2 h-2", dotColor, status === 'connecting' && 'animate-pulse')} />
      {KERNEL_STATUS_COPY[status]}
    </div>
  );
};

const QBookEditorPage: React.FC = () => {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const { notebookId } = useParams<{ notebookId: string }>();
  const { getNotebook, updateNotebook, exportNotebook, exportNotebookPdf, error } = useQBookApi();
  const { runCell, attachDataset, sendInputReply, status: kernelStatus, statusMessage: kernelStatusMessage } = useQBookKernelSocket(notebookId || '');

  const [notebook, setNotebookState] = useState<Notebook | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [runningCellId, setRunningCellId] = useState<string | null>(null);
  // Only one cell can run (and hold the kernel's stdin) at a time, so a single
  // slot is enough — mirrors runningCellId above.
  const [inputRequest, setInputRequest] = useState<{ cellId: string; prompt: string; password: boolean } | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mirrors `notebook` synchronously (unlike the state variable, which only updates
  // on the next render). Needed because a cell run fires onOutput and onDone in
  // quick succession — often the same JS tick, since the server sends "output"
  // then "execution_done" back to back over one WebSocket — and reading `notebook`
  // from a closure in both handlers meant the second call always saw pre-first-call
  // state, silently reverting outputs back to empty right after they'd just been
  // set. Live-reproduced: a cell showed a correct execution_count with no output
  // box below it, every time.
  const notebookRef = useRef<Notebook | null>(null);

  const setNotebook = (next: Notebook) => {
    notebookRef.current = next;
    setNotebookState(next);
  };

  useEffect(() => {
    if (!notebookId) return;
    getNotebook(notebookId).then(setNotebook).catch((err) => setLoadError(err.message));
  }, [notebookId]); // eslint-disable-line react-hooks/exhaustive-deps

  const persistCells = async (cells: NotebookCellType[]) => {
    if (!notebookId) return;
    try {
      await updateNotebook(notebookId, { cells });
    } catch (err) {
      console.error(err);
    }
  };

  const scheduleSave = (cells: NotebookCellType[]) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => { persistCells(cells); }, 800);
  };

  const updateCellAndGetCells = (cellId: string, patch: Partial<NotebookCellType>) => {
    const current = notebookRef.current;
    if (!current) return null;
    const nextCells = current.cells.map((c) => (c.id === cellId ? { ...c, ...patch } : c));
    setNotebook({ ...current, cells: nextCells });
    return nextCells;
  };

  const handleChangeSource = (cellId: string, source: string) => {
    const nextCells = updateCellAndGetCells(cellId, { source });
    if (nextCells) scheduleSave(nextCells);
  };

  const handleChangeCellType = (cellId: string, cellType: 'code' | 'markdown') => {
    const nextCells = updateCellAndGetCells(cellId, { cell_type: cellType });
    if (nextCells) persistCells(nextCells);
  };

  const handleRunCell = (cellId: string) => {
    const current = notebookRef.current;
    if (!current) return;
    const cell = current.cells.find((c) => c.id === cellId);
    if (!cell) return;

    updateCellAndGetCells(cellId, { outputs: [] });
    setRunningCellId(cellId);
    setInputRequest(null);
    const collected: NotebookCellOutput[] = [];

    runCell(cellId, cell.source, {
      onOutput: (output) => {
        collected.push(output);
        updateCellAndGetCells(cellId, { outputs: [...collected] });
      },
      onDone: (executionCount) => {
        setRunningCellId(null);
        setInputRequest(null);
        const nextCells = updateCellAndGetCells(cellId, { execution_count: executionCount, outputs: [...collected] });
        if (nextCells) persistCells(nextCells);
      },
      onTimeout: () => {
        setInputRequest(null);
        collected.push({
          output_type: 'error',
          ename: 'TimeoutError',
          evalue: 'This cell took too long and was interrupted.',
        });
        updateCellAndGetCells(cellId, { outputs: [...collected] });
      },
      onError: (message) => {
        setRunningCellId(null);
        setInputRequest(null);
        collected.push({ output_type: 'error', ename: 'ConnectionError', evalue: message });
        const nextCells = updateCellAndGetCells(cellId, { outputs: [...collected] });
        if (nextCells) persistCells(nextCells);
      },
      onInputRequest: (prompt, password) => {
        setInputRequest({ cellId, prompt, password });
      },
    });
  };

  const handleSubmitInput = (value: string) => {
    if (!inputRequest) return;
    sendInputReply(inputRequest.cellId, value);
    setInputRequest(null);
  };

  const handleDeleteCell = (cellId: string) => {
    const current = notebookRef.current;
    if (!current) return;
    const nextCells = current.cells.filter((c) => c.id !== cellId);
    setNotebook({ ...current, cells: nextCells });
    persistCells(nextCells);
  };

  const handleAddCell = (cellType: 'code' | 'markdown' = 'code') => {
    const current = notebookRef.current;
    if (!current) return;
    const newCell: NotebookCellType = {
      id: crypto.randomUUID(),
      cell_type: cellType,
      source: '',
      outputs: [],
      execution_count: null,
    };
    const nextCells = [...current.cells, newCell];
    setNotebook({ ...current, cells: nextCells });
    persistCells(nextCells);
  };

  const handleMoveCell = (cellId: string, direction: 'up' | 'down') => {
    const current = notebookRef.current;
    if (!current) return;
    const idx = current.cells.findIndex((c) => c.id === cellId);
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (idx === -1 || targetIdx < 0 || targetIdx >= current.cells.length) return;
    const nextCells = [...current.cells];
    [nextCells[idx], nextCells[targetIdx]] = [nextCells[targetIdx], nextCells[idx]];
    setNotebook({ ...current, cells: nextCells });
    persistCells(nextCells);
  };

  const handleTitleChange = (title: string) => {
    const current = notebookRef.current;
    if (!current) return;
    setNotebook({ ...current, title });
  };

  const handleTitleBlur = () => {
    if (!notebook || !notebookId) return;
    updateNotebook(notebookId, { title: notebook.title }).catch(console.error);
  };

  if (loadError || error) {
    return (
      <div className={cn(
        "w-full h-full transition-colors duration-300 py-12 px-6 md:px-12",
        theme === 'dark' ? "text-white" : "text-zinc-900",
      )}>
        <div className="max-w-3xl mx-auto p-4 bg-red-100/10 border border-red-500/20 text-red-500 rounded-lg">
          {loadError || error}
        </div>
      </div>
    );
  }

  if (!notebook) {
    return (
      <div className={cn(
        "w-full h-full flex items-center justify-center transition-colors duration-300",
        theme === 'dark' ? "text-white" : "text-zinc-900",
      )}>
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className={cn(
      "w-full h-full transition-colors duration-300 py-12 px-6 md:px-12",
      theme === 'dark' ? "text-white" : "text-zinc-900",
    )}>
      <div className="max-w-4xl mx-auto flex flex-col gap-8">
        <div className="flex flex-col gap-4">
          <button
            onClick={() => navigate('/qbook')}
            className={cn(
              "flex items-center gap-2 text-sm w-fit transition-colors",
              theme === 'dark' ? "text-zinc-400 hover:text-white" : "text-zinc-500 hover:text-zinc-900",
            )}
          >
            <FaArrowLeft className="w-3 h-3" /> My Notebooks
          </button>

          <KernelStatusBadge status={kernelStatus} message={kernelStatusMessage} />

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <motion.input
              className="text-3xl md:text-4xl font-sans tracking-tight bg-transparent outline-none border-b border-transparent focus:border-emerald-500 transition-colors"
              value={notebook.title}
              onChange={(e) => handleTitleChange(e.target.value)}
              onBlur={handleTitleBlur}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            />

            <div className="flex items-center gap-2">
              <button
                onClick={() => exportNotebook(notebook.id, notebook.title)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors text-sm border w-fit",
                  theme === 'dark'
                    ? "bg-zinc-950/50 border-white/10 hover:border-emerald-500/50"
                    : "bg-white border-zinc-200 hover:border-emerald-500/30",
                )}
              >
                <FaDownload className="w-3.5 h-3.5" /> Export .ipynb
              </button>

              <button
                onClick={() => exportNotebookPdf(notebook.id, notebook.title)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors text-sm border w-fit",
                  theme === 'dark'
                    ? "bg-zinc-950/50 border-white/10 hover:border-emerald-500/50"
                    : "bg-white border-zinc-200 hover:border-emerald-500/30",
                )}
              >
                <FaFilePdf className="w-3.5 h-3.5" /> Export PDF
              </button>
            </div>
          </div>
        </div>

        <DatasetManagerPanel attachDataset={attachDataset} />

        <div className="flex flex-col gap-6">
          {notebook.cells.map((cell) => (
            <NotebookCell
              key={cell.id}
              cell={cell}
              notebookId={notebook.id}
              running={runningCellId === cell.id}
              onChangeSource={(source) => handleChangeSource(cell.id, source)}
              onRun={() => handleRunCell(cell.id)}
              onDelete={() => handleDeleteCell(cell.id)}
              onMoveUp={() => handleMoveCell(cell.id, 'up')}
              onMoveDown={() => handleMoveCell(cell.id, 'down')}
              onChangeCellType={(cellType) => handleChangeCellType(cell.id, cellType)}
              pendingInput={inputRequest?.cellId === cell.id ? inputRequest : null}
              onSubmitInput={handleSubmitInput}
            />
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => handleAddCell('code')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors text-sm border",
              theme === 'dark'
                ? "bg-zinc-950/50 border-white/10 hover:border-emerald-500/50"
                : "bg-white border-zinc-200 hover:border-emerald-500/30",
            )}
          >
            <FaPlus className="w-3.5 h-3.5" /> Code cell
          </button>
          <button
            onClick={() => handleAddCell('markdown')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors text-sm border",
              theme === 'dark'
                ? "bg-zinc-950/50 border-white/10 hover:border-emerald-500/50"
                : "bg-white border-zinc-200 hover:border-emerald-500/30",
            )}
          >
            <FaPlus className="w-3.5 h-3.5" /> Markdown cell
          </button>
        </div>
      </div>
    </div>
  );
};

export default QBookEditorPage;
