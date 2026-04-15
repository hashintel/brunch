import type { Story, StoryDefault } from '@ladle/react';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';

import type { ProjectStateTurn, WorkflowState } from '@/shared/api-types.js';

import { PhaseNavigationSidebar } from '../routes/project/$id/-phase-navigation-sidebar.js';

export default {
  title: 'Patterns / Layout / Phase Navigation Sidebar',
} satisfies StoryDefault;

function createWorkflowState(
  overrides?: Partial<Record<keyof WorkflowState['phases'], Partial<WorkflowState['phases']['scope']>>>,
): WorkflowState {
  const defaultPhase = {
    status: 'unstarted' as const,
    closeability: false,
    readiness: 'low' as const,
    closureBasis: null,
    proposalPending: false,
    turnId: null,
    summary: null,
  };

  return {
    phases: {
      scope: { ...defaultPhase, ...overrides?.scope },
      design: { ...defaultPhase, ...overrides?.design },
      requirements: { ...defaultPhase, ...overrides?.requirements },
      criteria: { ...defaultPhase, ...overrides?.criteria },
    },
  };
}

function createTurns(turnCounts: Partial<Record<keyof WorkflowState['phases'], number>>): ProjectStateTurn[] {
  const phases: Array<keyof WorkflowState['phases']> = ['scope', 'design', 'requirements', 'criteria'];
  let nextTurnId = 1;

  return phases.flatMap((phase) => {
    const turnCount = turnCounts[phase] ?? 0;
    return Array.from({ length: turnCount }, (_, index) => ({
      id: nextTurnId++,
      project_id: 7,
      parent_turn_id: index === 0 ? null : nextTurnId - 2,
      phase,
      question: `${phase} question ${index + 1}`,
      why: null,
      impact: null,
      answer: index === turnCount - 1 ? 'Resolved' : null,
      is_resolution: false,
      user_parts: null,
      assistant_parts: null,
      created_at: new Date(2026, 3, index + 1).toISOString(),
    }));
  });
}

function SidebarStoryFrame({
  pathname,
  workflow,
  turns,
}: {
  pathname: string;
  workflow: WorkflowState;
  turns: ProjectStateTurn[];
}) {
  const rootRoute = createRootRoute();
  const catchAll = createRoute({
    getParentRoute: () => rootRoute,
    path: '$',
    component: () => (
      <div className="h-[44rem] overflow-hidden rounded-xl border border-rule bg-white shadow-sm">
        <PhaseNavigationSidebar
          projectId="7"
          projectName="Workspace-first specification flow"
          workflow={workflow}
          turns={turns}
        />
      </div>
    ),
  });

  rootRoute.addChildren([catchAll]);

  const history = createMemoryHistory({ initialEntries: [pathname] });
  const router = createRouter({ routeTree: rootRoute, history });

  return <RouterProvider router={router} />;
}

export const InProgress: Story = () => (
  <SidebarStoryFrame
    pathname="/project/7/elicitation"
    workflow={createWorkflowState({
      scope: { status: 'closed', readiness: 'high', closeability: true },
      design: { status: 'in_progress', readiness: 'medium', closeability: false },
      requirements: { status: 'unstarted' },
      criteria: { status: 'unstarted' },
    })}
    turns={createTurns({ scope: 4, design: 3 })}
  />
);

export const OutputReady: Story = () => (
  <SidebarStoryFrame
    pathname="/project/7/export"
    workflow={createWorkflowState({
      scope: { status: 'closed', readiness: 'high', closeability: true },
      design: { status: 'closed', readiness: 'high', closeability: true },
      requirements: { status: 'closed', readiness: 'high', closeability: true },
      criteria: { status: 'closed', readiness: 'high', closeability: true },
    })}
    turns={createTurns({ scope: 4, design: 5, requirements: 3, criteria: 2 })}
  />
);
