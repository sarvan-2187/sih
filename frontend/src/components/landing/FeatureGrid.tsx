import { GripHorizontal, Library, Globe, Bot, LayoutTemplate, Trophy } from 'lucide-react';
import BlochSphereCanvas from './BlochSphereCanvas';
import { useTheme } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

const features = [
  { icon: GripHorizontal, label: 'Gates & Code Playground', desc: 'drag-and-drop circuit builder' },
  { icon: Library, label: 'Algorithm Explorer', desc: 'guided walkthroughs of real algorithms' },
  { icon: Globe, label: 'Bloch Sphere Explorer', desc: '3D state visualization' },
  { icon: Bot, label: 'AI Quantum Tutor', desc: 'RAG chatbot, context-aware explanations' },
  { icon: LayoutTemplate, label: 'Learning Hub', desc: 'quizzes, flashcards, personal notes' },
  { icon: Trophy, label: 'Gamified Challenges', desc: 'gate puzzles, badges, streaks' },
];

export default function FeatureGrid() {
  const { theme } = useTheme();

  return (
    <section id="features" className={cn(
      "py-32 rounded-[1.5rem] md:rounded-[2.5rem] mt-4 px-6 md:px-16 w-full overflow-hidden relative transition-colors duration-300",
      theme === 'dark' ? "bg-zinc-950/50 text-white" : "bg-zinc-100 text-zinc-900"
    )}>
      <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24">
        
        {/* Left Column */}
        <div className="flex flex-col relative">
          <div className="lg:sticky lg:top-32 space-y-12">
            <motion.h2 
              className="text-4xl md:text-5xl font-sans tracking-[-0.05em] leading-tight"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6 }}
            >
              Everything you need to learn quantum, hands-on.
            </motion.h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-12">
              {features.map((feature, idx) => (
                <motion.div 
                  key={idx} 
                  className="flex flex-col gap-3 group"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.5, delay: idx * 0.1 }}
                >
                  <div className={cn(
                    "w-12 h-12 rounded-2xl border flex items-center justify-center shadow-sm transition-transform duration-300 group-hover:scale-105 group-hover:text-emerald-500",
                    theme === 'dark' ? "bg-black border-white/10 text-zinc-400 group-hover:border-emerald-500/50" : "bg-white border-zinc-200 text-zinc-700"
                  )}>
                    <feature.icon className="w-6 h-6" />
                  </div>
                  <div>
                    <div className={cn("font-semibold text-lg", theme === 'dark' ? "text-white" : "text-zinc-900")}>
                      {feature.label}
                    </div>
                    <div className={cn("text-sm leading-relaxed mt-1", theme === 'dark' ? "text-zinc-400" : "text-zinc-500")}>
                      {feature.desc}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <motion.div 
          className="flex items-center justify-center"
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
        >
          <div className={cn(
            "relative w-full aspect-square max-h-[700px] rounded-[2rem] overflow-hidden shadow-2xl transition-transform duration-500 hover:scale-[1.05] group border",
            theme === 'dark' ? "bg-black border-white/10" : "bg-zinc-950 border-transparent"
          )}>
            
            <div className="absolute inset-0 opacity-80 transition-opacity duration-500 group-hover:opacity-100">
              <BlochSphereCanvas />
            </div>

            {/* Internal floating glass panel */}
            <div className="absolute bottom-8 left-8 right-8 rounded-[1.5rem] p-6 border border-white/10"
              style={{
                background: 'rgba(255,255,255,0.08)',
                backdropFilter: 'blur(20px)'
              }}
            >
              <h3 className="text-white font-medium text-lg mb-4">Circuit Analysis</h3>
              <div className="flex flex-col gap-4">
                <div className="flex justify-between text-sm text-white/70">
                  <span>Qubit Count: 3</span>
                  <span>Gate Depth: 8</span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-4">
                    <div className="w-12 text-xs text-white/50">|000⟩</div>
                    <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-400 rounded-full" style={{ width: '45%' }} />
                    </div>
                    <div className="w-8 text-xs text-right text-emerald-400">45%</div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-12 text-xs text-white/50">|101⟩</div>
                    <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-400 rounded-full" style={{ width: '25%' }} />
                    </div>
                    <div className="w-8 text-xs text-right text-emerald-400">25%</div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-12 text-xs text-white/50">|111⟩</div>
                    <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-400 rounded-full" style={{ width: '30%' }} />
                    </div>
                    <div className="w-8 text-xs text-right text-emerald-400">30%</div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </motion.div>

      </div>
    </section>
  );
}
