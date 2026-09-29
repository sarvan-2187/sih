import React from 'react';
import { cn } from '@/lib/utils';
import type { Slide, SlideTheme } from '../types';

interface ThemeTokens {
  background: string;
  overlay?: string;
  text: string;
  subtext: string;
  accent: string;
  cardBg: string;
  cardBorder: string;
}

// JS mirror of qstudio_service/templates/slides/{theme}.html's CSS tokens — kept in
// sync by hand since one lives in Jinja/CSS (server-rendered PNG/PDF) and this one in
// React (in-app native viewer), per PLANS/qstudio.md §6's "render slides natively
// from data" option.
const THEME_TOKENS: Record<SlideTheme, ThemeTokens> = {
  minimal_dark: {
    background:
      'radial-gradient(circle at 15% 10%, rgba(139,0,255,0.18), transparent 45%), radial-gradient(circle at 85% 90%, rgba(52,211,153,0.10), transparent 40%), #000000',
    text: '#fafafa',
    subtext: 'rgba(250,250,250,0.6)',
    accent: '#34d399',
    cardBg: 'rgba(255,255,255,0.03)',
    cardBorder: 'rgba(255,255,255,0.1)',
  },
  bold_gradient: {
    background: 'linear-gradient(135deg, #ff2fb8 0%, #ff6a3d 32%, #ffb800 52%, #00d4ff 78%, #7c3aed 100%)',
    overlay: 'linear-gradient(180deg, rgba(10,0,20,0.15) 0%, rgba(10,0,20,0.55) 100%)',
    text: '#ffffff',
    subtext: 'rgba(255,255,255,0.85)',
    accent: '#ffffff',
    cardBg: 'rgba(10,0,20,0.42)',
    cardBorder: 'rgba(255,255,255,0.35)',
  },
  academic_light: {
    background: '#faf7f0',
    text: '#10141f',
    subtext: '#5b6472',
    accent: '#b08a3e',
    cardBg: '#ffffff',
    cardBorder: '#dcd5c4',
  },
};

export const STAGE_WIDTH = 960;
export const STAGE_HEIGHT = 540;

interface SlideStageProps {
  slide: Slide;
  theme: SlideTheme;
  index: number;
  total: number;
}

export const SlideStage: React.FC<SlideStageProps> = ({ slide, theme, index, total }) => {
  const t = THEME_TOKENS[theme];

  return (
    <div
      className="relative shrink-0 overflow-hidden"
      style={{ width: STAGE_WIDTH, height: STAGE_HEIGHT, background: t.background, color: t.text }}
    >
      {t.overlay && <div className="absolute inset-0" style={{ background: t.overlay }} />}
      <div className="relative z-10 flex flex-col h-full px-14 py-10">
        <div className="flex items-center gap-2 mb-7 shrink-0">
          <div className="w-2 h-2 rounded-full" style={{ background: t.accent }} />
          <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: t.subtext }}>
            Qrious &middot; Slides
          </span>
        </div>

        <div className="flex-1 min-h-0 flex flex-col">
          {slide.layout === 'title' && (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
              <h1 className={cn('text-4xl font-semibold leading-tight max-w-xl font-sans')}>{slide.title}</h1>
              {slide.subtitle && (
                <p className="text-base max-w-md" style={{ color: t.subtext }}>{slide.subtitle}</p>
              )}
            </div>
          )}

          {slide.layout === 'section' && (
            <div className="flex-1 flex flex-col items-center justify-center gap-5">
              <div className="w-14 h-1 rounded-full" style={{ background: t.accent }} />
              <h2 className={cn('text-3xl font-semibold text-center max-w-md font-sans')}>{slide.title}</h2>
            </div>
          )}

          {slide.layout === 'quote' && (
            <div className="flex-1 flex flex-col justify-center gap-4">
              <div className="text-7xl leading-none font-sans" style={{ color: t.accent, opacity: 0.4 }}>&ldquo;</div>
              <p className="text-xl italic leading-snug max-w-lg">{slide.quote}</p>
              {slide.attribution && (
                <p className="text-xs text-right" style={{ color: t.subtext }}>&mdash; {slide.attribution}</p>
              )}
            </div>
          )}

          {slide.layout === 'comparison' && (
            <>
              <h3 className={cn('text-xl font-semibold mb-4 shrink-0 font-sans')}>{slide.title}</h3>
              <div className="flex-1 flex gap-6 min-h-0">
                <div className="flex-1 flex flex-col gap-2.5 overflow-hidden">
                  <p className="text-xs font-semibold" style={{ color: t.accent }}>{slide.left_label}</p>
                  {slide.left_points.map((p, i) => (
                    <p key={i} className="text-xs leading-relaxed">{p}</p>
                  ))}
                </div>
                <div className="w-px shrink-0" style={{ background: t.cardBorder }} />
                <div className="flex-1 flex flex-col gap-2.5 overflow-hidden">
                  <p className="text-xs font-semibold" style={{ color: t.accent }}>{slide.right_label}</p>
                  {slide.right_points.map((p, i) => (
                    <p key={i} className="text-xs leading-relaxed">{p}</p>
                  ))}
                </div>
              </div>
            </>
          )}

          {slide.layout === 'stat' && (
            <div className="flex-1 flex flex-col justify-center gap-7">
              <h3 className={cn('text-xl font-semibold font-sans')}>{slide.title}</h3>
              <div className="flex gap-4">
                {slide.stats.map((s, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-2xl border flex flex-col items-center gap-1.5 py-7 px-3 text-center"
                    style={{ background: t.cardBg, borderColor: t.cardBorder }}
                  >
                    <span className="text-3xl font-semibold" style={{ color: t.accent }}>{s.value}</span>
                    <span className="text-[11px]" style={{ color: t.subtext }}>{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(slide.layout === 'bullets' || !['title', 'section', 'quote', 'comparison', 'stat'].includes(slide.layout)) && (
            <>
              <h3 className={cn('text-2xl font-semibold mb-5 max-w-xl shrink-0 font-sans')}>{slide.title}</h3>
              <div
                className="flex-1 rounded-2xl border flex flex-col justify-center gap-3.5 px-7 py-5 min-h-0"
                style={{ background: t.cardBg, borderColor: t.cardBorder }}
              >
                {slide.bullets.map((b, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-sm">
                    <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: t.accent }} />
                    <span>{b}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-between text-[10px] pt-4 shrink-0" style={{ color: t.subtext }}>
          <span>Generated deck</span>
          <span>{index + 1} / {total}</span>
        </div>
      </div>
    </div>
  );
};
