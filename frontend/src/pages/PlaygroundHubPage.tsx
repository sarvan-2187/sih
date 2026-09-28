import React from 'react';
import { Link } from 'react-router-dom';
import { GripHorizontal, Terminal, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { PageHero, PageShell } from '@/components/explorer';
import { useTheme } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';

const PlaygroundHubPage: React.FC = () => {
  const { theme } = useTheme();

  const playgrounds = [
    {
      title: 'Gates Playground',
      desc: 'Build and simulate quantum circuits using a visual drag-and-drop editor.',
      href: '/playground/gates',
      icon: GripHorizontal,
    },
    {
      title: 'QForge Hardware Simulator',
      desc: 'Assemble a superconducting quantum computer stage-by-stage and manage thermal budgets.',
      href: '/qforge',
      icon: Terminal,
    },
  ];

  return (
    <PageShell>
      <PageHero
        title="Quantum Playground Hub"
        subtitle="Build circuits by hand, run code, forge a processor, or route a job to real hardware."
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl">
          {playgrounds.map((pg, idx) => (
            <Link key={idx} to={pg.href}>
              <motion.div 
                className={cn(
                  "p-8 rounded-[2rem] border overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 group flex flex-col h-full",
                  theme === 'dark' 
                    ? "bg-zinc-950/50 border-white/10 hover:border-emerald-500/50 hover:bg-white/5" 
                    : "bg-white border-zinc-200 hover:border-emerald-500/30"
                )}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: idx * 0.15 }}
              >
                <div className={cn(
                  "w-12 h-12 rounded-2xl border flex items-center justify-center mb-6 shadow-sm transition-transform duration-300 group-hover:scale-105 group-hover:text-emerald-500",
                  theme === 'dark' ? "bg-black border-white/10 text-zinc-400" : "bg-zinc-50 border-zinc-200 text-zinc-700"
                )}>
                  <pg.icon className="w-6 h-6" />
                </div>
                
                <h2 className="text-2xl font-semibold mb-3">{pg.title}</h2>
                <p className={cn(
                  "mb-8 flex-1 leading-relaxed",
                  theme === 'dark' ? "text-zinc-400" : "text-zinc-500"
                )}>
                  {pg.desc}
                </p>

                <div className="inline-flex items-center gap-2 text-emerald-500 font-medium transition-colors w-fit">
                  Launch <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </div>
              </motion.div>
            </Link>
          ))}
      </div>
    </PageShell>
  );
};

export default PlaygroundHubPage;
