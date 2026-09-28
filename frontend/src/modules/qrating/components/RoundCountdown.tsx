import { useEffect, useState } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';
import { tone } from '@/components/explorer';

/** Seconds remaining, ticking locally from a server-provided starting point.
 *  Counting down in the browser avoids polling once per second. */
export function useCountdown(initialSeconds: number | undefined) {
  const [remaining, setRemaining] = useState(initialSeconds ?? 0);

  useEffect(() => {
    setRemaining(initialSeconds ?? 0);
  }, [initialSeconds]);

  useEffect(() => {
    if (remaining <= 0) return;
    const id = window.setInterval(() => setRemaining((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(id);
  }, [remaining > 0]);

  return remaining;
}

export function formatDuration(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  if (days > 0) return `${days}d ${pad(hours)}h ${pad(minutes)}m`;
  return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
}

interface RoundCountdownProps {
  seconds: number;
  label: string;
  urgent?: boolean;
}

export function RoundCountdown({ seconds, label, urgent }: RoundCountdownProps) {
  const { theme } = useTheme();
  return (
    <div className="flex flex-col gap-1">
      <span className={cn('text-xs uppercase tracking-widest', tone.muted(theme))}>{label}</span>
      <span
        className={cn(
          'font-mono text-2xl font-medium tabular-nums',
          urgent ? 'text-red-500' : 'text-emerald-500',
        )}
      >
        {formatDuration(seconds)}
      </span>
    </div>
  );
}
