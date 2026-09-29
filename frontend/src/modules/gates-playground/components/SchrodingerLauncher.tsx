import React, { useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { SchrodingerCat } from './SchrodingerCat';
import { useTheme } from '@/context/ThemeContext';

interface SchrodingerLauncherProps {
  onClick: () => void;
  isOpen: boolean;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
}

export const SchrodingerLauncher: React.FC<SchrodingerLauncherProps> = ({ onClick, isOpen, anchorRef }) => {
  const { theme } = useTheme();
  const [isAnimating, setIsAnimating] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  const handleClick = () => {
    if (isOpen || isAnimating) return;
    
    setIsAnimating(true);
    
    // Slight delay to allow crouch/reaction animation before layout shift
    setTimeout(() => {
      onClick();
      setIsAnimating(false);
    }, shouldReduceMotion ? 50 : 350);
  };

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <button
            ref={anchorRef}
            onClick={handleClick}
            className={cn(
              "relative pointer-events-auto rounded-3xl group outline-none transition-all duration-300 active:scale-95 cursor-pointer p-[1px]",
              theme === 'dark'
                ? "bg-gradient-to-br from-white/20 via-emerald-500/25 to-white/5 hover:from-emerald-400/60 hover:via-teal-400/50 hover:to-emerald-500/60 shadow-[0_8px_25px_rgba(0,0,0,0.6)]"
                : "bg-gradient-to-br from-zinc-300 via-emerald-500/35 to-zinc-200 hover:from-emerald-500/60 hover:to-teal-500/60 shadow-lg shadow-zinc-300/50",
              isOpen 
                ? "opacity-0 pointer-events-none scale-90" 
                : "opacity-100 scale-100"
            )}
            disabled={isOpen || isAnimating}
            aria-label="Open Qrious Code"
          >
            {/* Ambient quantum background aura glow on hover */}
            <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-emerald-500/25 via-teal-500/20 to-purple-500/20 blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

            {/* Inner dark card container */}
            <div className={cn(
              "relative flex items-center justify-center p-3.5 rounded-[23px] transition-colors duration-300",
              theme === 'dark' ? "bg-zinc-950/90 group-hover:bg-zinc-900/90" : "bg-white group-hover:bg-zinc-50"
            )}>
              <div className="w-10 h-10 flex items-center justify-center relative shrink-0 -translate-y-0.5">
                <SchrodingerCat state={isAnimating ? "hover" : "idle"} className="w-9 h-9" />
              </div>
            </div>
          </button>
        </TooltipTrigger>
        <TooltipContent className={cn(
          "text-xs font-medium border shadow-xl",
          theme === 'dark' ? "bg-zinc-900 text-zinc-100 border-zinc-700" : "bg-white text-zinc-900 border-zinc-200"
        )}>
          <p>Open Qrious Code</p>
          <p className={cn("text-[10px]", theme === 'dark' ? "text-zinc-400" : "text-zinc-500")}>Schrödinger is ready to help</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

