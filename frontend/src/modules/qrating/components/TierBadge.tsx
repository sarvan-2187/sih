import { cn } from '@/lib/utils';

interface TierBadgeProps {
  tier: string;
  colour: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

/** Tier chip. The colour is served by the backend so one ladder drives every surface. */
export function TierBadge({ tier, colour, className, size = 'md' }: TierBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-semibold tracking-wide',
        size === 'sm' && 'px-2 py-0.5 text-[11px]',
        size === 'md' && 'px-2.5 py-1 text-xs',
        size === 'lg' && 'px-3.5 py-1.5 text-sm',
        className,
      )}
      style={{ color: colour, borderColor: `${colour}66`, backgroundColor: `${colour}1a` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: colour }} />
      {tier}
    </span>
  );
}
