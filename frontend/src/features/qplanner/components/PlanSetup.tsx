import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Check, ChevronDown, ChevronLeft, ChevronRight, Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { useTheme } from '@/context/ThemeContext';
import { AccentButton, ExplorerPanel, Pill, tone } from '@/components/explorer';
import { apiErrorMessage } from '@/api/verification';

import { createPlan, fetchPresets, previewPlan } from '../api';
import type { Plan, PlanPreview, PlanRequest, Preset, SubjectLevel } from '../types/qplanner.types';

/*
 * Plan intake as a step-by-step conversation (modelled on Planly): goal, subjects,
 * level per subject, the resulting roadmap, weekly hours, then sprints and a name.
 * Every number shown from step 4 on comes from /plan/preview, i.e. the same
 * scheduler that builds the real plan, so the preview can never promise something
 * the plan will not do.
 */

const SUBJECTS = [
  { id: 'quantum-maths', name: 'Quantum Maths' },
  { id: 'quantum-physics', name: 'Quantum Physics' },
  { id: 'quantum-computing', name: 'Quantum Computing' },
  { id: 'quantum-communication', name: 'Quantum Communication' },
  { id: 'quantum-machine-learning', name: 'Quantum Machine Learning' },
];
const subjectName = (id: string) => SUBJECTS.find((s) => s.id === id)?.name ?? id;

// Effects match EMPHASIS_FACTOR in backend/services/qplanner_schedule.py (deep 1.3, light 0.6).
const LEVELS: { id: SubjectLevel; title: string; body: string }[] = [
  { id: 'zero', title: 'Start from zero', body: "I'm new to this and want every topic covered in depth (about 30% more time per topic)." },
  { id: 'basics', title: 'Know the basics', body: "I've seen some of it and want a steady, standard pace." },
  { id: 'revision', title: 'Quick revision', body: "I've studied it before and want a focused recap (about 40% less time per topic)." },
];

const FAMILIARITY: { id: SubjectLevel; label: string }[] = [
  { id: 'zero', label: 'New to it' },
  { id: 'basics', label: 'Know the basics' },
  { id: 'revision', label: 'Studied it before' },
];

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DEFAULT_DAY_MINUTES = [60, 60, 60, 60, 60, 90, 90];
const MAX_DAY_MINUTES = 480;
const NAME_LIMIT = 60;
const STEP_COUNT = 6;
const PREVIEW_DEBOUNCE_MS = 250;
const DRAFT_KEY = 'qplanner:draft';

type StartChoice = 'today' | 'tomorrow' | 'custom';

interface Draft {
  step: number;               // 0..5 = the six steps, 6 = "plan details" (second half of step 6)
  presetSlug: string | null;
  familiarity: SubjectLevel | null;
  domains: string[];
  levels: Record<string, SubjectLevel>;
  dayMinutes: number[];
  name: string;
  startChoice: StartChoice;
  customDate: string;
}

const EMPTY_DRAFT: Draft = {
  step: 0,
  presetSlug: null,
  familiarity: null,
  domains: [],
  levels: {},
  dayMinutes: DEFAULT_DAY_MINUTES,
  name: '',
  startChoice: 'today',
  customDate: '',
};

function loadDraft(): Draft {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? { ...EMPTY_DRAFT, ...JSON.parse(raw) } : EMPTY_DRAFT;
  } catch {
    return EMPTY_DRAFT;
  }
}

function localIso(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function daysBetween(startIso: string, endIso: string): number {
  return Math.round((Date.parse(endIso) - Date.parse(startIso)) / 86_400_000) + 1;
}

function hoursLabel(minutes: number): string {
  const h = minutes / 60;
  return `${Number.isInteger(h) ? h : h.toFixed(1)} ${h === 1 ? 'hour' : 'hours'}`;
}

interface Props {
  onPlanCreated: (plan: Plan) => void;
}

export function PlanSetup({ onPlanCreated }: Props) {
  const { theme } = useTheme();
  const [presets, setPresets] = useState<Preset[] | null>(null);
  const [draft, setDraft] = useState<Draft>(loadDraft);
  const [preview, setPreview] = useState<PlanPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<Plan | null>(null);

  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  useEffect(() => {
    fetchPresets()
      .then((response) => setPresets(response.data))
      .catch((error) => {
        setPresets([]);
        toast.error(apiErrorMessage(error, 'Could not load goals'));
      });
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      /* private mode: the draft just isn't kept */
    }
  }, [draft]);

  const preset = presets?.find((p) => p.slug === draft.presetSlug) ?? null;
  const recommended = preset ? preset.target_domains ?? SUBJECTS.map((s) => s.id) : [];
  const weeklyMinutes = draft.dayMinutes.reduce((a, b) => a + b, 0);
  const startDate =
    draft.startChoice === 'today' ? localIso(0) : draft.startChoice === 'tomorrow' ? localIso(1) : draft.customDate;

  const request = useMemo<PlanRequest | null>(() => {
    if (!draft.presetSlug || draft.domains.length === 0 || weeklyMinutes < 30) return null;
    return {
      preset_slug: draft.presetSlug,
      target_domains: draft.domains,
      domain_levels: Object.fromEntries(draft.domains.map((d) => [d, draft.levels[d] ?? 'basics'])),
      day_minutes: draft.dayMinutes,
      ...(startDate ? { start_date: startDate } : {}),
    };
  }, [draft.presetSlug, draft.domains, draft.levels, draft.dayMinutes, weeklyMinutes, startDate]);

  // Only the steps that show scheduler numbers need a preview.
  const needsPreview = draft.step >= 3;
  useEffect(() => {
    if (!request || !needsPreview) return;
    setPreviewing(true);
    const timer = setTimeout(() => {
      previewPlan(request)
        .then((response) => setPreview(response.data))
        .catch((error) => toast.error(apiErrorMessage(error, 'Could not preview that plan')))
        .finally(() => setPreviewing(false));
    }, PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [request, needsPreview]);

  function choosePreset(next: Preset) {
    const domains = next.target_domains ?? SUBJECTS.map((s) => s.id);
    const level = draft.familiarity ?? 'basics';
    update({ presetSlug: next.slug, domains, levels: Object.fromEntries(domains.map((d) => [d, level])) });
  }

  function chooseFamiliarity(level: SubjectLevel) {
    update({ familiarity: level, levels: Object.fromEntries(draft.domains.map((d) => [d, level])) });
  }

  function toggleDomain(id: string) {
    const on = draft.domains.includes(id);
    update({
      domains: on ? draft.domains.filter((d) => d !== id) : [...draft.domains, id],
      levels: on ? draft.levels : { ...draft.levels, [id]: draft.levels[id] ?? draft.familiarity ?? 'basics' },
    });
  }

  function discard() {
    setDraft(EMPTY_DRAFT);
    setPreview(null);
  }

  async function generate() {
    if (!request) return;
    setCreating(true);
    try {
      const response = await createPlan({ ...request, name: draft.name.trim() });
      setCreated(response.data);
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        /* ignore */
      }
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Could not build your plan'));
    } finally {
      setCreating(false);
    }
  }

  if (presets === null) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-emerald-500" aria-label="Loading" />
      </div>
    );
  }

  if (created) return <PlanReady plan={created} onOpen={() => onPlanCreated(created)} />;

  const rule = theme === 'dark' ? 'border-white/10' : 'border-zinc-200';
  const levelsDone = draft.domains.every((d) => draft.levels[d]);
  const customValid = draft.startChoice !== 'custom' || Boolean(draft.customDate);

  // [title, primary label, can continue]
  const steps: [string, string, boolean][] = [
    ['About you', 'Next', Boolean(draft.presetSlug && draft.familiarity)],
    ['Recommended subjects', 'Continue with selected subjects', draft.domains.length > 0],
    ['Select your current level for each subject', 'Confirm levels', levelsDone],
    ['Review your personalised roadmap', 'Confirm content', Boolean(preview && preview.topic_count > 0)],
    ['Set your weekly study availability', 'Confirm availability', weeklyMinutes >= 30],
    ['Finalise your plan', 'Name my plan', Boolean(preview && preview.sprint_count > 0)],
    ['Plan details', 'Generate plan', draft.name.trim().length > 0 && customValid && Boolean(preview)],
  ];
  const [title, primaryLabel, canContinue] = steps[draft.step];
  const stepNumber = Math.min(draft.step + 1, STEP_COUNT);
  const isLast = draft.step === steps.length - 1;

  return (
    <ExplorerPanel className="flex min-h-[640px] flex-col gap-0 p-0">
      <div className={cn('flex items-center justify-between gap-4 border-b px-6 py-4 md:px-8', rule)}>
        <span className="text-sm font-medium">New study plan</span>
        {draft.step > 0 && (
          <button
            type="button"
            onClick={discard}
            className={cn('rounded-lg border px-3 py-1.5 text-sm transition-colors hover:text-red-500', rule, tone.secondary(theme))}
          >
            Discard my plan
          </button>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-8 px-6 py-8 md:px-8">
        <h2 className="text-3xl tracking-tight">{title}</h2>

        {draft.step === 0 && (
          <div className="flex flex-col gap-8">
            <Question label="1. What do you want to achieve?">
              {presets.map((p) => (
                <Choice key={p.slug} active={draft.presetSlug === p.slug} onClick={() => choosePreset(p)} hint={p.tagline}>
                  {p.label}
                </Choice>
              ))}
            </Question>
            <Question label="2. How familiar are you with quantum computing?">
              {FAMILIARITY.map((f) => (
                <Choice key={f.id} active={draft.familiarity === f.id} onClick={() => chooseFamiliarity(f.id)}>
                  {f.label}
                </Choice>
              ))}
            </Question>
          </div>
        )}

        {draft.step === 1 && (
          <SubjectsStep recommended={recommended} selected={draft.domains} onToggle={toggleDomain} />
        )}

        {draft.step === 2 && (
          <div className="flex flex-col gap-8">
            {draft.domains.map((domain) => (
              <section key={domain} className="flex flex-col gap-3">
                <h3 className="text-lg font-medium">{subjectName(domain)}</h3>
                <div role="radiogroup" aria-label={`${subjectName(domain)} level`} className="grid gap-3 md:grid-cols-3">
                  {LEVELS.map((level) => {
                    const on = draft.levels[domain] === level.id;
                    return (
                      <button
                        key={level.id}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => update({ levels: { ...draft.levels, [domain]: level.id } })}
                        className={cn(
                          'flex items-start gap-3 rounded-xl border p-4 text-left transition-colors',
                          on ? 'border-emerald-500 bg-emerald-500/5' : cn(rule, 'hover:border-emerald-500/50'),
                        )}
                      >
                        <span
                          className={cn(
                            'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                            on ? 'border-emerald-500' : rule,
                          )}
                          aria-hidden
                        >
                          {on && <span className="h-2 w-2 rounded-full bg-emerald-500" />}
                        </span>
                        <span className="flex flex-col gap-1">
                          <span className="font-medium">{level.title}</span>
                          <span className={cn('text-sm', tone.secondary(theme))}>{level.body}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
            <p className={cn('text-xs', tone.muted(theme))}>
              Where you already have quiz scores on a topic, those decide its time instead.
            </p>
          </div>
        )}

        {draft.step === 3 && (
          <PreviewGate preview={preview} loading={previewing}>
            {(p) => (
              <RoadmapReview
                preview={p}
                domains={draft.domains}
                onRemove={(d) => draft.domains.length > 1 && toggleDomain(d)}
              />
            )}
          </PreviewGate>
        )}

        {draft.step === 4 && (
          <div className="flex flex-col gap-4">
            <Banner>
              <span>You can finish earlier by adding more hours on any day.</span>
              <span className="flex items-baseline gap-2 text-sm">
                Est. days
                <span className="text-2xl font-medium tabular-nums text-emerald-500">
                  {preview && !previewing ? daysBetween(preview.start_date, preview.end_date) : '…'}
                </span>
              </span>
            </Banner>
            <ul className="flex flex-col gap-2">
              {DAY_NAMES.map((day, i) => (
                <li key={day} className={cn('flex items-center gap-6 rounded-xl border px-5 py-3', rule)}>
                  <label htmlFor={`day-${i}`} className="w-28 shrink-0 font-medium">
                    {day}
                  </label>
                  <input
                    id={`day-${i}`}
                    type="range"
                    min={0}
                    max={MAX_DAY_MINUTES}
                    step={30}
                    value={draft.dayMinutes[i]}
                    onChange={(e) => {
                      const next = [...draft.dayMinutes];
                      next[i] = Number(e.target.value);
                      update({ dayMinutes: next });
                    }}
                    aria-valuetext={hoursLabel(draft.dayMinutes[i])}
                    className="ml-auto w-full max-w-sm cursor-pointer accent-emerald-500"
                  />
                  <span className={cn('w-20 shrink-0 text-right text-sm tabular-nums', tone.secondary(theme))}>
                    {draft.dayMinutes[i] === 0 ? 'Rest' : hoursLabel(draft.dayMinutes[i])}
                  </span>
                </li>
              ))}
            </ul>
            <p className={cn('text-sm', weeklyMinutes < 30 ? 'text-red-500' : tone.secondary(theme))}>
              {weeklyMinutes < 30
                ? 'Give yourself at least 30 minutes in the week.'
                : `You have allocated ${hoursLabel(weeklyMinutes)} a week.`}
            </p>
          </div>
        )}

        {draft.step === 5 && (
          <PreviewGate preview={preview} loading={previewing}>
            {(p) => <SprintPreview preview={p} />}
          </PreviewGate>
        )}

        {draft.step === 6 && (
          <div className="flex flex-col gap-8">
            {preview && (
              <dl className={cn('grid grid-cols-2 gap-4 rounded-xl border p-5 md:grid-cols-5', rule)}>
                <Stat label="Total sprints" value={preview.sprint_count} />
                <Stat label="Subjects" value={draft.domains.length} />
                <Stat label="Study hours" value={formatDuration(preview.total_minutes)} />
                <Stat label="Est. duration" value={`${daysBetween(preview.start_date, preview.end_date)} days`} />
                <Stat label="Est. completion" value={formatDate(preview.end_date)} />
              </dl>
            )}

            <div className="flex flex-col gap-2">
              <label htmlFor="plan-name" className="font-medium">
                Plan name
              </label>
              <input
                id="plan-name"
                value={draft.name}
                maxLength={NAME_LIMIT}
                placeholder="e.g. Algorithms before placements"
                onChange={(e) => update({ name: e.target.value })}
                className={cn(
                  'w-full rounded-xl border bg-transparent px-4 py-3 outline-none transition-colors focus-visible:border-emerald-500',
                  rule,
                )}
              />
              <span className={cn('text-xs tabular-nums', tone.muted(theme))}>
                {draft.name.length}/{NAME_LIMIT}
              </span>
            </div>

            <Question label="When do you want to start?">
              <Choice active={draft.startChoice === 'today'} onClick={() => update({ startChoice: 'today' })}>
                Today
              </Choice>
              <Choice active={draft.startChoice === 'tomorrow'} onClick={() => update({ startChoice: 'tomorrow' })}>
                Tomorrow
              </Choice>
              <Choice
                active={draft.startChoice === 'custom'}
                onClick={() => update({ startChoice: 'custom', customDate: draft.customDate || localIso(2) })}
              >
                Custom date
              </Choice>
            </Question>
            {draft.startChoice === 'custom' && (
              <input
                type="date"
                aria-label="Start date"
                value={draft.customDate}
                min={localIso(0)}
                max={localIso(90)}
                onChange={(e) => update({ customDate: e.target.value })}
                className={cn(
                  'w-fit rounded-xl border bg-transparent px-4 py-2.5 outline-none focus-visible:border-emerald-500',
                  rule,
                  theme === 'dark' && '[color-scheme:dark]',
                )}
              />
            )}
            {startDate && (
              <p className={cn('-mt-4 text-sm', tone.secondary(theme))}>
                Start date: <span className={tone.primary(theme)}>{formatDate(startDate)}</span>. The plan
                is laid out from that day.
              </p>
            )}
          </div>
        )}
      </div>

      <div className={cn('flex flex-wrap items-center justify-between gap-4 border-t px-6 py-4 md:px-8', rule)}>
        <div className="flex items-center gap-4 text-xs">
          <div className={cn('h-1 w-24 overflow-hidden rounded-full', tone.skeleton(theme))}>
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${(stepNumber / STEP_COUNT) * 100}%` }}
            />
          </div>
          <span className="font-medium">
            Step {stepNumber} of {STEP_COUNT}
          </span>
          {draft.step > 0 && <span className={tone.muted(theme)}>Draft saved</span>}
        </div>
        <div className="flex items-center gap-3">
          {draft.step > 0 && (
            <AccentButton variant="outline" onClick={() => update({ step: draft.step - 1 })}>
              <ChevronLeft className="h-4 w-4" aria-hidden />
              Previous
            </AccentButton>
          )}
          <AccentButton
            onClick={isLast ? generate : () => update({ step: draft.step + 1 })}
            disabled={!canContinue || creating || (draft.step >= 3 && previewing)}
          >
            {creating && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {primaryLabel}
            {!creating && <ChevronRight className="h-4 w-4" aria-hidden />}
          </AccentButton>
        </div>
      </div>
    </ExplorerPanel>
  );
}

function Question({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-3 font-medium">{label}</legend>
      <div className="flex flex-wrap gap-3">{children}</div>
    </fieldset>
  );
}

function Choice({
  active,
  onClick,
  hint,
  children,
}: {
  active: boolean;
  onClick: () => void;
  hint?: string;
  children: ReactNode;
}) {
  const { theme } = useTheme();
  return (
    <button
      type="button"
      aria-pressed={active}
      title={hint}
      onClick={onClick}
      className={cn(
        'rounded-xl border px-5 py-2.5 text-sm font-medium transition-colors',
        active
          ? 'border-emerald-500 bg-emerald-500/10'
          : cn(theme === 'dark' ? 'border-white/10' : 'border-zinc-200', tone.secondary(theme), 'hover:border-emerald-500/50'),
      )}
    >
      {children}
    </button>
  );
}

function Banner({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-5 py-3 text-sm">
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  const { theme } = useTheme();
  return (
    <div className="flex flex-col gap-1">
      <dt className={cn('text-xs', tone.muted(theme))}>{label}</dt>
      <dd className="text-xl font-medium tabular-nums text-emerald-500">{value}</dd>
    </div>
  );
}

function PreviewGate({
  preview,
  loading,
  children,
}: {
  preview: PlanPreview | null;
  loading: boolean;
  children: (preview: PlanPreview) => ReactNode;
}) {
  const { theme } = useTheme();
  if (!preview) {
    return (
      <p className={cn('flex items-center gap-2 text-sm', tone.secondary(theme))} aria-live="polite">
        {loading && <Loader2 className="h-4 w-4 animate-spin text-emerald-500" aria-hidden />}
        Laying out your plan…
      </p>
    );
  }
  return <div className={cn('transition-opacity', loading && 'opacity-60')}>{children(preview)}</div>;
}

function SubjectsStep({
  recommended,
  selected,
  onToggle,
}: {
  recommended: string[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const { theme } = useTheme();
  const rule = theme === 'dark' ? 'border-white/10' : 'border-zinc-200';
  // Rows: every recommended subject plus any the learner added; chips: the rest.
  const rows = SUBJECTS.filter((s) => recommended.includes(s.id) || selected.includes(s.id));
  const others = SUBJECTS.filter((s) => !rows.includes(s));

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h3 className="font-medium">We picked the subjects that matter most for your goal</h3>
        <ul className="flex flex-col gap-2">
          {rows.map((s) => {
            const on = selected.includes(s.id);
            return (
              <li key={s.id}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => onToggle(s.id)}
                  className={cn('flex w-full items-center gap-4 rounded-xl border px-5 py-3 text-left transition-colors', rule, 'hover:border-emerald-500/50')}
                >
                  <span
                    className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded border',
                      on ? 'border-emerald-500 bg-emerald-500 text-white' : rule,
                    )}
                    aria-hidden
                  >
                    {on && <Check className="h-3.5 w-3.5" />}
                  </span>
                  <span className="flex-1 font-medium">{s.name}</span>
                  {recommended.includes(s.id) && <Pill variant="accent">Recommended</Pill>}
                </button>
              </li>
            );
          })}
        </ul>
        <p className={cn('text-xs', tone.muted(theme))}>
          Recommended: the subjects your goal is built on. You can change them however you like.
        </p>
      </section>

      {others.length > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className="font-medium">Other subjects</h3>
          <div className="flex flex-wrap gap-3">
            {others.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => onToggle(s.id)}
                aria-label={`Add ${s.name}`}
                className={cn('flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors hover:border-emerald-500/50', rule)}
              >
                {s.name}
                <Plus className="h-3.5 w-3.5 text-emerald-500" aria-hidden />
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function RoadmapReview({
  preview,
  domains,
  onRemove,
}: {
  preview: PlanPreview;
  domains: string[];
  onRemove: (domain: string) => void;
}) {
  const { theme } = useTheme();
  const [open, setOpen] = useState<string | null>(null);
  const rule = theme === 'dark' ? 'border-white/10' : 'border-zinc-200';

  return (
    <div className="flex flex-col gap-4">
      <Banner>
        <span>
          We've planned <span className="font-medium text-emerald-500">{formatDuration(preview.total_minutes)}</span> of
          focused learning across {preview.topic_count} topics.
          {preview.already_completed > 0 && ` ${preview.already_completed} topics you've completed are left out.`}
        </span>
      </Banner>
      <ul className="flex flex-col gap-2">
        {domains.map((domain) => {
          const topics = preview.topics.filter((t) => t.domain === domain);
          const minutes = topics.reduce((sum, t) => sum + t.minutes, 0);
          const expanded = open === domain;
          return (
            <li key={domain} className={cn('rounded-xl border', rule)}>
              <div className="flex items-center gap-3 px-5 py-3">
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setOpen(expanded ? null : domain)}
                  className="flex flex-1 items-center gap-3 text-left"
                >
                  <ChevronRight className={cn('h-4 w-4 transition-transform', expanded && 'rotate-90')} aria-hidden />
                  <span className="flex-1 font-medium">{subjectName(domain)}</span>
                  <span className={cn('text-xs tabular-nums', tone.secondary(theme))}>
                    {topics.length} topics · Est. {formatDuration(minutes)}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(domain)}
                  disabled={domains.length === 1}
                  aria-label={`Remove ${subjectName(domain)}`}
                  className={cn('rounded p-1 transition-colors hover:text-red-500 disabled:opacity-30', tone.muted(theme))}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </div>
              {expanded && (
                <ol className={cn('flex flex-col border-t px-5 py-2', rule)}>
                  {topics.map((t, i) => (
                    <li key={t.slug} className="flex items-baseline gap-3 py-1.5 text-sm">
                      <span className={cn('w-6 tabular-nums', tone.muted(theme))}>{i + 1}</span>
                      <span className="flex-1">{t.title}</span>
                      <span className={cn('tabular-nums', tone.secondary(theme))}>{formatDuration(t.minutes)}</span>
                    </li>
                  ))}
                  {topics.length === 0 && (
                    <li className={cn('py-1.5 text-sm', tone.secondary(theme))}>Everything here is already done.</li>
                  )}
                </ol>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SprintPreview({ preview }: { preview: PlanPreview }) {
  const { theme } = useTheme();
  const [open, setOpen] = useState<number | null>(null);
  const rule = theme === 'dark' ? 'border-white/10' : 'border-zinc-200';
  const bySlug = new Map(preview.topics.map((t) => [t.slug, t]));

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h3 className="text-lg font-medium">Your sprint preview</h3>
        <span className={cn('text-xs', tone.secondary(theme))}>{preview.sprint_count} weekly sprints</span>
      </div>
      <ul className="flex flex-col gap-2">
        {preview.sprints.map((sprint) => {
          const topics = sprint.topic_slugs.map((s) => bySlug.get(s)).filter(Boolean) as PlanPreview['topics'];
          const subjects = [...new Set(topics.map((t) => subjectName(t.domain)))].join(' + ');
          const expanded = open === sprint.index;
          return (
            <li key={sprint.index} className={cn('rounded-xl border', rule)}>
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => setOpen(expanded ? null : sprint.index)}
                className="flex w-full items-center gap-3 px-5 py-3 text-left"
              >
                <Pill variant="accent">Sprint {sprint.index + 1}</Pill>
                <span className={cn('flex-1 truncate text-sm', tone.secondary(theme))}>{subjects}</span>
                <span className={cn('text-xs tabular-nums', tone.secondary(theme))}>
                  Est. {formatDuration(sprint.planned_minutes)}
                </span>
                <ChevronDown className={cn('h-4 w-4 transition-transform', expanded && 'rotate-180')} aria-hidden />
              </button>
              {expanded && (
                <ol className={cn('flex flex-col border-t px-5 py-2', rule)}>
                  {topics.map((t) => (
                    <li key={t.slug} className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
                      <span>{t.title}</span>
                      <span className={cn('tabular-nums', tone.secondary(theme))}>{formatDuration(t.minutes)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function PlanReady({ plan, onOpen }: { plan: Plan; onOpen: () => void }) {
  const { theme } = useTheme();
  const rule = theme === 'dark' ? 'border-white/10' : 'border-zinc-200';
  const totalMinutes = plan.sprints.reduce((sum, s) => sum + s.planned_minutes, 0);

  return (
    <ExplorerPanel className="flex flex-col items-center gap-8 px-6 py-14 text-center">
      <div className="flex flex-col gap-3">
        <h2 className="text-3xl tracking-tight md:text-4xl">Your personalised plan is ready</h2>
        <p className={cn('text-lg', tone.secondary(theme))}>
          A day-by-day plan built from your goal, your levels and your week.
        </p>
      </div>

      <div className={cn('w-full max-w-3xl rounded-2xl border text-left', rule)}>
        <div className={cn('border-b px-6 py-5', rule)}>
          <p className="text-xl font-medium">{plan.goal_label}</p>
          {plan.strategy_note && <p className={cn('mt-1 text-sm', tone.secondary(theme))}>{plan.strategy_note}</p>}
        </div>
        <dl className="grid grid-cols-2 gap-6 px-6 py-5 md:grid-cols-4">
          <Stat label="Start date" value={formatDate(plan.start_date)} />
          <Stat label="End date" value={formatDate(plan.deadline)} />
          <Stat label="Total sprints" value={plan.sprints.length} />
          <Stat label="Study time" value={formatDuration(totalMinutes)} />
        </dl>
      </div>

      <AccentButton onClick={onOpen}>
        Open my plan
        <ChevronRight className="h-4 w-4" aria-hidden />
      </AccentButton>
    </ExplorerPanel>
  );
}
