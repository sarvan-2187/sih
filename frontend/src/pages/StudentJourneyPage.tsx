import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Lock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ActivityHeatmap, Timeline } from '@/components/StudentJourneyParts';
import { apiErrorMessage } from '@/api/verification';
import { getStudentJourney, parseUtc, timeAgo } from '@/api/educatorAnalytics';
import type { StudentJourney } from '@/api/educatorAnalytics';
import { ProgressBar, StatusBadge } from './StudentAnalyticsPage';

export default function StudentJourneyPage() {
  const { courseId = '', studentUid = '' } = useParams();
  const [journey, setJourney] = useState<StudentJourney | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getStudentJourney(courseId, studentUid).then(setJourney).catch((e) => setError(apiErrorMessage(e, 'Could not load this student')));
  }, [courseId, studentUid]);

  const back = (
    <Button asChild variant="ghost" size="sm" className="self-start -ml-2">
      <Link to="/educator/analytics"><ArrowLeft className="w-4 h-4" /> Student Analytics</Link>
    </Button>
  );

  if (!journey) {
    return (
      <div className="w-full py-10 px-4 sm:px-6 font-sans">
        <div className="max-w-5xl mx-auto flex flex-col gap-6">
          {back}
          {error ? <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">{error}</div>
            : <Loader2 className="w-6 h-6 animate-spin text-primary" />}
        </div>
      </div>
    );
  }

  const s = journey.summary;
  return (
    <div className="w-full py-10 px-4 sm:px-6 font-sans">
      <div className="max-w-5xl mx-auto flex flex-col gap-6">
        {back}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl tracking-tight">{journey.student.name}</h1>
            <p className="text-muted-foreground">{journey.course.title} · enrolled {timeAgo(journey.enrolled_at)}</p>
          </div>
          <StatusBadge row={s} />
        </div>
        <p className="flex items-center gap-2 text-sm text-muted-foreground -mt-2">
          <Lock className="w-3.5 h-3.5" aria-hidden /> Showing activity inside this course only.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            ['Progress', `${s.progress_pct}%`],
            ['Lessons completed', `${s.completed} of ${s.total}`],
            ['Last active', timeAgo(s.last_active)],
            ['Enrolled', parseUtc(journey.enrolled_at)?.toLocaleDateString(undefined, { dateStyle: 'medium' }) ?? '—'],
          ].map(([label, value]) => (
            <Card key={label} className="py-4">
              <CardContent className="px-4">
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="text-2xl mt-1 tabular-nums">{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-6 items-start">
          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="font-medium">Module progress</CardTitle>
                <CardDescription>Lessons completed in each module</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {journey.modules.length === 0 && <p className="text-sm text-muted-foreground">This course has no lessons yet.</p>}
                {journey.modules.map((m) => (
                  <div key={m.title} className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-sm">
                      <span>{m.title}</span>
                      <span className="tabular-nums text-muted-foreground">{m.completed}/{m.total}</span>
                    </div>
                    <ProgressBar pct={m.total ? (m.completed / m.total) * 100 : 0} label={`${m.title} progress`} />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="font-medium">Study activity</CardTitle>
                <CardDescription>Days with lessons completed in this course</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <ActivityHeatmap days={journey.activity_days} describe={(n) => `${n} lesson${n === 1 ? '' : 's'} completed`} />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="font-medium">Journey</CardTitle>
              <CardDescription>Everything this student has done in the course, newest first</CardDescription>
            </CardHeader>
            <CardContent>
              <Timeline events={journey.timeline} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
