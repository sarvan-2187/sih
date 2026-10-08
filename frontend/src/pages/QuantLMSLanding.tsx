// TEMP(QuantLMS): alternate purple SaaS-style landing page, shown when QUANTLMS_LANDING_PAGE=1.
import { useState, type CSSProperties, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight, Atom, Award, BarChart3, Book, BookOpen, Bot, Check, ChevronDown, Compass, Cpu,
  FileText, FlaskConical, Globe, GraduationCap, Layers, Lightbulb, Map, Minus, School, Search,
  Send, Sparkles, Target, Trophy, Users, Video, X, Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import SmoothScroll from '@/components/SmoothScroll';

const DARK_VARS = {
  '--lp-bg': '#07060b',
  '--lp-fg': '#ffffff',
  '--lp-muted': '#a1a1aa',
  '--lp-subtle': '#71717a',
  '--lp-card': 'rgba(255,255,255,0.03)',
  '--lp-card-strong': 'rgba(255,255,255,0.06)',
  '--lp-border': 'rgba(255,255,255,0.08)',
  '--lp-accent': '#c4b5fd',
} as CSSProperties;

const LIGHT_VARS = {
  '--lp-bg': '#fafafa',
  '--lp-fg': '#18181b',
  '--lp-muted': '#52525b',
  '--lp-subtle': '#a1a1aa',
  '--lp-card': '#ffffff',
  '--lp-card-strong': '#f4f4f5',
  '--lp-border': '#e4e4e7',
  '--lp-accent': '#6d28d9',
} as CSSProperties;

const card = 'rounded-2xl border border-[var(--lp-border)] bg-[var(--lp-card)]';
const muted = 'text-[var(--lp-muted)]';
const subtle = 'text-[var(--lp-subtle)]';

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.6, ease: 'easeOut' as const },
};

function Glow({ className }: { className?: string }) {
  return <div aria-hidden className={cn('pointer-events-none absolute rounded-full bg-violet-600/30 blur-[120px]', className)} />;
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <div className="text-xs tracking-[0.2em] uppercase text-[var(--lp-accent)] mb-3">{children}</div>;
}

function SectionHead({ eyebrow, title, sub, center }: { eyebrow?: string; title: ReactNode; sub?: string; center?: boolean }) {
  return (
    <motion.div {...fadeUp} className={cn('max-w-2xl mb-12', center && 'mx-auto text-center')}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2 className="text-3xl md:text-5xl font-medium tracking-[-0.03em] leading-[1.1]">{title}</h2>
      {sub && <p className={cn('mt-4 text-base md:text-lg', muted)}>{sub}</p>}
    </motion.div>
  );
}

function PrimaryCta({ to, children, className }: { to: string; children: ReactNode; className?: string }) {
  return (
    <Link
      to={to}
      className={cn(
        'inline-flex items-center gap-2 rounded-full bg-violet-600 hover:bg-violet-500 text-white px-6 py-3 text-sm font-medium transition-colors shadow-[0_0_40px_-8px_rgba(139,92,246,0.8)] group',
        className,
      )}
    >
      {children}
      <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
    </Link>
  );
}

/* ---------------------------------------------------------------- nav */

function Nav({ ctaTo, loggedIn }: { ctaTo: string; loggedIn: boolean }) {
  return (
    <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-6xl flex items-center justify-between rounded-full border border-[var(--lp-border)] bg-[var(--lp-bg)]/70 backdrop-blur-xl px-4 md:px-6 py-2.5">
      <Link to="/" className="flex items-center gap-2">
        <img src="/apple-touch-icon.png" alt="QuantLMS" className="w-7 h-7 rounded-full" />
        <span className="text-lg tracking-tight">QuantLMS</span>
      </Link>
      <div className={cn('hidden md:flex items-center gap-7 text-sm', muted)}>
        {[['Features', '#features'], ['Compare', '#compare'], ['Who it’s for', '#audience'], ['Pricing', '#pricing'], ['FAQ', '#faq']].map(([label, href]) => (
          <a key={href} href={href} className="hover:text-[var(--lp-fg)] transition-colors">{label}</a>
        ))}
      </div>
      <div className="flex items-center gap-4">
        {!loggedIn && <Link to="/login" className={cn('hidden sm:block text-sm hover:text-[var(--lp-fg)]', muted)}>Sign in</Link>}
        <Link to={ctaTo} className="rounded-full bg-violet-600 hover:bg-violet-500 text-white text-sm px-4 py-2 transition-colors">
          {loggedIn ? 'Dashboard' : 'Get started'}
        </Link>
      </div>
    </nav>
  );
}

/* ---------------------------------------------------------------- dashboard mockup */

const TABS = ['Courses', 'Roadmap', 'Q-Rating', 'Analytics'] as const;
type Tab = (typeof TABS)[number];

function DashboardMock({ tab }: { tab: Tab }) {
  const bars = tab === 'Analytics' ? [40, 65, 52, 80, 71, 90, 84] : tab === 'Q-Rating' ? [30, 42, 38, 55, 61, 58, 72] : [55, 35, 70, 48, 62, 44, 76];
  const stats: Record<Tab, [string, string][]> = {
    Courses: [['Active courses', '4'], ['Lessons done', '38'], ['Streak', '12 days']],
    Roadmap: [['Current stage', 'Gates'], ['Topics left', '9'], ['Next quiz', 'Today']],
    'Q-Rating': [['Rating', '1,482'], ['Rank', '#27'], ['Rated quizzes', '16']],
    Analytics: [['Avg. score', '84%'], ['Study time', '21h'], ['Improvement', '+18%']],
  };
  const nav = [BookOpen, Map, Trophy, BarChart3, Book, Globe, Lightbulb];

  return (
    <div className="flex h-[320px] md:h-[420px] text-left">
      <div className="hidden sm:flex w-14 flex-col items-center gap-4 py-5 border-r border-[var(--lp-border)]">
        <img src="/apple-touch-icon.png" alt="" className="w-6 h-6 rounded-full" />
        {nav.map((Icon, i) => (
          <div key={i} className={cn('w-8 h-8 rounded-lg flex items-center justify-center', i === TABS.indexOf(tab) ? 'bg-violet-600/20 text-[var(--lp-accent)]' : subtle)}>
            <Icon className="w-4 h-4" />
          </div>
        ))}
      </div>
      <div className="flex-1 p-4 md:p-6 flex flex-col gap-4 overflow-hidden">
        <div className="flex items-center justify-between">
          <div>
            <div className={cn('text-xs', subtle)}>Welcome back</div>
            <div className="text-base md:text-lg">{tab}</div>
          </div>
          <div className={cn('hidden md:flex items-center gap-2 rounded-full border border-[var(--lp-border)] px-3 py-1.5 text-xs', subtle)}>
            <Search className="w-3.5 h-3.5" /> Search lessons, notes, algorithms
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {stats[tab].map(([k, v]) => (
            <div key={k} className="rounded-xl border border-[var(--lp-border)] bg-[var(--lp-card-strong)] p-3">
              <div className={cn('text-[11px]', subtle)}>{k}</div>
              <div className="text-lg md:text-2xl tracking-tight mt-1">{v}</div>
            </div>
          ))}
        </div>
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3 min-h-0">
          <div className="md:col-span-2 rounded-xl border border-[var(--lp-border)] bg-[var(--lp-card-strong)] p-4 flex flex-col">
            <div className={cn('text-xs mb-3', subtle)}>Weekly progress</div>
            <div className="flex-1 flex items-end gap-2">
              {bars.map((h, i) => (
                <motion.div
                  key={`${tab}-${i}`}
                  className="flex-1 rounded-t-md bg-gradient-to-t from-violet-700 to-violet-400"
                  initial={{ height: 0 }}
                  animate={{ height: `${h}%` }}
                  transition={{ duration: 0.5, delay: i * 0.04 }}
                />
              ))}
            </div>
          </div>
          <div className="hidden md:flex rounded-xl border border-[var(--lp-border)] bg-[var(--lp-card-strong)] p-4 flex-col gap-3">
            <div className={cn('text-xs', subtle)}>Up next</div>
            {['Superposition quiz', 'Bell states lab', 'Grover’s search'].map((t, i) => (
              <div key={t} className="flex items-center gap-2 text-sm">
                <span className={cn('w-2 h-2 rounded-full', i === 0 ? 'bg-violet-500' : 'bg-[var(--lp-border)]')} />
                {t}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function AppWindow({ children }: { children: ReactNode }) {
  return (
    <div className="relative rounded-2xl border border-[var(--lp-border)] bg-[var(--lp-bg)] shadow-[0_40px_120px_-30px_rgba(124,58,237,0.55)] overflow-hidden">
      <div className="flex items-center gap-1.5 px-4 py-3 border-b border-[var(--lp-border)]">
        <span className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
        <span className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/70" />
        <span className={cn('ml-3 text-xs', subtle)}>app.quantlms</span>
      </div>
      {children}
    </div>
  );
}

/* ---------------------------------------------------------------- sections */

function Hero({ ctaTo, loggedIn }: { ctaTo: string; loggedIn: boolean }) {
  return (
    <section className="relative pt-36 md:pt-44 pb-16 px-4">
      <Glow className="w-[700px] h-[500px] -top-40 left-1/2 -translate-x-1/2" />
      <div className="relative max-w-4xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs text-[var(--lp-accent)] mb-8"
        >
          <Sparkles className="w-3.5 h-3.5" /> AI tutor grounded in verified quantum resources
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-4xl sm:text-6xl md:text-7xl font-medium tracking-[-0.04em] leading-[1.02]"
        >
          Learn quantum faster.
          <br />
          QuantLMS guides you.
          <br />
          <span className="text-[var(--lp-accent)]">All in one platform.</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className={cn('mt-6 text-base md:text-lg max-w-2xl mx-auto', muted)}
        >
          Courses, roadmaps, quizzes, a 3D Bloch sphere, notebooks and an AI tutor — one browser tab, no installs,
          built for learners, educators and researchers.
        </motion.p>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <PrimaryCta to={ctaTo}>{loggedIn ? 'Go to dashboard' : 'Start learning free'}</PrimaryCta>
          <a href="#features" className={cn('text-sm hover:text-[var(--lp-fg)] transition-colors', muted)}>See what’s inside</a>
        </motion.div>
      </div>
    </section>
  );
}

function DashboardSection() {
  const [tab, setTab] = useState<Tab>('Courses');
  return (
    <section className="relative px-4 pb-28">
      <div className="max-w-6xl mx-auto">
        <SectionHead title="Your learning, one dashboard." sub="Courses, roadmap, rating and analytics — all at a glance." />
        <div className="flex flex-wrap gap-2 mb-5">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'rounded-full px-4 py-1.5 text-sm border transition-colors',
                t === tab ? 'bg-violet-600 border-violet-600 text-white' : cn('border-[var(--lp-border)] hover:text-[var(--lp-fg)]', muted),
              )}
            >
              {t}
            </button>
          ))}
        </div>
        <motion.div {...fadeUp}>
          <AppWindow><DashboardMock tab={tab} /></AppWindow>
        </motion.div>
      </div>
    </section>
  );
}

function JourneySection() {
  const steps = [
    { icon: Target, title: 'Pre-assessment', desc: 'A short diagnostic places you on the right roadmap stage, so you skip what you already know.', span: 'md:col-span-2' },
    { icon: BookOpen, title: 'Courses & resources', desc: 'Videos, PDFs, slides and interactive labs, curated by verified educators.', span: '' },
    { icon: Zap, title: 'Learn & track', desc: 'Streaks, focus mode, Qplanner study plans and live progress on every topic.', span: '' },
    { icon: Award, title: 'Quiz & certificate', desc: 'Post-assessments feed your Q-Rating, unlock badges and earn a downloadable certificate.', span: 'md:col-span-2' },
  ];
  return (
    <section id="features" className="relative px-4 pb-28">
      <div className="max-w-6xl mx-auto">
        <SectionHead eyebrow="The loop" title="From first lesson to final certificate" sub="Every module is wired into the same assess → learn → prove loop." />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {steps.map(({ icon: Icon, title, desc, span }, i) => (
            <motion.div key={title} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.08 }} className={cn(card, 'p-6 md:p-8 relative overflow-hidden', span)}>
              <div className="w-10 h-10 rounded-xl bg-violet-600/15 text-[var(--lp-accent)] flex items-center justify-center mb-6">
                <Icon className="w-5 h-5" />
              </div>
              <div className={cn('text-xs mb-1', subtle)}>Step {i + 1}</div>
              <h3 className="text-xl tracking-tight mb-2">{title}</h3>
              <p className={cn('text-sm leading-relaxed', muted)}>{desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HubSection() {
  const tools = [
    { icon: Bot, name: 'AI Tutor', note: 'RAG-grounded answers' },
    { icon: Globe, name: '3D Bloch Sphere', note: 'See every rotation' },
    { icon: Book, name: 'QBook', note: 'Qiskit notebooks in the browser' },
    { icon: Lightbulb, name: 'QStudio', note: 'Sources → slides, Q&A' },
    { icon: Compass, name: 'Algorithm Constellation', note: 'Map of quantum algorithms' },
    { icon: Cpu, name: 'QForge', note: 'Build a quantum computer' },
    { icon: FileText, name: 'Notes & library', note: 'Everything searchable' },
    { icon: Video, name: 'Live sessions', note: 'Classrooms in real time' },
  ];
  return (
    <section className="relative px-4 pb-28 overflow-hidden">
      <Glow className="w-[600px] h-[400px] top-20 -left-40 bg-violet-700/20" />
      <div className="relative max-w-6xl mx-auto">
        <SectionHead center title="The knowledge hub for quantum" sub="Theory, simulation and practice live side by side — nothing to install." />
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-center">
          <motion.div {...fadeUp} className="lg:col-span-3">
            <AppWindow>
              <div className="p-5 md:p-6 grid grid-cols-2 gap-3">
                {['Qubits & superposition', 'Entanglement', 'Quantum gates', 'Grover’s algorithm', 'Shor’s algorithm', 'Error correction'].map((t, i) => (
                  <div key={t} className="rounded-xl border border-[var(--lp-border)] bg-[var(--lp-card-strong)] p-4">
                    <div className="h-16 rounded-lg mb-3 bg-gradient-to-br from-violet-600/40 via-fuchsia-500/10 to-transparent flex items-center justify-center">
                      <Atom className={cn('w-6 h-6', i % 2 ? 'text-[var(--lp-accent)]' : 'text-[var(--lp-accent)]')} />
                    </div>
                    <div className="text-sm">{t}</div>
                    <div className={cn('text-xs mt-1', subtle)}>{3 + i} resources</div>
                  </div>
                ))}
              </div>
            </AppWindow>
          </motion.div>
          <div className="lg:col-span-2 flex flex-col gap-2.5">
            {tools.map(({ icon: Icon, name, note }, i) => (
              <motion.div
                key={name}
                {...fadeUp}
                transition={{ ...fadeUp.transition, delay: i * 0.05 }}
                className={cn(card, 'flex items-center gap-3 px-4 py-3 hover:border-violet-500/40 transition-colors')}
              >
                <Icon className="w-4 h-4 text-[var(--lp-accent)] shrink-0" />
                <span className="text-sm">{name}</span>
                <span className={cn('ml-auto text-xs text-right', subtle)}>{note}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

type Cell = boolean | 'partial';

function CompareSection() {
  const cols = ['QuantLMS', 'Video courses', 'Textbooks', 'Generic LMS'];
  const rows: [string, Cell[]][] = [
    ['Real Qiskit Aer simulation', [true, false, false, false]],
    ['Interactive 3D Bloch sphere', [true, 'partial', false, false]],
    ['AI tutor grounded in verified sources', [true, false, false, 'partial']],
    ['Pre/post assessments & Q-Rating', [true, 'partial', false, true]],
    ['Personal study planner', [true, false, false, 'partial']],
    ['Educator classrooms & live sessions', [true, false, false, true]],
    ['Runs entirely in the browser', [true, true, false, true]],
  ];
  const mark = (v: Cell, hi: boolean) =>
    v === true ? <Check className={cn('w-4 h-4 mx-auto', hi ? 'text-[var(--lp-accent)]' : 'text-emerald-400')} />
    : v === 'partial' ? <Minus className={cn('w-4 h-4 mx-auto', subtle)} />
    : <X className={cn('w-4 h-4 mx-auto', subtle)} />;

  return (
    <section id="compare" className="relative px-4 pb-28">
      <div className="max-w-5xl mx-auto">
        <SectionHead center eyebrow="Why QuantLMS" title="Not just videos. A full quantum lab." sub="Everything a quantum course needs — in one place instead of five tabs." />
        <motion.div {...fadeUp} className={cn(card, 'overflow-x-auto')}>
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-[var(--lp-border)]">
                <th className="text-left font-normal p-4" />
                {cols.map((c, i) => (
                  <th key={c} className={cn('p-4 font-normal', i === 0 ? 'bg-violet-600/15 text-[var(--lp-accent)]' : muted)}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(([label, cells]) => (
                <tr key={label} className="border-b border-[var(--lp-border)] last:border-0">
                  <td className="p-4">{label}</td>
                  {cells.map((v, i) => (
                    <td key={i} className={cn('p-4', i === 0 && 'bg-violet-600/10')}>{mark(v, i === 0)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      </div>
    </section>
  );
}

function AudienceSection() {
  const groups = [
    { icon: GraduationCap, title: 'Learners', desc: 'Start from zero or brush up. Follow a roadmap, simulate circuits and prove it with quizzes.', points: ['Guided roadmap', 'Streaks & badges', 'AI tutor on every lesson'] },
    { icon: School, title: 'Educators', desc: 'Run classrooms, publish courses and see exactly where students are stuck.', points: ['Course editor', 'Live sessions', 'Per-student analytics'] },
    { icon: FlaskConical, title: 'Researchers & institutions', desc: 'Verified access for labs and universities, with notebooks and algorithm references.', points: ['ORCID verification', 'QBook notebooks', 'Institutional access'] },
  ];
  return (
    <section id="audience" className="relative px-4 pb-28">
      <div className="max-w-6xl mx-auto">
        <SectionHead eyebrow="Audience" title="Who is QuantLMS for?" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {groups.map(({ icon: Icon, title, desc, points }, i) => (
            <motion.div key={title} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.08 }} className={cn(card, 'p-6 md:p-8 flex flex-col')}>
              <Icon className="w-6 h-6 text-[var(--lp-accent)] mb-6" />
              <h3 className="text-xl tracking-tight mb-2">{title}</h3>
              <p className={cn('text-sm leading-relaxed mb-6', muted)}>{desc}</p>
              <ul className="mt-auto flex flex-col gap-2 text-sm">
                {points.map((p) => (
                  <li key={p} className="flex items-center gap-2"><Check className="w-4 h-4 text-[var(--lp-accent)]" />{p}</li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TryItSection({ ctaTo }: { ctaTo: string }) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const prompts = ['Why does measuring a qubit collapse it?', 'Explain the Hadamard gate simply', 'How does Grover’s algorithm speed up search?'];
  return (
    <section className="relative px-4 pb-28 overflow-hidden">
      <Glow className="w-[500px] h-[300px] bottom-0 right-0 bg-fuchsia-600/15" />
      <div className="relative max-w-3xl mx-auto">
        <SectionHead center eyebrow="Try it yourself" title="Ask the AI tutor anything" sub="Answers are grounded in verified quantum resources — not guesses." />
        <motion.div {...fadeUp} className={cn(card, 'p-4 md:p-6')}>
          <div className="flex flex-col gap-2 mb-4">
            {prompts.map((p) => (
              <button key={p} onClick={() => setQ(p)} className={cn('text-left text-sm rounded-xl border border-[var(--lp-border)] px-4 py-3 hover:border-violet-500/40 hover:text-[var(--lp-fg)] transition-colors', muted)}>
                {p}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => { e.preventDefault(); navigate(ctaTo); }}
            className="flex items-center gap-2 rounded-xl border border-[var(--lp-border)] bg-[var(--lp-card-strong)] pl-4 pr-2 py-2"
          >
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Type a quantum question…"
              aria-label="Question for the AI tutor"
              className="flex-1 bg-transparent outline-none text-sm placeholder:text-[var(--lp-subtle)]"
            />
            <button type="submit" className="rounded-lg bg-violet-600 hover:bg-violet-500 text-white px-3 py-2 text-sm inline-flex items-center gap-1.5 transition-colors">
              <Send className="w-4 h-4" /> Ask
            </button>
          </form>
          <p className={cn('mt-3 text-xs text-center', subtle)}>Sign in to get your answer.</p>
        </motion.div>
      </div>
    </section>
  );
}

function PricingSection({ ctaTo }: { ctaTo: string }) {
  const plans = [
    { name: 'Learner', price: 'Free', desc: 'Everything you need to learn quantum computing.', features: ['All courses & roadmap', 'AI tutor & Bloch sphere', 'QBook notebooks', 'Certificates & badges'], cta: 'Start learning', highlight: false },
    { name: 'Educator', price: 'Free', desc: 'For verified teachers running classes.', features: ['Everything in Learner', 'Course editor & uploads', 'Classrooms & live sessions', 'Student analytics'], cta: 'Apply as educator', highlight: true },
    { name: 'Institution', price: 'Custom', desc: 'For universities and research labs.', features: ['Institutional access', 'Researcher verification', 'Bulk onboarding', 'Priority support'], cta: 'Talk to us', highlight: false },
  ];
  return (
    <section id="pricing" className="relative px-4 pb-28">
      <div className="max-w-6xl mx-auto">
        <SectionHead eyebrow="Pricing" title="Simple, fair access" sub="Free for learners and educators. Institutions get a plan that fits." />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((p, i) => (
            <motion.div
              key={p.name}
              {...fadeUp}
              transition={{ ...fadeUp.transition, delay: i * 0.08 }}
              className={cn(
                'rounded-2xl border p-6 md:p-8 flex flex-col relative overflow-hidden',
                p.highlight ? 'border-violet-500/60 bg-gradient-to-b from-violet-600/25 to-[var(--lp-card)] shadow-[0_30px_80px_-30px_rgba(124,58,237,0.7)]' : 'border-[var(--lp-border)] bg-[var(--lp-card)]',
              )}
            >
              {p.highlight && <span className="absolute top-5 right-5 rounded-full bg-violet-600 text-white text-[11px] px-2.5 py-0.5">Popular</span>}
              <div className={cn('text-sm', muted)}>{p.name}</div>
              <div className="text-4xl tracking-tight my-3">{p.price}</div>
              <p className={cn('text-sm mb-6', muted)}>{p.desc}</p>
              <ul className="flex flex-col gap-2.5 text-sm mb-8">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-2"><Check className="w-4 h-4 text-[var(--lp-accent)]" />{f}</li>
                ))}
              </ul>
              <Link
                to={ctaTo}
                className={cn(
                  'mt-auto text-center rounded-full py-2.5 text-sm transition-colors',
                  p.highlight ? 'bg-violet-600 hover:bg-violet-500 text-white' : 'border border-[var(--lp-border)] hover:border-violet-500/50',
                )}
              >
                {p.cta}
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FaqSection() {
  const faqs = [
    ['Do I need to install anything?', 'No. QuantLMS runs entirely in the browser — simulations, notebooks and the AI tutor all run through our backend.'],
    ['Is the simulation real?', 'Yes. Circuits run on Qiskit Aer, and you can import or export them as OpenQASM.'],
    ['How does the AI tutor avoid wrong answers?', 'It retrieves from a curated library of verified quantum resources before answering, so responses stay grounded in real material.'],
    ['Can I teach my own class?', 'Yes. Verified educators can create courses, upload PDFs and videos, run live sessions and track each student’s progress.'],
    ['What do I get when I finish a course?', 'A post-assessment that feeds your Q-Rating, badges for milestones, and a downloadable certificate.'],
    ['Is it free?', 'Learners and educators use QuantLMS for free. Institutions can contact us for institutional access.'],
  ];
  return (
    <section id="faq" className="relative px-4 pb-28">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-10">
        <SectionHead title="Frequently asked questions" />
        <div className="lg:col-span-2 flex flex-col gap-2">
          {faqs.map(([q, a]) => (
            <details key={q} className={cn(card, 'group px-5 py-4 [&_summary::-webkit-details-marker]:hidden')}>
              <summary className="flex items-center justify-between gap-4 cursor-pointer list-none text-sm md:text-base">
                {q}
                <ChevronDown className={cn('w-4 h-4 shrink-0 transition-transform group-open:rotate-180', subtle)} />
              </summary>
              <p className={cn('mt-3 text-sm leading-relaxed', muted)}>{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta({ ctaTo, loggedIn }: { ctaTo: string; loggedIn: boolean }) {
  return (
    <section className="relative px-4 py-28 md:py-40 overflow-hidden text-center">
      <Glow className="w-[900px] h-[500px] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-violet-600/35" />
      <Glow className="w-[400px] h-[300px] left-1/3 top-1/3 bg-fuchsia-500/20" />
      <motion.div {...fadeUp} className="relative max-w-3xl mx-auto">
        <h2 className="text-4xl md:text-6xl font-medium tracking-[-0.04em] leading-[1.05]">Ready for modern quantum learning?</h2>
        <p className={cn('mt-5 text-base md:text-lg', muted)}>Join QuantLMS and go from “what’s a qubit?” to running real algorithms.</p>
        <div className="mt-10 flex justify-center">
          <PrimaryCta to={ctaTo}>{loggedIn ? 'Go to dashboard' : 'Get started free'}</PrimaryCta>
        </div>
      </motion.div>
    </section>
  );
}

function Footer() {
  const cols: [string, [string, string][]][] = [
    ['Product', [['Features', '#features'], ['Compare', '#compare'], ['Pricing', '#pricing']]],
    ['Platform', [['Sign in', '/login'], ['Create account', '/signup'], ['FAQ', '#faq']]],
    ['For', [['Learners', '#audience'], ['Educators', '#audience'], ['Institutions', '#audience']]],
  ];
  const icons = [Layers, Users, Sparkles];
  return (
    <footer className="border-t border-[var(--lp-border)] px-4 pt-14 pb-8">
      <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-5 gap-10">
        <div className="col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <img src="/apple-touch-icon.png" alt="" className="w-7 h-7 rounded-full" />
            <span className="text-lg tracking-tight">QuantLMS</span>
          </div>
          <p className={cn('text-sm max-w-xs', muted)}>The browser-based learning platform for quantum computing.</p>
          <div className={cn('flex gap-3 mt-5', subtle)}>
            {icons.map((Icon, i) => <Icon key={i} className="w-4 h-4" />)}
          </div>
        </div>
        {cols.map(([title, links]) => (
          <div key={title}>
            <div className="text-sm mb-3">{title}</div>
            <ul className={cn('flex flex-col gap-2 text-sm', muted)}>
              {links.map(([label, href]) => (
                <li key={label}>
                  {href.startsWith('#')
                    ? <a href={href} className="hover:text-[var(--lp-fg)]">{label}</a>
                    : <Link to={href} className="hover:text-[var(--lp-fg)]">{label}</Link>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className={cn('max-w-6xl mx-auto mt-12 pt-6 border-t border-[var(--lp-border)] flex flex-col sm:flex-row justify-between gap-2 text-xs', subtle)}>
        <span>&copy; {new Date().getFullYear()} QuantLMS. All rights reserved.</span>
        <span>Built by TEAM CODEHAWK for SIH2026</span>
      </div>
    </footer>
  );
}

export default function QuantLMSLanding() {
  const { theme } = useTheme();
  const { currentUser } = useAuth();
  const loggedIn = !!currentUser;
  const ctaTo = loggedIn ? '/dashboard' : '/signup';

  return (
    <SmoothScroll>
      <main
        style={theme === 'dark' ? DARK_VARS : LIGHT_VARS}
        className="min-h-screen bg-[var(--lp-bg)] text-[var(--lp-fg)] font-sans overflow-x-hidden selection:bg-violet-500 selection:text-white transition-colors duration-300"
      >
        <Nav ctaTo={ctaTo} loggedIn={loggedIn} />
        <Hero ctaTo={ctaTo} loggedIn={loggedIn} />
        <DashboardSection />
        <JourneySection />
        <HubSection />
        <CompareSection />
        <AudienceSection />
        <TryItSection ctaTo={ctaTo} />
        <PricingSection ctaTo={ctaTo} />
        <FaqSection />
        <FinalCta ctaTo={ctaTo} loggedIn={loggedIn} />
        <Footer />
      </main>
    </SmoothScroll>
  );
}
