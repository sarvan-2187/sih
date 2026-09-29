import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';
import { AccentButton, PageHero, PageShell, SectionHeading, tone } from '@/components/explorer';
import { STAGES } from '../constants/stages';

// Rendered top (warm) to bottom (coldest), the order a build actually descends through.
const STAGE_ORDER = ['300K', '50K', '4K', 'still', 'coldplate', 'mxc'] as const;

// The three entry points StartBuildView offers inside the builder.
const MODES = [
  { title: 'Guided Tour', description: 'Learn it step by step, with each stage explained as you place it.' },
  { title: 'Free Design', description: 'Build any configuration from scratch and see how it performs.' },
  { title: 'Challenge', description: 'Timed engineering scenarios with a fault to diagnose.' },
];

function formatTemperature(kelvin: number): string {
  return kelvin >= 1 ? `${kelvin} K` : `${Math.round(kelvin * 1000)} mK`;
}

/**
 * QForge's opening page. Kept deliberately quiet: one primary action, then the two things
 * that are actually specific to QForge (the cryostat's temperature ladder and the three
 * build modes), shown as plain lists rather than decorative cards.
 */
export const QForgeLandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const rule = theme === 'dark' ? 'border-white/10' : 'border-zinc-200';

  return (
    <PageShell>
      <PageHero
        title="QForge"
        subtitle="Build a superconducting quantum computer one cryostat stage at a time, from room temperature down to the mixing chamber at about 15 millikelvin."
        action={
          <AccentButton onClick={() => navigate('/qforge/builder')}>Start a new build</AccentButton>
        }
      />

      <section aria-labelledby="qforge-stages" className="flex flex-col gap-6">
        <SectionHeading>
          <span id="qforge-stages">The cryostat, top to bottom</span>
        </SectionHeading>
        <ol className={cn('grid grid-cols-1 border-t sm:grid-cols-2 lg:grid-cols-6', rule)}>
          {STAGE_ORDER.map((id, position) => {
            const stage = STAGES[id];
            return (
              <li
                key={id}
                className={cn(
                  'flex flex-col gap-1 border-b py-4 lg:border-b-0 lg:border-r lg:px-4 lg:first:pl-0 lg:last:border-r-0',
                  rule,
                )}
              >
                <span className={cn('text-xs tabular-nums', tone.muted(theme))}>{position + 1}</span>
                <span className="text-2xl tracking-tight tabular-nums">{formatTemperature(stage.targetTempK)}</span>
                <span className={cn('text-sm', tone.secondary(theme))}>{stage.name}</span>
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-labelledby="qforge-modes" className="flex flex-col gap-6">
        <SectionHeading>
          <span id="qforge-modes">Three ways to build</span>
        </SectionHeading>
        <dl className="grid grid-cols-1 gap-x-12 gap-y-6 md:grid-cols-3">
          {MODES.map((mode) => (
            <div key={mode.title} className="flex flex-col gap-1">
              <dt className="font-medium">{mode.title}</dt>
              <dd className={cn('text-sm leading-relaxed', tone.secondary(theme))}>{mode.description}</dd>
            </div>
          ))}
        </dl>
      </section>
    </PageShell>
  );
};

export default QForgeLandingPage;
