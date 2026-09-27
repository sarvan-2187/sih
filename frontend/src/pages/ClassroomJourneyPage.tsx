import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Loader2, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ActivityHeatmap, Timeline } from '@/components/StudentJourneyParts';
import { apiErrorMessage } from '@/api/verification';
import { parseUtc, timeAgo } from '@/api/educatorAnalytics';
import { getClassroomJourney } from '@/api/classrooms';
import type { ClassroomJourney } from '@/api/classrooms';
import { ProgressBar } from './StudentAnalyticsPage';

const pct = (v: number | null) => (v === null ? '—' : `${v}%`);

export default function ClassroomJourneyPage() {
  const { classroomId = '', studentUid = '' } = useParams();
  const [journey, setJourney] = useState<ClassroomJourney | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getClassroomJourney(classroomId, studentUid).then(setJourney).catch((e) => setError(apiErrorMessage(e, 'Could not load this student')));
  }, [classroomId, studentUid]);

  const back = (
    <Button asChild variant="ghost" size="sm" className="self-start -ml-2">
      <Link to={`/classrooms/${classroomId}`}><ArrowLeft className="w-4 h-4" /> {journey?.classroom.name || 'Classroom'}</Link>
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
  const stats: [string, string][] = [
    ['XP', String(s.xp_total)],
    ['Current streak', `${s.current_streak} day${s.current_streak === 1 ? '' : 's'}`],
    ['Quiz average', `${pct(s.avg_quiz_score)}${s.quizzes_taken ? ` · ${s.quizzes_taken} taken` : ''}`],
    ['Roadmap topics done', String(s.topics_completed)],
    ['Pre → post assessment', s.pre_score === null && s.post_score === null ? '—'
      : `${pct(s.pre_score)} → ${pct(s.post_score)}${s.improvement !== null ? ` (${s.improvement > 0 ? '+' : ''}${s.improvement})` : ''}`],
    ['Last active', timeAgo(s.last_active)],
  ];

  return (
    <div className="w-full py-10 px-4 sm:px-6 font-sans">
      <div className="max-w-5xl mx-auto flex flex-col gap-6">
        {back}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl tracking-tight">{journey.student.name}</h1>
            <p className="text-muted-foreground">
              Joined {journey.classroom.name} on {parseUtc(journey.joined_at)?.toLocaleDateString(undefined, { dateStyle: 'medium' })}
            </p>
          </div>
          {s.at_risk
            ? <Badge variant="destructive" className="gap-1"><AlertTriangle className="w-3 h-3" aria-hidden />At risk</Badge>
            : <Badge variant="outline">Active</Badge>}
        </div>
        <p className="flex items-center gap-2 text-sm text-muted-foreground -mt-2">
          <ShieldCheck className="w-3.5 h-3.5" aria-hidden />
          Shared with the student's consent. Notes, flashcards and AI chats stay private. This view is recorded in the audit log.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {stats.map(([label, value]) => (
            <Card key={label} className="py-4">
              <CardContent className="px-4">
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="text-xl mt-1 tabular-nums">{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-6 items-start">
          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="font-medium">Courses</CardTitle>
                <CardDescription>Lessons completed in each enrolled course</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {journey.courses.length === 0 && <p className="text-sm text-muted-foreground">Not enrolled in any courses yet.</p>}
                {journey.courses.map((c) => (
                  <div key={c.title} className="flex flex-col gap-1.5">
                    <div className="flex justify-between gap-3 text-sm">
                      <span className="truncate">{c.title}</span>
                      <span className="tabular-nums text-muted-foreground">{c.completed}/{c.total}</span>
                    </div>
                    <ProgressBar pct={c.total ? (c.completed / c.total) * 100 : 0} label={`${c.title} progress`} />
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="font-medium">Study activity</CardTitle>
                <CardDescription>Days the student studied on Qrious</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <ActivityHeatmap days={journey.activity_days} describe={(n) => (n ? 'studied' : 'no activity')} />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="font-medium">Learning journey</CardTitle>
              <CardDescription>Courses, quizzes, assessments, roadmap and badges, newest first</CardDescription>
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
