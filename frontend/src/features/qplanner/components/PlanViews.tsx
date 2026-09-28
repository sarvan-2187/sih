import { useMemo } from 'react';
import { Background, Controls, ReactFlow } from '@xyflow/react';
import type { Edge, Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import type { Plan, PlanDay, PlanSprint } from '../types/qplanner.types';

const NODE_WIDTH = 190;
const NODE_GAP_X = 240;
const NODE_GAP_Y = 120;
const COLUMNS = 4;

function nodeStyle(sprint: PlanSprint) {
  // Inline because React Flow renders nodes outside the Tailwind tree. The values
  // are the same CSS custom properties the rest of the app themes with, so this
  // still follows light/dark without a theme conditional.
  const base = {
    width: NODE_WIDTH,
    padding: 10,
    borderRadius: 10,
    fontSize: 12,
    border: '1px solid var(--border)',
    background: 'var(--card)',
    color: 'var(--card-foreground)',
  };
  if (sprint.status === 'completed') {
    return { ...base, borderColor: 'var(--primary)', opacity: 0.7 };
  }
  if (sprint.status === 'active') {
    return { ...base, borderColor: 'var(--primary)', boxShadow: '0 0 0 1px var(--primary)' };
  }
  return base;
}

/** The plan as a chain: one node per sprint, in the order they unlock. */
export function PlanGraph({ plan }: { plan: Plan }) {
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
        style: nodeStyle(sprint),
        connectable: false,
      };
    });

    const builtEdges: Edge[] = plan.sprints.slice(1).map((sprint) => ({
      id: `${sprint.index - 1}-${sprint.index}`,
      source: String(sprint.index - 1),
      target: String(sprint.index),
      animated: sprint.status === 'active',
    }));

    return { nodes: builtNodes, edges: builtEdges };
  }, [plan]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Plan flow</CardTitle>
        <CardDescription>
          Each sprint unlocks the next by passing its quiz. Prerequisites decided this order.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[460px] w-full rounded-lg border">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            fitView
            nodesDraggable={false}
            nodesConnectable={false}
            proOptions={{ hideAttribution: true }}
          >
            <Background />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>
      </CardContent>
    </Card>
  );
}

/** Month-by-month view of the days that actually carry tasks. */
export function PlanCalendar({ plan, completed }: { plan: Plan; completed: Set<string> }) {
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
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Calendar</CardTitle>
        <CardDescription>
          Only your study days appear. {plan.days.length} sessions between {plan.start_date} and{' '}
          {plan.deadline}.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {months.map(([month, days]) => (
          <div key={month}>
            <h3 className="mb-2 text-sm font-medium">
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
                      'rounded-md border p-2 text-xs',
                      day.date === today && 'border-primary',
                      allDone && 'bg-muted text-muted-foreground',
                    )}
                    title={day.tasks.map((task) => task.title).join(', ')}
                  >
                    <p className="font-medium">
                      {new Date(day.date + 'T00:00:00').toLocaleDateString(undefined, {
                        weekday: 'short',
                        day: 'numeric',
                      })}
                    </p>
                    <p className="text-muted-foreground">
                      {done}/{day.tasks.length} tasks
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
