// @vitest-environment happy-dom

import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { ProjectStateTurn, WorkflowState } from '@/shared/api-types.js';
import { workflowPhaseLabels } from '@/shared/phase-display.js';

import { PhaseNavigationSidebar } from './-phase-navigation-sidebar.js';

function createWorkflowState(
  overrides?: Partial<Record<string, Partial<WorkflowState['phases']['scope']>>>,
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

function createTurns(
  turnCounts?: Partial<Record<keyof WorkflowState['phases'], number>>,
): ProjectStateTurn[] {
  const phases: Array<keyof WorkflowState['phases']> = ['scope', 'design', 'requirements', 'criteria'];
  let nextTurnId = 1;

  return phases.flatMap((phase) => {
    const turnCount = turnCounts?.[phase] ?? 0;
    return Array.from({ length: turnCount }, (_, index) => ({
      id: nextTurnId++,
      project_id: 42,
      parent_turn_id: index === 0 ? null : nextTurnId - 2,
      phase,
      question: `${phase} question ${index + 1}`,
      why: null,
      impact: null,
      answer: index === turnCount - 1 ? 'Answer' : null,
      is_resolution: false,
      user_parts: null,
      assistant_parts: null,
      created_at: new Date(2026, 3, index + 1).toISOString(),
    }));
  });
}

async function renderSidebar(
  workflow: WorkflowState,
  {
    pathname = '/project/42/grounding',
    projectName = 'Specification Alpha',
    turns = createTurns(),
  }: {
    pathname?: string;
    projectName?: string;
    turns?: ProjectStateTurn[];
  } = {},
) {
  const rootRoute = createRootRoute();
  const catchAll = createRoute({
    getParentRoute: () => rootRoute,
    path: '$',
    component: () => (
      <PhaseNavigationSidebar projectId="42" projectName={projectName} workflow={workflow} turns={turns} />
    ),
  });
  rootRoute.addChildren([catchAll]);
  const history = createMemoryHistory({ initialEntries: [pathname] });
  const router = createRouter({ routeTree: rootRoute, history });

  await act(async () => {
    await router.load();
  });

  return render(<RouterProvider router={router} />);
}

afterEach(() => {
  cleanup();
});

describe('PhaseNavigationSidebar', () => {
  it('renders the sticky header and canonical phase labels', async () => {
    await renderSidebar(createWorkflowState());

    const nav = screen.getByRole('navigation', { name: 'Phase navigation' });
    expect(nav).toBeTruthy();

    expect(screen.getByRole('link', { name: /Back to Workspace/i })).toBeTruthy();
    expect(screen.getByText('Specification Alpha')).toBeTruthy();

    for (const label of Object.values(workflowPhaseLabels)) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it('shows correct status for each phase', async () => {
    const workflow = createWorkflowState({
      scope: { status: 'closed' },
      design: { status: 'in_progress' },
      requirements: { status: 'unstarted' },
      criteria: { status: 'unstarted' },
    });

    await renderSidebar(workflow);

    const nav = screen.getByRole('navigation', { name: 'Phase navigation' });
    const rows = nav.querySelectorAll('[data-phase]');

    expect(rows[0].getAttribute('data-phase-status')).toBe('closed');
    expect(rows[1].getAttribute('data-phase-status')).toBe('in_progress');
    expect(rows[2].getAttribute('data-phase-status')).toBe('unstarted');
    expect(rows[3].getAttribute('data-phase-status')).toBe('unstarted');
  });

  it('shows readiness only for in-progress phases and keeps unstarted phases truthful', async () => {
    const workflow = createWorkflowState({
      scope: { status: 'closed', readiness: 'high' },
      design: { status: 'in_progress', readiness: 'medium' },
      requirements: { readiness: 'low' },
    });

    await renderSidebar(workflow, {
      turns: createTurns({ scope: 2, design: 3, requirements: 0, criteria: 0 }),
    });

    const nav = screen.getByRole('navigation', { name: 'Phase navigation' });
    const rows = nav.querySelectorAll('[data-phase]');

    expect(rows[0].textContent).toContain('Closed');
    expect(rows[0].textContent).toContain('2 turns');
    expect(rows[1].textContent).toContain('Medium readiness');
    expect(rows[1].textContent).toContain('3 turns');
    expect(rows[2].textContent).toContain('Unstarted');
    expect(rows[2].textContent).not.toContain('Low readiness');
  });

  it('shows closeability for each phase', async () => {
    const workflow = createWorkflowState({
      scope: { status: 'in_progress', closeability: true },
      design: { status: 'unstarted', closeability: false },
    });

    await renderSidebar(workflow);

    const nav = screen.getByRole('navigation', { name: 'Phase navigation' });
    const rows = nav.querySelectorAll('[data-phase]');

    expect(rows[0].getAttribute('data-phase-closeable')).toBe('true');
    expect(rows[1].getAttribute('data-phase-closeable')).toBe('false');
  });

  it('gates future unopened phases while keeping the current phase reachable', async () => {
    const workflow = createWorkflowState({
      scope: { status: 'closed', readiness: 'high' },
      design: { status: 'unstarted' },
      requirements: { status: 'unstarted' },
      criteria: { status: 'unstarted' },
    });

    await renderSidebar(workflow, { pathname: '/project/42/elicitation' });

    const nav = screen.getByRole('navigation', { name: 'Phase navigation' });
    const links = nav.querySelectorAll('a');

    expect(links[0].getAttribute('href')).toBe('/project/42/grounding');
    expect(links[1].getAttribute('href')).toBe('/project/42/elicitation');
    expect(nav.querySelector('[data-phase="requirements"]')?.getAttribute('aria-disabled')).toBe('true');
    expect(nav.querySelector('[data-phase="criteria"]')?.getAttribute('aria-disabled')).toBe('true');
  });

  it('shows the Output item only when all workflow phases are closed', async () => {
    await renderSidebar(
      createWorkflowState({
        scope: { status: 'closed' },
        design: { status: 'closed' },
        requirements: { status: 'closed' },
        criteria: { status: 'in_progress' },
      }),
    );

    expect(screen.queryByText('Output')).toBeNull();

    cleanup();

    await renderSidebar(
      createWorkflowState({
        scope: { status: 'closed' },
        design: { status: 'closed' },
        requirements: { status: 'closed' },
        criteria: { status: 'closed' },
      }),
      { pathname: '/project/42/export' },
    );

    expect(screen.getByText('Output')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Output/i }).getAttribute('href')).toBe('/project/42/export');
  });
});
