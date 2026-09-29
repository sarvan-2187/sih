import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Laptop } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';

const QStudioLocalOnlyPage: React.FC = () => {
  const { theme } = useTheme();

  return (
    <div className={cn(
      "w-full h-full flex items-center justify-center p-6 text-center transition-colors duration-300",
      theme === 'dark' ? "text-white" : "text-zinc-900",
    )}>
      <div className="max-w-md flex flex-col items-center gap-4">
        <div className={cn(
          "w-16 h-16 rounded-2xl border flex items-center justify-center",
          theme === 'dark' ? "bg-zinc-950/50 border-white/10 text-emerald-400" : "bg-white border-zinc-200 text-emerald-600",
        )}>
          <Laptop className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-sans tracking-tight">QStudio is a local-only feature</h1>
        <p className={cn("text-sm leading-relaxed", theme === 'dark' ? "text-zinc-400" : "text-zinc-600")}>
          QStudio depends on rendering and indexing services that aren't deployed to a cloud host yet.
          Run Qrious locally to use Sources, Q&amp;A, and Studio outputs.
        </p>
        <Link
          to="/"
          className={cn(
            "mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-colors",
            theme === 'dark' ? "bg-zinc-950/50 border-white/10 text-zinc-300 hover:text-white" : "bg-white border-zinc-200 text-zinc-700 hover:text-zinc-900",
          )}
        >
          <ArrowLeft className="w-4 h-4" /> Return home
        </Link>
      </div>
    </div>
  );
};

export default QStudioLocalOnlyPage;
