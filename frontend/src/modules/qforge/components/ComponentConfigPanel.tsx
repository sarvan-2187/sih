import React from 'react';
import { useTheme } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';
import type { ComponentSpec } from '../constants/components';

interface ComponentConfigPanelProps {
  spec: ComponentSpec;
  onClose: () => void;
}

export const ComponentConfigPanel: React.FC<ComponentConfigPanelProps> = ({ spec, onClose }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div className={cn(
      "absolute inset-y-0 right-0 w-80 border-l p-6 shadow-2xl flex flex-col z-50 transition-colors duration-300",
      isDark ? "bg-zinc-900 border-zinc-800 text-zinc-100" : "bg-white border-zinc-200 text-zinc-900"
    )}>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{spec.name}</h2>
        <button onClick={onClose} className={cn("hover:opacity-70 transition-opacity", isDark ? "text-zinc-400" : "text-zinc-500")}>✕</button>
      </div>
      
      <div className="space-y-4 flex-1 overflow-y-auto">
        <div>
          <h3 className={cn("text-xs uppercase tracking-wider mb-1 font-semibold", isDark ? "text-zinc-500" : "text-zinc-400")}>Description</h3>
          <p className={cn("text-sm", isDark ? "text-zinc-300" : "text-zinc-700")}>{spec.description}</p>
        </div>
        
        <div>
          <h3 className={cn("text-xs uppercase tracking-wider mb-1 font-semibold", isDark ? "text-zinc-500" : "text-zinc-400")}>Valid Stages</h3>
          <div className="flex gap-1 flex-wrap">
            {spec.validStages.map(s => (
              <span key={s} className={cn("px-2 py-1 rounded text-xs border font-mono", isDark ? "bg-zinc-800 border-zinc-700 text-zinc-300" : "bg-zinc-100 border-zinc-200 text-zinc-700")}>
                {s}
              </span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {spec.attenuationDb !== undefined && (
            <div className={cn("p-3 rounded-lg border", isDark ? "bg-zinc-950 border-zinc-800" : "bg-zinc-50 border-zinc-200")}>
              <div className={cn("text-xs", isDark ? "text-zinc-500" : "text-zinc-500")}>Attenuation</div>
              <div className={cn("text-lg font-semibold", isDark ? "text-zinc-200" : "text-zinc-800")}>{spec.attenuationDb} dB</div>
            </div>
          )}
          {spec.gainDb !== undefined && (
            <div className={cn("p-3 rounded-lg border", isDark ? "bg-zinc-950 border-zinc-800" : "bg-zinc-50 border-zinc-200")}>
              <div className={cn("text-xs", isDark ? "text-zinc-500" : "text-zinc-500")}>Gain</div>
              <div className={cn("text-lg font-semibold", isDark ? "text-zinc-200" : "text-zinc-800")}>{spec.gainDb} dB</div>
            </div>
          )}
          {spec.noiseTempK !== undefined && (
            <div className={cn("p-3 rounded-lg border", isDark ? "bg-zinc-950 border-zinc-800" : "bg-zinc-50 border-zinc-200")}>
              <div className={cn("text-xs", isDark ? "text-zinc-500" : "text-zinc-500")}>Noise Temp</div>
              <div className={cn("text-lg font-semibold", isDark ? "text-zinc-200" : "text-zinc-800")}>{spec.noiseTempK} K</div>
            </div>
          )}
        </div>

        <div className={cn("mt-6 p-4 rounded-xl border", isDark ? "bg-zinc-950/60 border-zinc-800" : "bg-zinc-50 border-zinc-200")}>
          <h3 className="text-xs text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-2 font-semibold flex items-center gap-2">
            <span>📚</span> From the Source
          </h3>
          <p className={cn("text-xs italic font-sans leading-relaxed", isDark ? "text-zinc-400" : "text-zinc-600")}>"{spec.specSource}"</p>
        </div>
      </div>
    </div>
  );
};
