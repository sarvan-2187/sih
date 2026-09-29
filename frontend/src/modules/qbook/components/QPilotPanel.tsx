import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { FaPaperPlane } from 'react-icons/fa';
import { Sparkles, X } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';
import type { QPilotError, QPilotResult } from '../types';

// No @tailwindcss/typography plugin registered in this project (checked
// index.css — only tailwindcss-animate is) so `prose` classes are a no-op
// here; styled explicitly instead via arbitrary-variant selectors on the
// wrapper, same effect without the extra dependency.
const MARKDOWN_CLASSES = cn(
  "text-sm [&_p]:mb-2 last:[&_p]:mb-0 [&_strong]:font-semibold",
  "[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-2 [&_li]:mb-1",
  "[&_code]:font-mono [&_code]:text-xs [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded",
  "[&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:p-3 [&_pre]:my-2",
  "[&_h1]:font-semibold [&_h1]:mb-2 [&_h2]:font-semibold [&_h2]:mb-2 [&_h3]:font-semibold [&_h3]:mb-1",
);

interface QPilotPanelProps {
  error: QPilotError | null;
  onAsk: (instruction: string) => Promise<QPilotResult>;
  onApply: (newCode: string) => void;
  onClose: () => void;
}

export const QPilotPanel: React.FC<QPilotPanelProps> = ({ error, onAsk, onApply, onClose }) => {
  const { theme } = useTheme();
  const [instruction, setInstruction] = useState(error ? 'Explain this error and suggest a fix' : '');
  const [asking, setAsking] = useState(false);
  const [result, setResult] = useState<QPilotResult | null>(null);
  const [askError, setAskError] = useState<string | null>(null);

  const handleAsk = async () => {
    const trimmed = instruction.trim();
    if (!trimmed || asking) return;
    setAsking(true);
    setAskError(null);
    try {
      setResult(await onAsk(trimmed));
    } catch (err: any) {
      setAskError(err.response?.data?.detail || err.message || 'Qrious Code failed to respond.');
    } finally {
      setAsking(false);
    }
  };

  const handleApply = () => {
    if (!result?.suggested_code) return;
    onApply(result.suggested_code);
  };

  return (
    <div className={cn(
      "rounded-xl border p-4 flex flex-col gap-3",
      theme === 'dark' ? "bg-black/40 border-white/10" : "bg-zinc-50 border-zinc-200",
    )}>
      <div className="flex items-center justify-between">
        <div className={cn("flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider", theme === 'dark' ? "text-emerald-400" : "text-emerald-600")}>
          <Sparkles className="w-3.5 h-3.5" /> Qrious Code
        </div>
        <button
          onClick={onClose}
          className={cn("w-6 h-6 rounded-lg flex items-center justify-center transition-colors", theme === 'dark' ? "text-zinc-500 hover:text-white" : "text-zinc-400 hover:text-zinc-900")}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {result && (
        <div className={cn(
          "rounded-2xl px-4 py-3 break-words",
          MARKDOWN_CLASSES,
          theme === 'dark'
            ? "bg-black/60 border border-white/10 text-zinc-100 [&_code]:bg-white/10"
            : "bg-white border border-zinc-200 text-zinc-900 [&_code]:bg-black/5",
        )}>
          <ReactMarkdown>{result.explanation}</ReactMarkdown>
        </div>
      )}

      {result?.suggested_code && (
        <div className="flex flex-col gap-2">
          <pre className={cn(
            "whitespace-pre-wrap font-mono text-xs p-4 rounded-lg overflow-x-auto",
            theme === 'dark' ? "bg-black/60 border border-white/10 text-zinc-200" : "bg-white border border-zinc-200 text-zinc-800",
          )}>
            {result.suggested_code}
          </pre>
          <button
            onClick={handleApply}
            className="px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-xs font-medium hover:bg-emerald-600 transition-colors w-fit"
          >
            Replace cell code
          </button>
        </div>
      )}

      {askError && <div className="text-xs text-red-500">{askError}</div>}

      <div className="flex items-center gap-2">
        <input
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAsk(); } }}
          placeholder="Ask Qrious Code about this code…"
          disabled={asking}
          className={cn(
            "flex-1 rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500/40 disabled:opacity-50",
            theme === 'dark' ? "bg-black border-white/10 placeholder:text-zinc-500 text-white" : "bg-white border-zinc-200 text-zinc-900",
          )}
        />
        <button
          onClick={handleAsk}
          disabled={asking || !instruction.trim()}
          title="Ask"
          className="w-9 h-9 shrink-0 rounded-lg bg-emerald-500 text-white flex items-center justify-center hover:bg-emerald-600 transition-colors disabled:opacity-50"
        >
          <FaPaperPlane className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};
