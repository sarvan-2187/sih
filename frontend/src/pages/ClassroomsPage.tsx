import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2, Plus, School, Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { apiErrorMessage } from '@/api/verification';
import { createClassroom, leaveClassroom, listClassrooms } from '@/api/classrooms';
import type { ClassroomList } from '@/api/classrooms';
import { parseUtc } from '@/api/educatorAnalytics';

function Header({ subtitle, action }: { subtitle: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 shrink-0 rounded-2xl border bg-primary/10 border-primary/20 text-primary flex items-center justify-center">
          <School className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-3xl tracking-tight">Classrooms</h1>
          <p className="text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      {action}
    </div>
  );
}

export default function ClassroomsPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<ClassroomList | null>(null);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => listClassrooms().then(setData).catch((e) => setError(apiErrorMessage(e, 'Could not load classrooms'))), []);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    setBusy(true);
    try {
      const { id } = await createClassroom(name, description);
      toast.success('Classroom created');
      navigate(`/classrooms/${id}`);
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const leave = async (id: string, className: string) => {
    if (!window.confirm(`Leave “${className}”? Your faculty will immediately stop seeing your learning activity.`)) return;
    try {
      await leaveClassroom(id);
      toast.success(`You left ${className}`);
      load();
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  };

  return (
    <div className="w-full py-10 px-4 sm:px-6 font-sans">
      <div className="max-w-5xl mx-auto flex flex-col gap-8">
        {error && <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">{error}</div>}
        {!data ? (!error && <Loader2 className="w-6 h-6 animate-spin text-primary" />) : data.as === 'teacher' ? (
          <>
            <Header subtitle="Institutional classrooms give you oversight of your students' learning, with their consent."
              action={<Button onClick={() => setCreating(true)}><Plus className="w-4 h-4" /> New classroom</Button>} />
            {data.classrooms.length === 0 ? (
              <div className="flex flex-col items-center text-center gap-3 py-20 text-muted-foreground">
                <Users className="w-10 h-10" />
                <p>Create a classroom, then share its join code or invite students by their institution email.</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {data.classrooms.map((c) => (
                  <Link key={c.id} to={`/classrooms/${c.id}`} className="rounded-xl focus-visible:ring-2 focus-visible:ring-ring outline-none">
                    <Card className="h-full transition-colors hover:border-primary/40 animate-in fade-in duration-500">
                      <CardHeader>
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="font-medium">{c.name}</CardTitle>
                          {c.status === 'archived' ? <Badge variant="outline">Archived</Badge> : !c.is_owner && <Badge variant="outline">Co-teacher</Badge>}
                        </div>
                        <CardDescription>{c.institution || 'No institution set'}</CardDescription>
                      </CardHeader>
                      <CardContent className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{c.members} student{c.members === 1 ? '' : 's'}</span>
                        <span className="font-mono text-muted-foreground">Code {c.join_code}</span>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <Header subtitle="Join your institution's classroom with the code from your faculty." />
            <Card>
              <CardContent>
                <form className="flex flex-col sm:flex-row gap-2" onSubmit={(e) => {
                  e.preventDefault();
                  if (code.trim()) navigate(`/classrooms/join?code=${encodeURIComponent(code.trim())}`);
                }}>
                  <Input aria-label="Join code" placeholder="Enter join code, e.g. QDAD4S6U" value={code}
                    className="font-mono uppercase" maxLength={12} onChange={(e) => setCode(e.target.value)} />
                  <Button type="submit" disabled={!code.trim()}>Continue</Button>
                </form>
              </CardContent>
            </Card>
            {data.classrooms.length === 0 ? (
              <p className="text-sm text-muted-foreground">You haven't joined any classrooms.</p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {data.classrooms.map((c) => (
                  <Card key={c.id}>
                    <CardHeader>
                      <CardTitle className="font-medium">{c.name}</CardTitle>
                      <CardDescription>{[c.teacher, c.institution].filter(Boolean).join(' · ')}</CardDescription>
                    </CardHeader>
                    <CardContent className="flex items-center justify-between gap-2 text-sm">
                      <span className="text-muted-foreground">Joined {parseUtc(c.joined_at)?.toLocaleDateString(undefined, { dateStyle: 'medium' })}</span>
                      <Button size="sm" variant="ghost" onClick={() => leave(c.id, c.name)}>Leave</Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New classroom</DialogTitle>
            <DialogDescription>Students join with a code. If you verified an institution email, only that email domain can join.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cname">Name</Label>
              <Input id="cname" maxLength={100} placeholder="CSE-A · Quantum Computing 2026" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cdesc">Description (optional)</Label>
              <Textarea id="cdesc" maxLength={500} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
            <Button disabled={busy || name.trim().length < 3} onClick={create}>{busy ? 'Creating…' : 'Create classroom'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
