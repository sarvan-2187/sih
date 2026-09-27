import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, BarChart3, CheckCircle2, Loader2, Lock, Search } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiErrorMessage } from '@/api/verification';
import { getAnalyticsOverview, getStudentRows, timeAgo, parseUtc } from '@/api/educatorAnalytics';
import type { AnalyticsOverview, StudentRow } from '@/api/educatorAnalytics';

const TOOLTIP_STYLE = {
  backgroundColor: 'var(--popover)', borderColor: 'var(--border)', borderRadius: '0.5rem',
  fontSize: '12px', color: 'var(--popover-foreground)',
};
const AXIS_TICK = { fontSize: 11, fill: 'var(--muted-foreground)' };

type SortKey = 'attention' | 'progress' | 'recent' | 'name';

function Kpi({ label, value, hint, alert }: { label: string; value: string | number; hint?: string; alert?: boolean }) {
  return (
    <Card className="py-4">
      <CardContent className="px-4">
        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
          {alert && <AlertTriangle className="w-3.5 h-3.5 text-destructive" aria-hidden />}{label}
        </p>
        <p className="text-2xl mt-1 tabular-nums">{value}</p>
        {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export function StatusBadge({ row }: { row: Pick<StudentRow, 'at_risk' | 'completed' | 'total'> }) {
  if (row.total && row.completed >= row.total) {
    return <Badge variant="secondary" className="gap-1"><CheckCircle2 className="w-3 h-3" aria-hidden />Completed</Badge>;
  }
  if (row.at_risk) {
    return <Badge variant="destructive" className="gap-1"><AlertTriangle className="w-3 h-3" aria-hidden />At risk</Badge>;
  }
  return <Badge variant="outline">{row.completed === 0 ? 'Not started' : 'On track'}</Badge>;
}

export function ProgressBar({ pct, label }: { pct: number; label: string }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden" role="progressbar" aria-label={label}
      aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function StudentAnalyticsPage() {
  const navigate = useNavigate();
  const [courseId, setCourseId] = useState('all');
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [rows, setRows] = useState<StudentRow[] | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('attention');

  useEffect(() => {
    setRows(null);
    setError('');
    Promise.all([getAnalyticsOverview(courseId), getStudentRows(courseId)])
      .then(([o, r]) => {
        // With a single course, open it directly so the lesson drop-off chart is visible.
        if (courseId === 'all' && o.courses.length === 1) { setCourseId(o.courses[0].id); return; }
        setOverview(o);
        setRows(r);
      })
      .catch((e) => setError(apiErrorMessage(e, 'Could not load analytics')));
  }, [courseId]);

  const enrollmentData = useMemo(() => Object.entries(overview?.enrollments_by_day || {}).map(([day, count]) => ({
    day, count, label: new Date(`${day}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
  })), [overview]);

  const visibleRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = (rows || []).filter((r) => !needle || r.name.toLowerCase().includes(needle) || r.course_title.toLowerCase().includes(needle));
    const lastActive = (r: StudentRow) => parseUtc(r.last_active)?.getTime() ?? 0;
    const sorters: Record<SortKey, (a: StudentRow, b: StudentRow) => number> = {
      attention: (a, b) => Number(b.at_risk) - Number(a.at_risk) || a.progress_pct - b.progress_pct,
      progress: (a, b) => b.progress_pct - a.progress_pct,
      recent: (a, b) => lastActive(b) - lastActive(a),
      name: (a, b) => a.name.localeCompare(b.name),
    };
    return [...filtered].sort(sorters[sort]);
  }, [rows, query, sort]);

  const allCourses = courseId === 'all';
  const k = overview?.kpis;

  return (
    <div className="w-full py-10 px-4 sm:px-6 font-sans">
      <div className="max-w-6xl mx-auto flex flex-col gap-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 shrink-0 rounded-2xl border bg-primary/10 border-primary/20 text-primary flex items-center justify-center">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-3xl tracking-tight">Student Analytics</h1>
              <p className="text-muted-foreground">How students are progressing through your courses.</p>
            </div>
          </div>
          <Select value={courseId} onValueChange={setCourseId}>
            <SelectTrigger className="md:w-72" aria-label="Course"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All courses</SelectItem>
              {overview?.courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <p className="flex items-center gap-2 text-sm text-muted-foreground -mt-4">
          <Lock className="w-3.5 h-3.5" aria-hidden />
          Showing only activity inside your courses. Students' other learning on Qrious stays private.
        </p>

        {error && <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">{error}</div>}

        {!overview || rows === null ? (
          !error && <Loader2 className="w-6 h-6 animate-spin text-primary" />
        ) : overview.courses.length === 0 ? (
          <div className="flex flex-col items-center text-center gap-3 py-20 text-muted-foreground">
            <BarChart3 className="w-10 h-10" />
            <p>You have no courses yet. Analytics appear once students enroll in your courses.</p>
            <Button asChild variant="outline"><Link to="/educator/courses">Create a course</Link></Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <Kpi label="Students" value={k!.students} hint={allCourses && k!.enrollments !== k!.students ? `${k!.enrollments} enrollments` : undefined} />
              <Kpi label="Active (7 days)" value={k!.active_7d} />
              <Kpi label="Avg. progress" value={`${k!.avg_progress_pct}%`} />
              <Kpi label="Completed" value={k!.completed} />
              <Kpi label="At risk" value={k!.at_risk} hint="Under 50% and idle 7+ days" alert={k!.at_risk > 0} />
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="font-medium">New enrollments</CardTitle>
                  <CardDescription>Students who joined each day, last 30 days</CardDescription>
                </CardHeader>
                <CardContent className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={enrollmentData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.6} />
                      <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} interval={6} />
                      <YAxis allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={false} />
                      <Tooltip cursor={{ fill: 'var(--muted)', opacity: 0.5 }} contentStyle={TOOLTIP_STYLE}
                        formatter={(v) => [v, 'Enrollments']} labelFormatter={(l) => l} />
                      <Bar dataKey="count" fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={14} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="font-medium">Lesson drop-off</CardTitle>
                  <CardDescription>Share of enrolled students who completed each lesson</CardDescription>
                </CardHeader>
                <CardContent className="h-64">
                  {overview.lesson_funnel && overview.lesson_funnel.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart layout="vertical" data={overview.lesson_funnel} margin={{ top: 0, right: 40, left: 0, bottom: 0 }}>
                        <CartesianGrid horizontal={false} stroke="var(--border)" strokeOpacity={0.6} />
                        <XAxis type="number" domain={[0, 100]} unit="%" tick={AXIS_TICK} tickLine={false} axisLine={false} />
                        <YAxis type="category" dataKey="title" width={130} tick={AXIS_TICK} tickLine={false} axisLine={false} />
                        <Tooltip cursor={{ fill: 'var(--muted)', opacity: 0.5 }} contentStyle={TOOLTIP_STYLE}
                          formatter={(v, _n, item) => [`${v}% (${item.payload.completed} students)`, item.payload.module_title]} />
                        <Bar dataKey="completed_pct" fill="var(--primary)" radius={[0, 4, 4, 0]} maxBarSize={16}>
                          <LabelList dataKey="completed_pct" position="right" formatter={(v) => `${v}%`}
                            style={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-center text-sm text-muted-foreground px-6">
                      {allCourses ? 'Pick a single course to see which lessons students stop at.' : 'This course has no lessons yet.'}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="font-medium">Students</CardTitle>
                    <CardDescription>Select a student to see their journey through the course</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
                      <Input className="pl-9 sm:w-56" aria-label="Search students" placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} />
                    </div>
                    <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
                      <SelectTrigger className="w-44" aria-label="Sort students"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="attention">Needs attention</SelectItem>
                        <SelectItem value="progress">Most progress</SelectItem>
                        <SelectItem value="recent">Recently active</SelectItem>
                        <SelectItem value="name">Name</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {visibleRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    {rows.length === 0 ? 'No students have enrolled yet.' : 'No students match your search.'}
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-left text-muted-foreground">
                        <tr className="border-b">
                          <th className="py-2 pr-4 font-normal">Student</th>
                          {allCourses && <th className="py-2 pr-4 font-normal">Course</th>}
                          <th className="py-2 pr-4 font-normal w-48">Progress</th>
                          <th className="py-2 pr-4 font-normal">Last active</th>
                          <th className="py-2 font-normal">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleRows.map((r) => (
                          <tr key={`${r.student_uid}-${r.course_id}`} tabIndex={0}
                            className="border-b last:border-0 cursor-pointer hover:bg-muted/50 focus-visible:bg-muted/50 outline-none"
                            onClick={() => navigate(`/educator/analytics/${r.course_id}/${encodeURIComponent(r.student_uid)}`)}
                            onKeyDown={(e) => e.key === 'Enter' && navigate(`/educator/analytics/${r.course_id}/${encodeURIComponent(r.student_uid)}`)}>
                            <td className="py-3 pr-4">{r.name}</td>
                            {allCourses && <td className="py-3 pr-4 text-muted-foreground">{r.course_title}</td>}
                            <td className="py-3 pr-4">
                              <div className="flex items-center gap-2">
                                <ProgressBar pct={r.progress_pct} label={`${r.name} progress`} />
                                <span className="tabular-nums text-xs text-muted-foreground w-16 text-right">{r.completed}/{r.total}</span>
                              </div>
                            </td>
                            <td className="py-3 pr-4 text-muted-foreground whitespace-nowrap">{timeAgo(r.last_active)}</td>
                            <td className="py-3"><StatusBadge row={r} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
