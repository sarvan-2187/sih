/**
 * Explorer-style page primitives - the shared implementation of DESIGN_SYSTEM.md section 1.
 *
 * Before this module the page shell, hero and card patterns were copy-pasted across a dozen
 * files, which is why they had already drifted apart. Reference surfaces to match: qStudio
 * (QStudioLibraryPage), Roadmap (RoadmapPage) and Algorithm Explorer.
 *
 * These deliberately branch on useTheme() rather than Tailwind's `dark:` variant: theme here
 * is an app-level toggle (data-theme), not the OS preference. Accent is emerald in BOTH
 * themes. Do not use these on admin/educator surfaces - those are shadcn + semantic tokens
 * per DESIGN_SYSTEM.md section 2.
 */
import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';

type Theme = 'dark' | 'light' | string;

/** Text colour tokens from DESIGN_SYSTEM.md 1.3, so pages stop hand-rolling them. */
export const tone = {
  primary: (theme: Theme) => (theme === 'dark' ? 'text-white' : 'text-zinc-900'),
  secondary: (theme: Theme) => (theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'),
  muted: (theme: Theme) => (theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400'),
  panel: (theme: Theme) =>
    theme === 'dark' ? 'bg-zinc-950/50 border-white/10' : 'bg-white border-zinc-200',
  panelHover: (theme: Theme) =>
    theme === 'dark'
      ? 'hover:border-emerald-500/50 hover:bg-white/5'
      : 'hover:border-emerald-500/30',
  badge: (theme: Theme) =>
    theme === 'dark' ? 'bg-black border-white/10 text-zinc-400' : 'bg-zinc-50 border-zinc-200 text-zinc-700',
  skeleton: (theme: Theme) => (theme === 'dark' ? 'bg-white/10' : 'bg-zinc-200'),
};

interface PageShellProps {
  children: ReactNode;
  /** Reading columns and chats may narrow the content; padding and colour stay identical. */
  width?: 'wide' | 'narrow' | 'reading';
  /** Vertical rhythm between top-level blocks. */
  gap?: 'default' | 'tight';
  className?: string;
}

const WIDTHS = {
  wide: 'max-w-[1600px]',
  narrow: 'max-w-5xl',
  reading: 'max-w-4xl',
};

/** DESIGN_SYSTEM.md 1.1. The page background IS the surface - never wrap content in a
 *  further bordered panel or shadcn Card just to frame it. */
export function PageShell({ children, width = 'wide', gap = 'default', className }: PageShellProps) {
  const { theme } = useTheme();
  return (
    <div
      className={cn(
        'w-full h-full transition-colors duration-300 py-12 px-6 md:px-12',
        tone.primary(theme),
        className,
      )}
    >
      <div
        className={cn(
          WIDTHS[width],
          'mx-auto flex flex-col',
          gap === 'tight' ? 'gap-8' : 'gap-12',
        )}
      >
        {children}
      </div>
    </div>
  );
}

interface PageHeroProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Rendered on the far right on desktop, below the copy on mobile (qStudio's "New" button). */
  action?: ReactNode;
  /** Small breadcrumb / back affordance above the title. */
  eyebrow?: ReactNode;
}

/** DESIGN_SYSTEM.md 1.2 - identical motion timings on every page so navigation feels like
 *  one product rather than a set of separately built screens. */
export function PageHero({ title, subtitle, action, eyebrow }: PageHeroProps) {
  const { theme } = useTheme();
  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
      <div className="flex flex-col gap-4 max-w-3xl">
        {eyebrow}
        <motion.h1
          className="text-4xl md:text-5xl font-sans tracking-tight"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          {title}
        </motion.h1>
        {subtitle && (
          <motion.p
            className={cn('text-lg', tone.secondary(theme))}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            {subtitle}
          </motion.p>
        )}
      </div>
      {action}
    </div>
  );
}

/** DESIGN_SYSTEM.md 1.5. Not a card - safe to use anywhere a small visual anchor helps. */
export function IconBadge({
  children,
  size = 'md',
  className,
}: {
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const { theme } = useTheme();
  return (
    <div
      className={cn(
        'rounded-2xl border flex items-center justify-center shadow-sm transition-transform duration-300 group-hover:scale-105 group-hover:text-emerald-500',
        size === 'sm' && 'w-9 h-9',
        size === 'md' && 'w-12 h-12',
        size === 'lg' && 'w-16 h-16',
        tone.badge(theme),
        className,
      )}
    >
      {children}
    </div>
  );
}

interface ExplorerCardProps {
  children: ReactNode;
  onClick?: () => void;
  /** Cards entering on scroll animate with whileInView; on data change, with animate. */
  entrance?: 'scroll' | 'immediate' | 'none';
  delay?: number;
  interactive?: boolean;
  className?: string;
}

/** DESIGN_SYSTEM.md 1.4. For grid-able, navigable units (an algorithm, a course, a round) -
 *  NOT a generic "put a border around this section" tool. Reading content, chats and forms
 *  sit directly on the shell. */
export function ExplorerCard({
  children,
  onClick,
  entrance = 'scroll',
  delay = 0,
  interactive = true,
  className,
}: ExplorerCardProps) {
  const { theme } = useTheme();
  const motionProps =
    entrance === 'scroll'
      ? {
          initial: { opacity: 0, y: 20 },
          whileInView: { opacity: 1, y: 0 },
          viewport: { once: true, margin: '-50px' },
          transition: { duration: 0.5, delay },
        }
      : entrance === 'immediate'
        ? {
            initial: { opacity: 0, y: 20 },
            animate: { opacity: 1, y: 0 },
            transition: { duration: 0.4, delay },
          }
        : {};

  return (
    <motion.div
      onClick={onClick}
      className={cn(
        'p-8 rounded-[2rem] border overflow-hidden shadow-sm transition-all duration-300 group flex flex-col h-full relative',
        tone.panel(theme),
        interactive && 'hover:shadow-md',
        interactive && tone.panelHover(theme),
        onClick && 'cursor-pointer text-left',
        className,
      )}
      {...motionProps}
    >
      {children}
    </motion.div>
  );
}

/** A quieter surface for non-navigable panels (a stat block, a sidebar aside). Same tokens as
 *  ExplorerCard but tighter padding and no hover affordance, so it never reads as clickable. */
export function ExplorerPanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const { theme } = useTheme();
  return (
    <div className={cn('p-6 rounded-[1.5rem] border shadow-sm', tone.panel(theme), className)}>
      {children}
    </div>
  );
}

/** DESIGN_SYSTEM.md 1.8. Emerald, not the purple `primary` token used on admin pages. */
export function AccentButton({
  children,
  onClick,
  disabled,
  type = 'button',
  variant = 'solid',
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
  variant?: 'solid' | 'outline';
  className?: string;
}) {
  const { theme } = useTheme();
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'px-6 py-2.5 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 flex items-center gap-2 w-fit',
        variant === 'solid'
          ? 'bg-emerald-500 text-white shadow hover:bg-emerald-600'
          : cn('border', tone.panel(theme), 'hover:border-emerald-500/50 hover:text-emerald-500'),
        className,
      )}
    >
      {children}
    </button>
  );
}

/** DESIGN_SYSTEM.md 1.7 error state. */
export function ErrorBanner({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <div className="p-4 bg-red-100/10 border border-red-500/20 text-red-500 rounded-lg">
      {children}
    </div>
  );
}

/** DESIGN_SYSTEM.md 1.7 empty state: centred icon badge, one line of copy, one muted hint. */
export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon: ReactNode;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  const { theme } = useTheme();
  return (
    <motion.div
      className="flex flex-col items-center justify-center py-20 gap-3"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <IconBadge size="lg">{icon}</IconBadge>
      <p className="text-lg font-medium">{title}</p>
      {hint && <p className={cn('text-sm', tone.secondary(theme))}>{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </motion.div>
  );
}

/** DESIGN_SYSTEM.md 1.7 skeletons: pulse blocks on the same tokens, sized like real content. */
export function CardSkeletonGrid({ count = 3, height = 250 }: { count?: number; height?: number }) {
  const { theme } = useTheme();
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className={cn('p-8 rounded-[2rem] border shadow-sm animate-pulse', tone.panel(theme))}
          style={{ height }}
        >
          <div className={cn('w-12 h-12 rounded-2xl mb-6', tone.skeleton(theme))} />
          <div className={cn('h-6 w-3/4 rounded mb-4', tone.skeleton(theme))} />
          <div className={cn('h-4 w-1/2 rounded', tone.skeleton(theme))} />
        </div>
      ))}
    </div>
  );
}

/** Section heading used between hero and content on longer pages. */
export function SectionHeading({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <h2 className="text-2xl font-sans tracking-tight">{children}</h2>
      {action}
    </div>
  );
}
