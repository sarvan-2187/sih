import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';
import { PageHero, PageShell } from '@/components/explorer';

export const QForgeLandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <PageShell width="reading">
      <PageHero
        title="QForge Hardware Simulator"
        subtitle="Step into the lab. Assemble a superconducting quantum computer stage-by-stage, manage thermal budgets, and ensure signal integrity before cooling down to 10 mK."
      />
      <div className="flex flex-col gap-8">
        
        <div 
          className={cn(
            "p-8 border rounded-2xl transition-all cursor-pointer shadow-sm hover:shadow-md",
            isDark 
              ? "bg-zinc-900/50 border-zinc-800 hover:border-emerald-500/50 hover:bg-zinc-900" 
              : "bg-white border-zinc-200 hover:border-emerald-500/30 hover:bg-emerald-50/30"
          )}
          onClick={() => navigate('/qforge/builder')}
        >
          <h2 className="text-2xl font-semibold text-emerald-600 dark:text-emerald-400 mb-2">Start a New Build</h2>
          <p className={isDark ? "text-zinc-400" : "text-zinc-600"}>
            Configure a Contralto-A 17-qubit QPU in a Bluefors LD450sl cryostat.
          </p>
        </div>
      </div>
    </PageShell>
  );
};

export default QForgeLandingPage;
