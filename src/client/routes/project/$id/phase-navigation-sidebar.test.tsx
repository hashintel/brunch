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

    const links = nav.querySelectorAll('a');
    expect(links).toHaveLength(4);

    expect(links[0].textContent).toContain('Framing');
    expect(links[1].textContent).toContain('Elicitation');
    expect(links[2].textContent).toContain('Requirements Review');
    expect(links[3].textContent).toContain('Acceptance Review');
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
    const links = nav.querySelectorAll('a');

    expect(links[0].getAttribute('data-phase-status')).toBe('closed');
    expect(links[1].getAttribute('data-phase-status')).toBe('in_progress');
    expect(links[2].getAttribute('data-phase-status')).toBe('unstarted');
    expect(links[3].getAttribute('data-phase-status')).toBe('unstarted');
  });

  it('shows readiness bands for each phase', async () => {
    const workflow = createWorkflowState({
      scope: { status: 'closed', readiness: 'high' },
      design: { status: 'in_progress', readiness: 'medium' },
      requirements: { readiness: 'low' },
    });

    await renderSidebar(workflow);

    const nav = screen.getByRole('navigation', { name: 'Phase navigation' });
    const links = nav.querySelectorAll('a');

    expect(links[0].getAttribute('data-phase-readiness')).toBe('high');
    expect(links[1].getAttribute('data-phase-readiness')).toBe('medium');
    expect(links[2].getAttribute('data-phase-readiness')).toBe('low');
  });

  it('shows closeability for each phase', async () => {
    const workflow = createWorkflowState({
      scope: { status: 'in_progress', closeability: true },
      design: { status: 'unstarted', closeability: false },
    });

    await renderSidebar(workflow);

    const nav = screen.getByRole('navigation', { name: 'Phase navigation' });
    const links = nav.querySelectorAll('a');

    expect(links[0].getAttribute('data-phase-closeable')).toBe('true');
    expect(links[1].getAttribute('data-phase-closeable')).toBe('false');
  });

  it('generates correct navigation hrefs for each phase', async () => {
    await renderSidebar(createWorkflowState());

    const nav = screen.getByRole('navigation', { name: 'Phase navigation' });
    const links = nav.querySelectorAll('a');

    expect(links[0].getAttribute('href')).toBe('/project/42/framing');
    expect(links[1].getAttribute('href')).toBe('/project/42/elicitation');
    expect(links[2].getAttribute('href')).toBe('/project/42/requirements-review');
    expect(links[3].getAttribute('href')).toBe('/project/42/acceptance-review');
  });
});
