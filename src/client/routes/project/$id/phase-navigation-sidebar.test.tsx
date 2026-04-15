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

import type { WorkflowState } from '@/shared/api-types.js';

import { PhaseNavigationSidebar } from './route.js';

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

async function renderSidebar(workflow: WorkflowState, pathname = '/project/42/framing') {
  const rootRoute = createRootRoute();
  const catchAll = createRoute({
    getParentRoute: () => rootRoute,
    path: '$',
    component: () => <PhaseNavigationSidebar projectId="42" workflow={workflow} />,
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
  it('renders all four phases with correct labels', async () => {
    await renderSidebar(createWorkflowState());

    const nav = screen.getByRole('navigation', { name: 'Phase navigation' });
    expect(nav).toBeTruthy();

    expect(screen.getByText('Grounding')).toBeTruthy();
    expect(screen.getByText('Elicitation')).toBeTruthy();
    expect(screen.getByText('Requirements')).toBeTruthy();
    expect(screen.getByText('Acceptance Criteria')).toBeTruthy();
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

    await renderSidebar(workflow);

    const nav = screen.getByRole('navigation', { name: 'Phase navigation' });
    const rows = nav.querySelectorAll('[data-phase]');

    expect(rows[0].textContent).toContain('Done');
    expect(rows[1].textContent).toContain('medium');
    expect(rows[2].textContent).toContain('Unstarted');
    expect(rows[2].textContent).not.toContain('low');
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

    await renderSidebar(workflow, '/project/42/elicitation');

    const nav = screen.getByRole('navigation', { name: 'Phase navigation' });
    const links = nav.querySelectorAll('a');

    expect(links[0].getAttribute('href')).toBe('/project/42/framing');
    expect(links[1].getAttribute('href')).toBe('/project/42/elicitation');
    expect(nav.querySelector('[data-phase="requirements"]')?.getAttribute('aria-disabled')).toBe('true');
    expect(nav.querySelector('[data-phase="criteria"]')?.getAttribute('aria-disabled')).toBe('true');
  });
});
