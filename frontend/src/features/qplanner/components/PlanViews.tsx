import { useMemo } from 'react';
import { Background, Controls, ReactFlow } from '@xyflow/react';
import type { Edge, Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { cn } from '@/lib/utils';
import { useTheme } from '@/context/ThemeContext';
import { ExplorerPanel, tone } from '@/components/explorer';

import type { Plan, PlanDay, PlanSprint } from '../types/qplanner.types';

const NODE_WIDTH = 200;
const NODE_GAP_X = 250;
const NODE_GAP_Y = 120;
const COLUMNS = 4;

// React Flow renders nodes outside the Tailwind class tree, so these are literal values.
// They mirror the explorer tokens: zinc surfaces, emerald accent in both themes.
const EMERALD = '#10b981'; // emerald-500
const FLOW_THEME = {
  dark: { background: '#09090b', border: 'rgba(255,255,255,0.1)', color: '#ffffff' },
  light: { background: '#ffffff', border: '#e4e4e7', color: '#18181b' },
};

function nodeStyle(sprint: PlanSprint, theme: string) {
  const palette = theme === 'dark' ? FLOW_THEME.dark : FLOW_THEME.light;
  const base = {
    width: NODE_WIDTH,
    padding: 12,
    borderRadius: 16,
    fontSize: 12,
    lineHeight: 1.4,
    whiteSpace: 'pre-line' as const,
    border: `1px solid ${palette.border}`,
    background: palette.background,
    color: palette.color,
  };
  if (sprint.status === 'completed') {
    return { ...base, borderColor: EMERALD, opacity: 0.65 };
  }
  if (sprint.status === 'active') {
    return { ...base, borderColor: EMERALD, boxShadow: `0 0 0 1px ${EMERALD}` };
  }
  return base;
}

/** The plan as a chain: one node per sprint, in the order they unlock. */
export function PlanGraph({ plan }: { plan: Plan }) {
  const { theme } = useTheme();

  const { nodes, edges } = useMemo(() => {
    const builtNodes: Node[] = plan.sprints.map((sprint, position) => {
      const row = Math.floor(position / COLUMNS);
      // serpentine rows, so reading order still follows unlock order
      const column = row % 2 === 0 ? position % COLUMNS : COLUMNS - 1 - (position % COLUMNS);
      return {
        id: String(sprint.index),
        position: { x: column * NODE_GAP_X, y: row * NODE_GAP_Y },
        data: {
          label: `Week ${sprint.index + 1} · ${sprint.title}\n${sprint.topic_slugs.length} topics · ${sprint.planned_minutes} min`,
        },
        style: nodeStyle(sprint, theme),
        connectable: false,
      };
    });

    const builtEdges: Edge[] = plan.sprints.slice(1).map((sprint) => ({
      id: `${sprint.index - 1}-${sprint.index}`,
      source: String(sprint.index - 1),
      target: String(sprint.index),
      animated: sprint.status === 'active',
      style: { stroke: EMERALD, strokeOpacity: sprint.status === 'locked' ? 0.35 : 0.9 },
    }));

    return { nodes: builtNodes, edges: builtEdges };
  }, [plan, theme]);

  return (
    <ExplorerPanel className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-medium tracking-tight">Plan flow</h2>
        <p className={cn('text-sm', tone.secondary(theme))}>
          Each sprint unlocks the next by passing its quiz. Prerequisites decided this order.
        </p>
      </div>
      <div
        className={cn(
          'h-[460px] w-full overflow-hidden rounded-2xl border',
          theme === 'dark' ? 'border-white/10' : 'border-zinc-200',
        )}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          colorMode={theme === 'dark' ? 'dark' : 'light'}
          fitView
          nodesDraggable={false}
          nodesConnectable={false}
          proOptions={{ hideAttribution: true }}
        >
          <Background />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </ExplorerPanel>
  );
}

/** Month-by-month view of the days that actually carry tasks. */
export function PlanCalendar({ plan, completed }: { plan: Plan; completed: Set<string> }) {
  const { theme } = useTheme();
  const today = new Date().toISOString().slice(0, 10);

  const months = useMemo(() => {
    const grouped = new Map<string, PlanDay[]>();
    for (const day of plan.days) {
      const key = day.date.slice(0, 7);
      const bucket = grouped.get(key);
      if (bucket) bucket.push(day);
      else grouped.set(key, [day]);
    }
    return [...grouped.entries()];
  }, [plan.days]);

  return (
    <ExplorerPanel className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-medium tracking-tight">Calendar</h2>
        <p className={cn('text-sm', tone.secondary(theme))}>
          Only your study days appear. {plan.days.length} sessions between {plan.start_date} and{' '}
          {plan.deadline}.
        </p>
      </div>

      {months.map(([month, days]) => (
        <div key={month} className="flex flex-col gap-3">
          <h3 className={cn('font-mono text-xs uppercase tracking-wider', tone.muted(theme))}>
            {new Date(month + '-01T00:00:00').toLocaleDateString(undefined, {
              month: 'long',
              year: 'numeric',
            })}
          </h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {days.map((day) => {
              const done = day.tasks.filter((task) => completed.has(task.task_id)).length;
              const allDone = done === day.tasks.length;
              return (
                <div
                  key={day.date}
                  className={cn(
                    'rounded-xl border p-3 text-xs transition-colors',
                    tone.panel(theme),
                    day.date === today && 'border-emerald-500 ring-1 ring-emerald-500',
                    allDone && 'border-emerald-500/40 bg-emerald-500/10',
                  )}
                  title={day.tasks.map((task) => task.title).join(', ')}
                >
                  <p className="font-medium">
                    {new Date(day.date + 'T00:00:00').toLocaleDateString(undefined, {
                      weekday: 'short',
                      day: 'numeric',
                    })}
                  </p>
                  <p className={cn('font-mono', allDone ? 'text-emerald-500' : tone.secondary(theme))}>
                    {done}/{day.tasks.length} tasks
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </ExplorerPanel>
  );
}
