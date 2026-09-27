import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, ArrowLeft, Copy, Loader2, Search, ShieldCheck, UserMinus } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiErrorMessage } from '@/api/verification';
import { timeAgo } from '@/api/educatorAnalytics';
import {
  addCoTeacher, getClassroom, getClassroomAnalytics, inviteStudents, removeCoTeacher, removeMember, updateClassroom,
} from '@/api/classrooms';
import type { ClassroomAnalytics, ClassroomDetail } from '@/api/classrooms';

const TOOLTIP_STYLE = {
  backgroundColor: 'var(--popover)', borderColor: 'var(--border)', borderRadius: '0.5rem',
  fontSize: '12px', color: 'var(--popover-foreground)',
};
const AXIS_TICK = { fontSize: 11, fill: 'var(--muted-foreground)' };

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

function copy(text: string, what: string) {
  navigator.clipboard.writeText(text).then(() => toast.success(`${what} copied`), () => toast.error('Could not copy'));
}

const pct = (v: number | null) => (v === null ? '—' : `${v}%`);
const signed = (v: number | null) => (v === null ? '—' : `${v > 0 ? '+' : ''}${v} pts`);

export default function ClassroomDetailPage() {
  const { classroomId = '' } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<ClassroomDetail | null>(null);
  const [analytics, setAnalytics] = useState<ClassroomAnalytics | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [emails, setEmails] = useState('');
  const [inviteResult, setInviteResult] = useState<{ invited: string[]; rejected: { email: string; reason: string }[] } | null>(null);
  const [coEmail, setCoEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => Promise.all([getClassroom(classroomId), getClassroomAnalytics(classroomId)])
    .then(([d, a]) => { setDetail(d); setAnalytics(a); setNewName(d.name); })
    .catch((e) => setError(apiErrorMessage(e, 'Could not load this classroom'))), [classroomId]);
  useEffect(() => { load(); }, [load]);

  const act = async (key: string, fn: () => Promise<unknown>, success: string) => {
    setBusy(key);
    try {
      await fn();
      toast.success(success);
      await load();
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const activeData = useMemo(() => Object.entries(analytics?.active_students_by_day || {}).map(([day, count]) => ({
    count, label: new Date(`${day}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' }),
  })), [analytics]);

  const students = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (analytics?.students || []).filter((s) => !needle || s.name.toLowerCase().includes(needle));
  }, [analytics, query]);

  if (!detail || !analytics) {
    return (
      <div className="w-full py-10 px-4 sm:px-6 font-sans">
        <div className="max-w-6xl mx-auto">
          {error ? <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">{error}</div>
            : <Loader2 className="w-6 h-6 animate-spin text-primary" />}
        </div>
      </div>
    );
  }

  const k = analytics.kpis;
  const sendInvites = () => act('invite', async () => {
    const list = emails.split(/[\s,;]+/).filter(Boolean);
    const res = await inviteStudents(classroomId, list);
    setInviteResult(res);
    setEmails('');
  }, 'Invites sent');

  return (
    <div className="w-full py-10 px-4 sm:px-6 font-sans">
      <div className="max-w-6xl mx-auto flex flex-col gap-6">
        <Button asChild variant="ghost" size="sm" className="self-start -ml-2">
          <Link to="/classrooms"><ArrowLeft className="w-4 h-4" /> Classrooms</Link>
        </Button>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl tracking-tight">{detail.name}</h1>
              {detail.status === 'archived' && <Badge variant="outline">Archived</Badge>}
            </div>
            <p className="text-muted-foreground">{detail.institution || 'No institution set'}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Join code</span>
            <span className="font-mono text-lg tracking-widest">{detail.join_code}</span>
            <Button size="icon" variant="ghost" aria-label="Copy join code" onClick={() => copy(detail.join_code, 'Join code')}><Copy className="w-4 h-4" /></Button>
          </div>
        </div>
        <p className="flex items-center gap-2 text-sm text-muted-foreground -mt-2">
          <ShieldCheck className="w-3.5 h-3.5" aria-hidden />
          Students joined with consent and can leave any time. Notes, flashcards and AI chats always stay private.
        </p>

        <Tabs defaultValue="overview" className="gap-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="students">Students ({k.members})</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="flex flex-col gap-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <Kpi label="Students" value={k.members} />
              <Kpi label="Active (7 days)" value={k.active_7d} />
              <Kpi label="Avg. quiz score" value={pct(k.avg_quiz_score)} />
              <Kpi label="Pre → post gain" value={signed(k.avg_improvement)} hint="Average assessment improvement" />
              <Kpi label="Topics completed" value={k.topics_completed} />
              <Kpi label="At risk" value={k.at_risk} hint="No activity for 7+ days" alert={k.at_risk > 0} />
            </div>
            <div className="grid lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="font-medium">Students active each day</CardTitle>
                  <CardDescription>Last 14 days</CardDescription>
                </CardHeader>
                <CardContent className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={activeData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.6} />
                      <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} interval={1} />
                      <YAxis allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={false} />
                      <Tooltip cursor={{ fill: 'var(--muted)', opacity: 0.5 }} contentStyle={TOOLTIP_STYLE} formatter={(v) => [v, 'Active students']} />
                      <Bar dataKey="count" fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={18} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="font-medium">Weakest topics</CardTitle>
                  <CardDescription>Lowest average quiz score across the class</CardDescription>
                </CardHeader>
                <CardContent className="h-60">
                  {analytics.weak_topics.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-sm text-muted-foreground text-center px-6">
                      Appears once students have taken a few quizzes.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart layout="vertical" data={analytics.weak_topics} margin={{ top: 0, right: 44, left: 0, bottom: 0 }}>
                        <CartesianGrid horizontal={false} stroke="var(--border)" strokeOpacity={0.6} />
                        <XAxis type="number" domain={[0, 100]} unit="%" tick={AXIS_TICK} tickLine={false} axisLine={false} />
                        <YAxis type="category" dataKey="title" width={150} tick={AXIS_TICK} tickLine={false} axisLine={false}
                          tickFormatter={(t: string) => (t.length > 24 ? `${t.slice(0, 23)}…` : t)} />
                        <Tooltip cursor={{ fill: 'var(--muted)', opacity: 0.5 }} contentStyle={TOOLTIP_STYLE}
                          formatter={(v, _n, item) => [`${v}% over ${item.payload.attempts} attempts`, 'Average score']} />
                        <Bar dataKey="avg_score" fill="var(--primary)" radius={[0, 4, 4, 0]} maxBarSize={16}>
                          <LabelList dataKey="avg_score" position="right" formatter={(v) => `${v}%`} style={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="students" className="flex flex-col gap-6">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="font-medium">Roster</CardTitle>
                    <CardDescription>Select a student to see their full learning journey</CardDescription>
                  </div>
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
                    <Input className="pl-9 sm:w-56" aria-label="Search students" placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {students.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    {k.members === 0 ? 'No students yet. Share the join code or send invites below.' : 'No students match your search.'}
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-left text-muted-foreground">
                        <tr className="border-b">
                          <th className="py-2 pr-4 font-normal">Student</th>
                          <th className="py-2 pr-4 font-normal text-right">XP</th>
                          <th className="py-2 pr-4 font-normal text-right">Streak</th>
                          <th className="py-2 pr-4 font-normal text-right">Quiz avg.</th>
                          <th className="py-2 pr-4 font-normal text-right">Topics</th>
                          <th className="py-2 pr-4 font-normal">Last active</th>
                          <th className="py-2 pr-4 font-normal">Status</th>
                          <th className="py-2 font-normal"><span className="sr-only">Actions</span></th>
                        </tr>
                      </thead>
                      <tbody>
                        {students.map((s) => {
                          const open = () => navigate(`/classrooms/${classroomId}/students/${encodeURIComponent(s.student_uid)}`);
                          return (
                            <tr key={s.student_uid} tabIndex={0} className="border-b last:border-0 cursor-pointer hover:bg-muted/50 focus-visible:bg-muted/50 outline-none"
                              onClick={open} onKeyDown={(e) => e.key === 'Enter' && open()}>
                              <td className="py-3 pr-4">{s.name}</td>
                              <td className="py-3 pr-4 text-right tabular-nums">{s.xp_total}</td>
                              <td className="py-3 pr-4 text-right tabular-nums">{s.current_streak}d</td>
                              <td className="py-3 pr-4 text-right tabular-nums">{pct(s.avg_quiz_score)}</td>
                              <td className="py-3 pr-4 text-right tabular-nums">{s.topics_completed}</td>
                              <td className="py-3 pr-4 text-muted-foreground whitespace-nowrap">{timeAgo(s.last_active)}</td>
                              <td className="py-3 pr-4">
                                {s.at_risk
                                  ? <Badge variant="destructive" className="gap-1"><AlertTriangle className="w-3 h-3" aria-hidden />At risk</Badge>
                                  : <Badge variant="outline">Active</Badge>}
                              </td>
                              <td className="py-3 text-right">
                                <Button size="icon" variant="ghost" aria-label={`Remove ${s.name}`} disabled={busy === s.student_uid}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (window.confirm(`Remove ${s.name} from this classroom? You will stop seeing their activity.`)) {
                                      act(s.student_uid, () => removeMember(classroomId, s.student_uid), `${s.name} removed`);
                                    }
                                  }}>
                                  <UserMinus className="w-4 h-4" />
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="font-medium">Invite students</CardTitle>
                <CardDescription>
                  Paste institution emails separated by commas or new lines. Each student gets a link to join and must consent.
                  {detail.allowed_email_domains.length > 0 && ` Only ${detail.allowed_email_domains.map((d) => '@' + d).join(', ')} addresses are accepted.`}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <Textarea rows={4} aria-label="Student emails" placeholder="student1@university.edu, student2@university.edu"
                  value={emails} onChange={(e) => setEmails(e.target.value)} disabled={detail.status !== 'active'} />
                <Button className="self-start" disabled={!emails.trim() || busy === 'invite' || detail.status !== 'active'} onClick={sendInvites}>
                  {busy === 'invite' ? 'Sending…' : 'Send invites'}
                </Button>
                {inviteResult && (
                  <div className="text-sm space-y-1">
                    <p>{inviteResult.invited.length} invite{inviteResult.invited.length === 1 ? '' : 's'} sent.</p>
                    {inviteResult.rejected.map((r) => <p key={r.email} className="text-destructive">{r.email}: {r.reason}</p>)}
                  </div>
                )}
                {detail.pending_invites.length > 0 && (
                  <div className="text-sm">
                    <p className="text-muted-foreground mb-1">Waiting to join ({detail.pending_invites.length})</p>
                    <div className="flex flex-wrap gap-1.5">{detail.pending_invites.map((e) => <Badge key={e} variant="outline">{e}</Badge>)}</div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="flex flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="font-medium">Joining</CardTitle>
                <CardDescription>
                  {detail.allowed_email_domains.length > 0
                    ? `Only ${detail.allowed_email_domains.map((d) => '@' + d).join(', ')} accounts can join.`
                    : 'Any student with the code can join (verify an institution email to restrict it to your domain).'}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col sm:flex-row gap-2">
                <Input readOnly value={detail.join_link} aria-label="Join link" className="font-mono text-xs" />
                <Button variant="outline" onClick={() => copy(detail.join_link, 'Join link')}><Copy className="w-4 h-4" /> Copy link</Button>
                {detail.is_owner && (
                  <Button variant="ghost" disabled={busy === 'rotate'}
                    onClick={() => window.confirm('Create a new join code? The old code and link stop working.') &&
                      act('rotate', () => updateClassroom(classroomId, { rotate_code: true }), 'New join code created')}>
                    New code
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="font-medium">Teachers</CardTitle>
                <CardDescription>Co-teachers see the same analytics. Only verified educators and researchers can be added.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <ul className="divide-y">
                  {detail.teachers.map((t) => (
                    <li key={t.uid} className="py-2 flex items-center justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <p className="truncate">{t.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{t.email}</p>
                      </div>
                      {t.role === 'owner' ? <Badge variant="outline">Owner</Badge> : detail.is_owner && (
                        <Button size="sm" variant="ghost" onClick={() => act(t.uid, () => removeCoTeacher(classroomId, t.uid), `${t.name} removed`)}>Remove</Button>
                      )}
                    </li>
                  ))}
                </ul>
                {detail.is_owner && (
                  <form className="flex flex-col sm:flex-row gap-2" onSubmit={(e) => {
                    e.preventDefault();
                    act('co', () => addCoTeacher(classroomId, coEmail), 'Co-teacher added').then(() => setCoEmail(''));
                  }}>
                    <Input type="email" aria-label="Co-teacher email" placeholder="colleague@university.edu" value={coEmail} onChange={(e) => setCoEmail(e.target.value)} />
                    <Button type="submit" variant="outline" disabled={!coEmail || busy === 'co'}>Add co-teacher</Button>
                  </form>
                )}
              </CardContent>
            </Card>

            {detail.is_owner && (
              <Card>
                <CardHeader>
                  <CardTitle className="font-medium">Classroom</CardTitle>
                  <CardDescription>Archiving stops new students from joining. Analytics stay available.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <form className="flex flex-col sm:flex-row gap-2 sm:items-end" onSubmit={(e) => {
                    e.preventDefault();
                    act('rename', () => updateClassroom(classroomId, { name: newName }), 'Classroom renamed');
                  }}>
                    <div className="space-y-2 flex-1">
                      <Label htmlFor="rename">Name</Label>
                      <Input id="rename" maxLength={100} value={newName} onChange={(e) => setNewName(e.target.value)} />
                    </div>
                    <Button type="submit" variant="outline" disabled={newName.trim().length < 3 || newName === detail.name}>Save</Button>
                  </form>
                  <Button variant={detail.status === 'active' ? 'destructive' : 'outline'} className="self-start" disabled={busy === 'archive'}
                    onClick={() => act('archive', () => updateClassroom(classroomId, { status: detail.status === 'active' ? 'archived' : 'active' }),
                      detail.status === 'active' ? 'Classroom archived' : 'Classroom reopened')}>
                    {detail.status === 'active' ? 'Archive classroom' : 'Reopen classroom'}
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
