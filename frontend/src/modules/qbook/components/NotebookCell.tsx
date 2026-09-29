import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { FaArrowDown, FaArrowUp, FaPaperPlane, FaPlay, FaSpinner, FaTrash } from 'react-icons/fa';
import { Sparkles } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';
import { MonacoEditorPanel } from '@/modules/gates-playground/components/MonacoEditorPanel';
import { useQBookApi } from '../hooks/useQBookApi';
import { QPilotPanel } from './QPilotPanel';
import type { NotebookCell as NotebookCellType, NotebookCellOutput, QPilotError } from '../types';

export interface PendingInput {
  prompt: string;
  password: boolean;
}

/** Inline stand-in for a terminal prompt — shown while the kernel is blocked on
 * an input()/getpass() call inside this cell (see useQBookKernelSocket's
 * onInputRequest / sendInputReply). The cell can't produce any more output
 * until this is answered, so it renders right where the next output would go.
 */
function InputPromptForm({ pendingInput, onSubmit }: { pendingInput: PendingInput; onSubmit: (value: string) => void }) {
  const { theme } = useTheme();
  const [value, setValue] = useState('');

  const submit = () => {
    onSubmit(value);
    setValue('');
  };

  return (
    <div className={cn(
      "flex items-center gap-2 px-4 py-3 rounded-xl border font-mono text-xs",
      theme === 'dark' ? "bg-amber-500/10 border-amber-500/30" : "bg-amber-50 border-amber-300",
    )}>
      <span className="opacity-80 shrink-0">{pendingInput.prompt || 'Input requested:'}</span>
      <input
        type={pendingInput.password ? 'password' : 'text'}
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
        className="flex-1 min-w-0 bg-transparent outline-none border-b border-current/30 focus:border-current"
      />
      <button onClick={submit} className="shrink-0 hover:opacity-70" title="Send">
        <FaPaperPlane className="w-3 h-3" />
      </button>
    </div>
  );
}

function OutputBlock({ output }: { output: NotebookCellOutput }) {
  if (output.output_type === 'error') {
    return (
      <pre className="whitespace-pre-wrap font-mono text-xs p-4 bg-red-100/10 border border-red-500/20 text-red-500 rounded-lg">
        {output.ename}: {output.evalue}
        {output.traceback ? `\n${output.traceback.join('\n')}` : ''}
      </pre>
    );
  }
  if (output.output_type === 'stream') {
    return <pre className="whitespace-pre-wrap font-mono text-xs">{output.text}</pre>;
  }
  if (output.output_type === 'execute_result' || output.output_type === 'display_data') {
    const data = output.data || {};
    if (data['image/png']) {
      return (
        <img
          src={`data:image/png;base64,${data['image/png']}`}
          alt="Cell output"
          className="max-w-full max-h-105 w-auto rounded-lg mx-auto block"
        />
      );
    }
    if (data['text/plain']) {
      return <pre className="whitespace-pre-wrap font-mono text-xs">{data['text/plain']}</pre>;
    }
  }
  return null;
}

interface NotebookCellProps {
  cell: NotebookCellType;
  notebookId: string;
  running: boolean;
  onChangeSource: (source: string) => void;
  onRun: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onChangeCellType: (cellType: 'code' | 'markdown') => void;
  pendingInput?: PendingInput | null;
  onSubmitInput?: (value: string) => void;
}

export const NotebookCell: React.FC<NotebookCellProps> = ({
  cell, notebookId, running, onChangeSource, onRun, onDelete, onMoveUp, onMoveDown, onChangeCellType,
  pendingInput, onSubmitInput,
}) => {
  const { theme } = useTheme();
  const { askQPilot } = useQBookApi();
  const [editingMarkdown, setEditingMarkdown] = useState(cell.source.length === 0);
  const [qpilotOpen, setQpilotOpen] = useState(false);

  const lastError = cell.outputs.find((o) => o.output_type === 'error');
  const qpilotError: QPilotError | null = lastError
    ? { ename: lastError.ename || 'Error', evalue: lastError.evalue || '', traceback: lastError.traceback || [] }
    : null;

  return (
    <div className="flex gap-3 group">
      <div className="flex flex-col items-center gap-2 pt-1 w-10 shrink-0">
        {cell.cell_type === 'code' && (
          <button
            onClick={onRun}
            disabled={running}
            title="Run cell"
            className={cn(
              "w-8 h-8 rounded-lg border flex items-center justify-center transition-colors disabled:opacity-60",
              theme === 'dark'
                ? "bg-zinc-950/50 border-white/10 hover:border-emerald-500/50"
                : "bg-white border-zinc-200 hover:border-emerald-500/30",
            )}
          >
            {running
              ? <FaSpinner className="w-3 h-3 animate-spin text-emerald-500" />
              : <FaPlay className="w-3 h-3 text-emerald-500" />}
          </button>
        )}
        <span className={cn("text-[10px] font-mono", theme === 'dark' ? "text-zinc-500" : "text-zinc-400")}>
          {cell.cell_type === 'code' ? `[${cell.execution_count ?? ' '}]` : 'md'}
        </span>
      </div>

      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <div className={cn("rounded-xl border overflow-hidden", theme === 'dark' ? "border-white/10" : "border-zinc-200")}>
          {cell.cell_type === 'code' ? (
            <MonacoEditorPanel
              code={cell.source}
              onChange={(value) => onChangeSource(value || '')}
              autoHeight
            />
          ) : editingMarkdown ? (
            <textarea
              className={cn(
                "w-full min-h-[6rem] p-4 font-mono text-sm resize-y outline-none",
                theme === 'dark' ? "bg-zinc-950/50 text-white" : "bg-white text-zinc-900",
              )}
              value={cell.source}
              onChange={(e) => onChangeSource(e.target.value)}
              onBlur={() => setEditingMarkdown(false)}
              autoFocus
              placeholder="Write markdown..."
            />
          ) : (
            <div
              className={cn("p-4 text-sm leading-relaxed cursor-text", theme === 'dark' ? "text-zinc-300" : "text-zinc-700")}
              onClick={() => setEditingMarkdown(true)}
            >
              <ReactMarkdown>{cell.source || '*Empty markdown cell — click to edit*'}</ReactMarkdown>
            </div>
          )}
        </div>

        {cell.outputs.length > 0 && (
          <div className={cn(
            "rounded-xl border p-4 overflow-x-auto flex flex-col gap-2",
            theme === 'dark' ? "bg-black/40 border-white/10" : "bg-zinc-50 border-zinc-200",
          )}>
            {cell.outputs.map((output, idx) => <OutputBlock key={idx} output={output} />)}
          </div>
        )}

        {pendingInput && onSubmitInput && (
          <InputPromptForm pendingInput={pendingInput} onSubmit={onSubmitInput} />
        )}

        {qpilotOpen && cell.cell_type === 'code' && (
          <QPilotPanel
            error={qpilotError}
            onAsk={(instruction) => askQPilot(notebookId, { code: cell.source, instruction, error: qpilotError })}
            onApply={(newCode) => { onChangeSource(newCode); setQpilotOpen(false); }}
            onClose={() => setQpilotOpen(false)}
          />
        )}

        <div className={cn(
          "flex gap-4 opacity-0 group-hover:opacity-100 transition-opacity text-xs",
          theme === 'dark' ? "text-zinc-500" : "text-zinc-400",
        )}>
          {cell.cell_type === 'code' && (
            <button onClick={() => setQpilotOpen((prev) => !prev)} className="hover:text-emerald-500 flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Ask Qrious Code
            </button>
          )}
          <button onClick={onMoveUp} className="hover:text-emerald-500 flex items-center gap-1">
            <FaArrowUp className="w-3 h-3" /> Move up
          </button>
          <button onClick={onMoveDown} className="hover:text-emerald-500 flex items-center gap-1">
            <FaArrowDown className="w-3 h-3" /> Move down
          </button>
          <button
            onClick={() => onChangeCellType(cell.cell_type === 'code' ? 'markdown' : 'code')}
            className="hover:text-emerald-500"
          >
            Convert to {cell.cell_type === 'code' ? 'markdown' : 'code'}
          </button>
          <button onClick={onDelete} className="hover:text-red-400 flex items-center gap-1 ml-auto">
            <FaTrash className="w-3 h-3" /> Delete
          </button>
        </div>
      </div>
    </div>
  );
};
