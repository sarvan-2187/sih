# Qrious Design System

This is the canonical reference for how Qrious frontend surfaces should look and behave.
The **Algorithm Explorer** module (`frontend/src/modules/algorithm-explorer/`) is the
reference implementation of this system — when in doubt, open
[AlgorithmExplorerLandingPage.tsx](frontend/src/modules/algorithm-explorer/pages/AlgorithmExplorerLandingPage.tsx)
and [AlgorithmCard.tsx](frontend/src/modules/algorithm-explorer/components/AlgorithmCard.tsx)
and match them exactly rather than inventing a new pattern.

There are **two distinct design languages** in this codebase. Use the one that matches the
surface you're building — do not mix them.

| | Explorer / learner-facing pages | Admin / editor surfaces |
|---|---|---|
| Examples | Algorithm Explorer, Video Overview, Gates Playground, dashboard | Course Editor, faculty tooling, dialogs/modals |
| Color system | Hand-rolled `zinc` / `emerald`, switched via `useTheme()` | Shadcn semantic tokens (`primary`, `card`, `border`, `muted-foreground`) |
| Motion | Heavy — `framer-motion` on every page | Light — rely on `tailwindcss-animate` (`animate-in fade-in`) |
| Components | Raw `div`s styled with `cn(...)`, not shadcn `Card` | Shadcn `Card`, `Dialog`, `Select`, etc. |

Do not port zinc/emerald hardcoded colors into an admin/editor screen that's already built on
semantic tokens (it clashes with the purple `primary` accent used everywhere else there), and
do not introduce shadcn `Card` wrappers into an explorer-style page.

---

## 1. Explorer-style pages (the primary system)

### 1.0 Use the shared primitives

`frontend/src/components/explorer/` implements everything in this section as components.
**Use them instead of copy-pasting the patterns below** — the copies had already drifted apart
across a dozen pages, which is what these exist to stop:

| Primitive | Replaces | Section |
|---|---|---|
| `PageShell` | the outer page shell div | §1.1 |
| `PageHero` | hero title + subtitle + action + eyebrow | §1.2 |
| `tone.*` | hand-rolled `theme === 'dark' ? ... : ...` colour branches | §1.3 |
| `ExplorerCard` | the grid-able card pattern | §1.4 |
| `ExplorerPanel` | a non-navigable bordered panel (stat block, aside) | §1.4 |
| `IconBadge` | the small square icon badge | §1.5 |
| `CardSkeletonGrid`, `EmptyState`, `ErrorBanner` | loading / empty / error states | §1.7 |
| `AccentButton` | emerald primary + outline buttons | §1.8 |

```tsx
import { PageShell, PageHero, AccentButton } from '@/components/explorer';

<PageShell>                        {/* width: 'wide' | 'narrow' | 'reading' */}
  <PageHero title="qStudio" subtitle="…" action={<AccentButton>New</AccentButton>} />
  {/* content */}
</PageShell>
```

The raw patterns in §1.1–§1.8 remain the specification these components implement — read them to
understand the intent, and when you need something the components do not cover.

### 1.0.1 Surfaces that are exempt

The page shell assumes a **document** — something you read and scroll. Immersive tool surfaces do
NOT use it, and forcing a padded max-width container around them makes them worse:

- Canvas/workbench tools: Gates Playground, Algorithm Constellation, QForge Builder, QRoute,
  Quantum Puzzles, qBook editor, qStudio study space
- Players and viewers: Course Viewer, Video Player, Document Viewer, Live Session Room, Focus Mode

These still follow §1.3 (colour tokens) and §3 (font, `data-theme`) — they just own their own
layout. Pre-login pages (Login, Signup, onboarding, NotFound) and the marketing Landing page are
likewise outside this system.

### 1.1 Page shell

`PageShell` implements this. Every top-level explorer page uses this exact shell:

```tsx
const { theme } = useTheme();

<div className={cn(
  "w-full h-full transition-colors duration-300 py-12 px-6 md:px-12",
  theme === 'dark' ? "text-white" : "text-zinc-900"
)}>
  <div className="max-w-[1600px] mx-auto flex flex-col gap-12">
    {/* hero + content */}
  </div>
</div>
```

- Narrower content (e.g. a single reading column or a chat) may reduce `max-w-[1600px]` to
  `max-w-4xl`, but the outer padding/color classes stay identical.
- Never wrap this shell's content in an additional bordered/rounded "panel" or `Card` — the
  page background *is* the surface. Individual pieces of content (cards, message text, media)
  sit directly on it, exactly like the algorithm grid sits directly on the page in the
  landing page. Do not add a container just to "frame" a feature.

### 1.2 Hero header

```tsx
<div className="flex flex-col gap-4 max-w-3xl">
  <motion.h1
    className="text-4xl md:text-5xl font-sans tracking-tight"
    initial={{ opacity: 0, y: -20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.6 }}
  >
    Page Title
  </motion.h1>
  <motion.p
    className={cn("text-lg", theme === 'dark' ? "text-zinc-400" : "text-zinc-600")}
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 0.6, delay: 0.1 }}
  >
    One-sentence description of what this page lets you do.
  </motion.p>
</div>
```

### 1.3 Color tokens (hand-rolled, theme-branched)

Always branch manually with `useTheme()` + `cn(...)` — do **not** rely on Tailwind's `dark:`
variant here, since theme is an app-level toggle (`data-theme` attribute), not the OS
preference.

| Purpose | Dark | Light |
|---|---|---|
| Page text | `text-white` | `text-zinc-900` |
| Secondary text | `text-zinc-400` | `text-zinc-600` |
| Tertiary/muted text | `text-zinc-500` | `text-zinc-400` |
| Card/panel background | `bg-zinc-950/50` | `bg-white` |
| Card/panel border | `border-white/10` | `border-zinc-200` |
| Card hover border | `hover:border-emerald-500/50` | `hover:border-emerald-500/30` |
| Icon badge background | `bg-black` | `bg-zinc-50` |
| Icon badge border | `border-white/10` | `border-zinc-200` |
| Icon badge icon color | `text-zinc-400` | `text-zinc-700` |
| Accent (CTA, links, active states) | `emerald-500` / `emerald-600` on hover | same — accent color does not change between themes |
| Error text/banner | `text-red-500` on `bg-red-100/10 border-red-500/20` | same |

`emerald` is the one fixed accent color across both themes — it is what makes an element
feel "primary" on explorer pages (equivalent to what `primary` does on admin pages).

### 1.4 Cards

Use this pattern for any discrete, clickable, grid-able unit of content (e.g. `AlgorithmCard`):

```tsx
<motion.div
  className={cn(
    "p-8 rounded-[2rem] border overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 group flex flex-col h-full relative",
    theme === 'dark'
      ? "bg-zinc-950/50 border-white/10 hover:border-emerald-500/50 hover:bg-white/5"
      : "bg-white border-zinc-200 hover:border-emerald-500/30"
  )}
  initial={{ opacity: 0, y: 20 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true, margin: "-50px" }}
  transition={{ duration: 0.5 }}
>
  {/* icon badge, title, description, CTA */}
</motion.div>
```

**Cards are for grid-able, navigable units** (an algorithm, a course, a resource) — they are
not a generic "put a border around this section" tool. Conversational UIs, article/reading
content, and forms should NOT be wrapped in this pattern; lay them directly on the page shell
per §1.1.

### 1.5 Icon badges

Small square badge used next to headings, in cards, and in empty states:

```tsx
<div className={cn(
  "w-12 h-12 rounded-2xl border flex items-center justify-center shadow-sm transition-transform duration-300 group-hover:scale-105 group-hover:text-emerald-500",
  theme === 'dark' ? "bg-black border-white/10 text-zinc-400" : "bg-zinc-50 border-zinc-200 text-zinc-700"
)}>
  <Icon className="w-6 h-6" />
</div>
```

Icon badges are not cards — they're fine to use anywhere a small visual anchor is needed
(page headers, empty states, list items) without it counting as "putting a card around
something."

### 1.6 Motion conventions

- Hero title: `initial={{ opacity: 0, y: -20 }}`, `animate={{ opacity: 1, y: 0 }}`, `duration: 0.6`.
- Hero subtitle: same but opacity-only, `delay: 0.1`.
- Cards/list items entering on scroll: `whileInView` with `viewport={{ once: true, margin: "-50px" }}`, `duration: 0.5`.
- Cards/items entering on data change (not scroll): `initial={{ opacity: 0, y: 20 }}`, `animate`, `duration: 0.3–0.5`.
- Prefer `AnimatePresence` for state machines (idle/loading/success/error) so transitions
  animate both in and out.

### 1.7 Loading & empty states

- Skeleton loading (data not yet fetched): pulse blocks using the same zinc tokens as real
  content, sized to roughly match what will render — no borders/cards for skeletons, just
  `animate-pulse` blocks of `bg-white/10` (dark) / `bg-zinc-200` (light).
- Empty state: centered icon badge (§1.5, sized up to `w-16 h-16`) + one line of primary text
  + one line of muted example/hint text, wrapped in a `motion.div` fade-in.
- Error state: `p-4 bg-red-100/10 border border-red-500/20 text-red-500 rounded-lg`.

### 1.8 Buttons / CTAs

Primary action buttons on explorer pages use the emerald accent directly (not the `primary`
CSS token, which is the purple used on admin pages):

```tsx
<button className="px-6 py-2 bg-emerald-500 text-white rounded-lg shadow hover:bg-emerald-600 font-medium transition-colors disabled:opacity-50">
  Action
</button>
```

Inline text links/affordances use `text-emerald-500` with an icon that translates on hover
(see `AlgorithmCard`'s "Explore Algorithm →").

---

## 2. Admin / editor surfaces

Built entirely on shadcn primitives (`Card`, `Button`, `Select`, `Dialog`, etc.) and the
semantic CSS tokens defined in `frontend/src/index.css` (`--primary`, `--card`, `--border`,
`--muted-foreground`, …). Do not introduce `useTheme()`/zinc/emerald here — these tokens
already flip automatically between light/dark via the `.dark`/`[data-theme="dark"]`
selectors, and the accent color is purple (`--primary`), not emerald.

When adding polish (motion, rounded corners, icon badges) to this system, keep using the
semantic tokens: `bg-primary/10 border-primary/20 text-primary` for an icon badge, `bg-muted`
for skeleton/progress tracks, `bg-primary` for progress fill, etc. — see
[VideoOverviewGenerator.tsx](frontend/src/components/VideoOverviewGenerator.tsx) for the
reference implementation of "modern but on-token."

---

## 3. Global rules (apply everywhere)

- Font: **Geist Sans** (`font-sans`) everywhere, including dashboards and courses. Never use
  Instrument Serif (`font-serif`) despite it being loaded/available.
- `verbatimModuleSyntax` is on — always `import type { ... }` for type-only imports.
- Respect `data-theme` for light/dark; don't hardcode assumptions about OS `prefers-color-scheme`.
- When a feature doesn't fit either bucket above (rare), default to the explorer-style system
  if it's learner-facing, and the admin system if it's operator/faculty-facing.
- DO NOT USE `font-bold` or `font-semibold` with Geist Sans Font(`font-sans`).