import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Check, Loader2, Target, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { apiErrorMessage } from '@/api/verification';

import { createPlan, fetchPresets, previewPlan } from '../api';
import type { Plan, PlanPreview, PlanRequest, Preset } from '../types/qplanner.types';
import { WEEKDAYS } from '../types/qplanner.types';

const PREVIEW_DEBOUNCE_MS = 250;

function isoDateIn(weeks: number): string {
  const date = new Date();
  date.setDate(date.getDate() + weeks * 7);
  return date.toISOString().slice(0, 10);
}

function hours(minutes: number): string {
  return (minutes / 60).toFixed(minutes % 60 === 0 ? 0 : 1);
}

interface Props {
  onPlanCreated: (plan: Plan) => void;
}

/** Preset cards, then the tunable intake form with a live feasibility readout. */
export function PlanSetup({ onPlanCreated }: Props) {
  const [presets, setPresets] = useState<Preset[] | null>(null);
  const [selected, setSelected] = useState<Preset | null>(null);
  const [deadline, setDeadline] = useState('');
  const [weeklyMinutes, setWeeklyMinutes] = useState(300);
  const [studyDays, setStudyDays] = useState<number[]>([0, 2, 4]);
  const [preview, setPreview] = useState<PlanPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchPresets()
      .then((response) => setPresets(response.data))
      .catch((error) => {
        setPresets([]);
        toast.error(apiErrorMessage(error, 'Could not load goal presets'));
      });
  }, []);

  function choose(preset: Preset) {
    setSelected(preset);
    setWeeklyMinutes(preset.default_weekly_minutes);
    setDeadline(isoDateIn(preset.default_weeks));
    setPreview(null);
  }

  const request = useMemo<PlanRequest | null>(() => {
    if (!selected || !deadline || studyDays.length === 0) return null;
    return {
      preset_slug: selected.slug,
      deadline,
      weekly_minutes: weeklyMinutes,
      study_days: [...studyDays].sort((a, b) => a - b),
    };
  }, [selected, deadline, weeklyMinutes, studyDays]);

  // Debounced so dragging the slider does not fire a request per pixel.
  useEffect(() => {
    if (!request) return;
    setPreviewing(true);
    const timer = setTimeout(() => {
      previewPlan(request)
        .then((response) => setPreview(response.data))
        .catch((error) => toast.error(apiErrorMessage(error, 'Could not check that plan')))
        .finally(() => setPreviewing(false));
    }, PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [request]);

  function toggleDay(day: number) {
    setStudyDays((current) =>
      current.includes(day) ? current.filter((d) => d !== day) : [...current, day],
    );
  }

  async function generate() {
    if (!request) return;
    setCreating(true);
    try {
      const response = await createPlan(request);
      toast.success('Your plan is ready');
      onPlanCreated(response.data);
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Could not build your plan'));
    } finally {
      setCreating(false);
    }
  }

  if (presets === null) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-5 h-5 animate-spin text-primary" aria-label="Loading presets" />
      </div>
    );
  }

  const infeasible = preview !== null && !preview.feasibility.feasible;

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="preset-heading" className="flex flex-col gap-4">
        <div>
          <h2 id="preset-heading" className="text-lg font-semibold">Pick a goal</h2>
          <p className="text-sm text-muted-foreground">
            Each one is a real slice of the quantum roadmap. You can tune the dates and hours next.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {presets.map((preset) => {
            const active = selected?.slug === preset.slug;
            return (
              <Card
                key={preset.slug}
                role="button"
                tabIndex={0}
                aria-pressed={active}
                onClick={() => choose(preset)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    choose(preset);
                  }
                }}
                className={cn(
                  'cursor-pointer transition-colors hover:border-primary/60',
                  active && 'border-primary ring-1 ring-primary',
                )}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{preset.label}</CardTitle>
                    {active && <Check className="w-4 h-4 text-primary shrink-0" aria-hidden />}
                  </div>
                  <CardDescription>{preset.tagline}</CardDescription>
                </CardHeader>
                <CardContent className="flex gap-2 text-xs">
                  <Badge variant="secondary">{preset.default_weeks} weeks</Badge>
                  <Badge variant="secondary">{hours(preset.default_weekly_minutes)} h/week</Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {selected && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" aria-hidden />
              {selected.label}
            </CardTitle>
            <CardDescription>
              Adjust anything here — the numbers underneath update as you go.
            </CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col gap-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="qplanner-deadline">Target date</Label>
                <Input
                  id="qplanner-deadline"
                  type="date"
                  value={deadline}
                  min={isoDateIn(0)}
                  onChange={(event) => setDeadline(event.target.value)}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="qplanner-hours">
                  Study time: {hours(weeklyMinutes)} hours per week
                </Label>
                <Slider
                  id="qplanner-hours"
                  min={60}
                  max={1200}
                  step={30}
                  value={[weeklyMinutes]}
                  onValueChange={([value]) => setWeeklyMinutes(value)}
                  aria-label="Weekly study hours"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Study days</Label>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map((label, day) => {
                  const on = studyDays.includes(day);
                  return (
                    <Button
                      key={label}
                      type="button"
                      size="sm"
                      variant={on ? 'default' : 'outline'}
                      aria-pressed={on}
                      onClick={() => toggleDay(day)}
                    >
                      {label}
                    </Button>
                  );
                })}
              </div>
              {studyDays.length === 0 && (
                <p className="text-sm text-destructive">Pick at least one day.</p>
              )}
            </div>

            <PreviewReadout preview={preview} loading={previewing} weeklyMinutes={weeklyMinutes} />

            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={generate} disabled={!request || creating || infeasible}>
                {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden />}
                Build my plan
              </Button>
              {infeasible && (
                <span className="text-sm text-muted-foreground">
                  Move the date out or raise your hours first.
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PreviewReadout({
  preview,
  loading,
  weeklyMinutes,
}: {
  preview: PlanPreview | null;
  loading: boolean;
  weeklyMinutes: number;
}) {
  if (!preview) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
        {loading && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />}
        Checking whether that fits…
      </div>
    );
  }

  const { feasibility } = preview;
  return (
    <div
      aria-live="polite"
      className={cn(
        'rounded-lg border p-4 flex flex-col gap-2',
        feasibility.feasible ? 'border-border' : 'border-destructive',
      )}
    >
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <span><strong>{preview.topic_count}</strong> topics</span>
        <span><strong>{preview.sprint_count}</strong> weekly sprints</span>
        <span><strong>{hours(preview.total_minutes)}</strong> hours of content</span>
        {preview.already_completed > 0 && (
          <span className="text-muted-foreground">
            {preview.already_completed} already done, skipped
          </span>
        )}
      </div>

      {feasibility.feasible ? (
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <CalendarDays className="w-4 h-4" aria-hidden />
          Fits in {feasibility.weeks_needed} of your {feasibility.weeks_available} weeks.
        </p>
      ) : (
        <p className="text-sm text-destructive flex items-start gap-2">
          <TriangleAlert className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />
          <span>
            This needs {feasibility.weeks_needed} weeks but you have {feasibility.weeks_available}
            {feasibility.suggested_weekly_minutes > weeklyMinutes
              ? `, and about ${hours(feasibility.suggested_weekly_minutes)} hours a week rather than ${hours(weeklyMinutes)}`
              : ''}
            .
          </span>
        </p>
      )}
    </div>
  );
}
