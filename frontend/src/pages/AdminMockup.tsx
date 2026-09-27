import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  ShieldCheck, Users, BookOpen, BadgeCheck, FileText, Bot, Settings, ScrollText, Info, ArrowLeft, Activity,
} from 'lucide-react';

// Static UI mockup: illustrates admin capabilities only. No API calls, nothing is editable.
// A real admin page is deliberately not exposed to demo users since it could modify the whole site.

const STATS = [
  { label: 'Total users', value: '1,284' },
  { label: 'Active courses', value: '42' },
  { label: 'Resources', value: '317' },
  { label: 'Pending reviews', value: '9' },
];

const USERS = [
  { name: 'Aarav Sharma', email: 'aarav@example.com', role: 'learner', status: 'Active' },
  { name: 'Dr. Meera Iyer', email: 'meera@example.com', role: 'educator', status: 'Active' },
  { name: 'Rohan Das', email: 'rohan@example.com', role: 'researcher', status: 'Active' },
  { name: 'Priya Nair', email: 'priya@example.com', role: 'learner', status: 'Suspended' },
];

const COURSES = [
  { title: 'Intro to Qubits', owner: 'Dr. Meera Iyer', state: 'Pending review' },
  { title: "Grover's Search in Practice", owner: 'Prof. K. Rao', state: 'Published' },
  { title: 'Quantum Error Correction', owner: 'Dr. S. Menon', state: 'Flagged' },
];

const VERIFICATIONS: { name: string; role: string; institution: string; checks: [string, boolean][] }[] = [
  { name: 'Dr. Kavya Menon', role: 'Educator', institution: 'IIT Madras',
    checks: [['Institutional email', true], ['ORCID', true], ['ID + selfie', true], ['Names match', true]] },
  { name: 'Arjun Pillai', role: 'Researcher', institution: 'IISc Bangalore',
    checks: [['Institutional email', true], ['ORCID', true], ['ID + selfie', true], ['Names match', false]] },
];

const FLAGS = [
  { label: 'AI Tutor (RAG)', on: true },
  { label: 'QRoute hardware jobs', on: true },
  { label: 'Live sessions', on: true },
  { label: 'New signups', on: false },
];

const AUDIT = [
  'Role changed: rohan@example.com → researcher',
  'Course published: "Grover\'s Search in Practice"',
  'Resource removed: duplicate PDF in "Intro to Qubits"',
  'Knowledge base re-indexed (317 documents)',
];

function Section({ icon: Icon, title, description, children }: {
  icon: typeof Users; title: string; description: string; children: React.ReactNode;
}) {
  return (
    <Card className="animate-in fade-in slide-in-from-bottom-2 duration-500">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl border bg-primary/10 border-primary/20 text-primary flex items-center justify-center">
            <Icon className="w-4 h-4" />
          </div>
          <div>
            <CardTitle className="font-medium">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export default function AdminMockup() {
  return (
    <div className="min-h-screen w-full bg-background text-foreground font-sans">
      <div className="sticky top-0 z-10 border-b border-primary/20 bg-primary/10 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-start sm:items-center gap-3">
          <Info className="w-4 h-4 mt-0.5 sm:mt-0 shrink-0 text-primary" />
          <p className="text-sm flex-1">
            <span className="font-medium text-primary">UI mockup.</span>{' '}
            This page only shows what an admin can access. Data is placeholder and nothing here can be changed.
          </p>
          <Button asChild variant="ghost" size="sm" className="shrink-0">
            <Link to="/login"><ArrowLeft className="w-4 h-4" /> Back to login</Link>
          </Button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 flex flex-col gap-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl border bg-primary/10 border-primary/20 text-primary flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl tracking-tight">Admin Console</h1>
            <p className="text-muted-foreground">Signed in as demo-admin@gmail.com (mockup)</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {STATS.map((s) => (
            <Card key={s.label} className="py-4">
              <CardContent className="px-4">
                <p className="text-sm text-muted-foreground">{s.label}</p>
                <p className="text-2xl mt-1 tabular-nums">{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Section icon={Users} title="User management" description="Change roles, verify educators, suspend or restore accounts.">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr className="border-b">
                  <th className="py-2 pr-4 font-normal">Name</th>
                  <th className="py-2 pr-4 font-normal">Role</th>
                  <th className="py-2 pr-4 font-normal">Status</th>
                  <th className="py-2 font-normal text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {USERS.map((u) => (
                  <tr key={u.email} className="border-b last:border-0">
                    <td className="py-3 pr-4">
                      <div>{u.name}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </td>
                    <td className="py-3 pr-4"><Badge variant="outline" className="capitalize">{u.role}</Badge></td>
                    <td className="py-3 pr-4">
                      <Badge variant={u.status === 'Active' ? 'secondary' : 'destructive'}>{u.status}</Badge>
                    </td>
                    <td className="py-3 text-right whitespace-nowrap">
                      <Button size="sm" variant="outline" disabled>Change role</Button>{' '}
                      <Button size="sm" variant="ghost" disabled>{u.status === 'Active' ? 'Suspend' : 'Restore'}</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section icon={BadgeCheck} title="Identity verification queue" description="Approve professors and researchers after automatic checks: institutional email, ORCID, government ID + selfie (Didit).">
          <ul className="divide-y">
            {VERIFICATIONS.map((r) => (
              <li key={r.name} className="py-3 flex flex-col md:flex-row md:items-center gap-3">
                <div className="min-w-0 md:w-56">
                  <div className="truncate">{r.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{r.role} · {r.institution}</div>
                </div>
                <div className="flex flex-wrap gap-1.5 flex-1">
                  {r.checks.map(([label, ok]) => (
                    <Badge key={label} variant={ok ? 'secondary' : 'destructive'}>{ok ? '✓' : '✕'} {label}</Badge>
                  ))}
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" disabled>Approve</Button>
                  <Button size="sm" variant="outline" disabled>Reject</Button>
                </div>
              </li>
            ))}
          </ul>
        </Section>

        <div className="grid md:grid-cols-2 gap-8">
          <Section icon={BookOpen} title="Course moderation" description="Approve, unpublish, or flag any educator's course.">
            <ul className="divide-y">
              {COURSES.map((c) => (
                <li key={c.title} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate">{c.title}</div>
                    <div className="text-xs text-muted-foreground">{c.owner}</div>
                  </div>
                  <Badge variant={c.state === 'Flagged' ? 'destructive' : c.state === 'Published' ? 'secondary' : 'outline'}>
                    {c.state}
                  </Badge>
                </li>
              ))}
            </ul>
          </Section>

          <Section icon={FileText} title="Resource library" description="Manage PDFs and videos stored in Backblaze B2.">
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">PDF documents</span><span className="tabular-nums">248</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Videos</span><span className="tabular-nums">69</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Storage used</span><span className="tabular-nums">18.4 GB</span></div>
              <div className="h-2 rounded-full bg-muted overflow-hidden"><div className="h-full w-[37%] bg-primary" /></div>
              <Button size="sm" variant="outline" disabled>Review flagged uploads</Button>
            </div>
          </Section>

          <Section icon={Bot} title="AI Tutor knowledge base" description="Curate the verified sources the RAG tutor is grounded in.">
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Indexed documents</span><span className="tabular-nums">317</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Last re-index</span><span>2 days ago</span></div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled>Add source</Button>
                <Button size="sm" variant="outline" disabled>Re-index</Button>
              </div>
            </div>
          </Section>

          <Section icon={Settings} title="Platform settings" description="Toggle features across the whole platform.">
            <ul className="space-y-3">
              {FLAGS.map((f) => (
                <li key={f.label} className="flex items-center justify-between text-sm">
                  <span>{f.label}</span>
                  <Switch checked={f.on} disabled aria-label={f.label} />
                </li>
              ))}
            </ul>
          </Section>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <Section icon={ScrollText} title="Audit log" description="Every admin action is recorded.">
            <ul className="space-y-2 text-sm">
              {AUDIT.map((a) => (
                <li key={a} className="flex gap-2"><span className="text-primary">•</span><span>{a}</span></li>
              ))}
            </ul>
          </Section>

          <Section icon={Activity} title="System health" description="Backend services behind the platform.">
            <ul className="space-y-2 text-sm">
              {['FastAPI backend', 'MongoDB Atlas', 'Qiskit Aer simulator', 'LLM gateway'].map((s) => (
                <li key={s} className="flex items-center justify-between">
                  <span>{s}</span>
                  <Badge variant="secondary">Operational</Badge>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      </div>
    </div>
  );
}
