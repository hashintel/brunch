// @vitest-environment happy-dom

import { createMemoryHistory } from '@tanstack/history';
import { createRouter, RouterProvider } from '@tanstack/react-router';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const routeHarness = vi.hoisted(() => ({
  fetchProjectLayoutLoaderData: vi.fn(async (id: string) => ({ id, kind: 'project' })),
  fetchViewLayoutLoaderData: vi.fn(async (id: string) => ({ id, kind: 'entities' })),
  fetchKnowledgeWorkspaceLoaderData: vi.fn(async (id: string) => ({ id, kind: 'knowledge' })),
}));
const fetchMock = vi.fn<typeof fetch>();

vi.mock('./components/route-skeletons.js', () => ({
  InterviewWorkspaceSkeleton: () => <div>Interview loading</div>,
  KnowledgeWorkspaceSkeleton: () => <div>Knowledge loading</div>,
}));

vi.mock('./components/phase-navigation-sidebar.js', () => ({
  PhaseNavigationSidebar: () => <nav data-testid="phase-sidebar">Phase sidebar</nav>,
}));

vi.mock('./screens/ProjectListScreen.js', () => ({
  ProjectListScreen: () => <h1>Projects screen</h1>,
}));

vi.mock('./workspace/workspace-controller', () => ({
  useWorkspaceController: () => ({ __brand: 'workspace-controller' }),
}));

vi.mock('./screens/InterviewWorkspaceScreen.js', () => ({
  InterviewWorkspaceScreen: () => <h1>Interview screen</h1>,
}));

vi.mock('./screens/KnowledgeWorkspaceScreen.js', () => ({
  KnowledgeWorkspaceScreen: () => <h1>Knowledge screen</h1>,
}));

vi.mock('./workspace/workspace-loader.js', () => ({
  fetchProjectLayoutLoaderData: routeHarness.fetchProjectLayoutLoaderData,
  fetchViewLayoutLoaderData: routeHarness.fetchViewLayoutLoaderData,
  fetchKnowledgeWorkspaceLoaderData: routeHarness.fetchKnowledgeWorkspaceLoaderData,
}));

vi.mock('./screens/ExportPreviewScreen.js', () => ({
  ExportPreviewScreen: () => <h1>Export screen</h1>,
}));

import { routeTree } from './routeTree.gen.js';

function createDeferredPromise<T>() {
  let resolve!: (value: T) => void;

  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

async function renderRouteAt(pathname: string) {
  const history = createMemoryHistory({ initialEntries: [pathname] });
  const router = createRouter({ routeTree, history });

  await act(async () => {
    await router.load();
  });

  return {
    router,
    ...render(<RouterProvider router={router} />),
  };
}

beforeEach(() => {
  fetchMock.mockReset();
  routeHarness.fetchProjectLayoutLoaderData.mockClear();
  routeHarness.fetchViewLayoutLoaderData.mockClear();
  routeHarness.fetchKnowledgeWorkspaceLoaderData.mockClear();
  fetchMock.mockImplementation(async (input) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    if (url.endsWith('/export')) {
      return new Response(JSON.stringify({ ready: false }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (url.endsWith('/api/config')) {
      return new Response(JSON.stringify({ cwd: '/test/cwd' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('generated routeTree', () => {
  it('maps the dashboard URL to the project list screen', async () => {
    await renderRouteAt('/');

    expect(await screen.findByRole('heading', { name: 'Projects screen' })).toBeTruthy();
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/projects');
    });
  });

  it('maps the framing phase URL to the interview workspace screen with sidebar', async () => {
    await renderRouteAt('/project/42/framing');

    expect(await screen.findByRole('heading', { name: 'Interview screen' })).toBeTruthy();
    expect(screen.getByTestId('phase-sidebar')).toBeTruthy();
    expect(routeHarness.fetchProjectLayoutLoaderData).toHaveBeenCalledWith('42');
    expect(routeHarness.fetchViewLayoutLoaderData).toHaveBeenCalledWith('42');
  });

  it('maps the elicitation phase URL to the interview workspace screen', async () => {
    await renderRouteAt('/project/42/elicitation');

    expect(await screen.findByRole('heading', { name: 'Interview screen' })).toBeTruthy();
    expect(routeHarness.fetchProjectLayoutLoaderData).toHaveBeenCalledWith('42');
    expect(routeHarness.fetchViewLayoutLoaderData).toHaveBeenCalledWith('42');
  });

  it('maps the requirements-review phase URL to the interview workspace screen', async () => {
    await renderRouteAt('/project/42/requirements-review');

    expect(await screen.findByRole('heading', { name: 'Interview screen' })).toBeTruthy();
    expect(routeHarness.fetchProjectLayoutLoaderData).toHaveBeenCalledWith('42');
    expect(routeHarness.fetchViewLayoutLoaderData).toHaveBeenCalledWith('42');
  });

  it('maps the acceptance-review phase URL to the interview workspace screen', async () => {
    await renderRouteAt('/project/42/acceptance-review');

    expect(await screen.findByRole('heading', { name: 'Interview screen' })).toBeTruthy();
    expect(routeHarness.fetchProjectLayoutLoaderData).toHaveBeenCalledWith('42');
    expect(routeHarness.fetchViewLayoutLoaderData).toHaveBeenCalledWith('42');
  });

  it('keeps the interview workspace pending skeleton active while the route loader is unresolved', async () => {
    const deferredLoader = createDeferredPromise<{ id: string; kind: string }>();
    routeHarness.fetchProjectLayoutLoaderData.mockImplementationOnce(() => deferredLoader.promise);

    const history = createMemoryHistory({ initialEntries: ['/project/42/framing'] });
    const router = createRouter({ routeTree, history, defaultPendingMs: 0 });

    render(<RouterProvider router={router} />);
    void router.load();

    expect(await screen.findByText('Interview loading')).toBeTruthy();
    expect(routeHarness.fetchProjectLayoutLoaderData).toHaveBeenCalledWith('42');

    await act(async () => {
      deferredLoader.resolve({ id: '42', kind: 'project' });
    });

    expect(await screen.findByRole('heading', { name: 'Interview screen' })).toBeTruthy();
  });

  it('maps the knowledge URL to the knowledge route loader and screen', async () => {
    await renderRouteAt('/project/42/knowledge');

    expect(await screen.findByRole('heading', { name: 'Knowledge screen' })).toBeTruthy();
    expect(routeHarness.fetchKnowledgeWorkspaceLoaderData).toHaveBeenCalledWith('42');
  });

  it('keeps the knowledge workspace pending skeleton active while the route loader is unresolved', async () => {
    const deferredLoader = createDeferredPromise<{ id: string; kind: string }>();
    routeHarness.fetchKnowledgeWorkspaceLoaderData.mockImplementationOnce(() => deferredLoader.promise);

    const history = createMemoryHistory({ initialEntries: ['/project/42/knowledge'] });
    const router = createRouter({ routeTree, history, defaultPendingMs: 0 });

    render(<RouterProvider router={router} />);
    void router.load();

    expect(await screen.findByText('Knowledge loading')).toBeTruthy();
    expect(routeHarness.fetchKnowledgeWorkspaceLoaderData).toHaveBeenCalledWith('42');

    await act(async () => {
      deferredLoader.resolve({ id: '42', kind: 'knowledge' });
    });

    expect(await screen.findByRole('heading', { name: 'Knowledge screen' })).toBeTruthy();
  });

  it('maps the export URL to the export route loader and screen', async () => {
    await renderRouteAt('/project/42/export');

    expect(await screen.findByRole('heading', { name: 'Export screen' })).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith('/api/projects/42/export');
  });

  it('redirects project index to the framing phase by default', async () => {
    // Mock the project state API for the redirect loader
    fetchMock.mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

      if (url.match(/\/api\/projects\/\d+$/)) {
        return new Response(
          JSON.stringify({
            project: { id: 42, name: 'Test', mode: 'greenfield', cwd: null, created_at: '' },
            workflow: {
              phases: {
                scope: {
                  status: 'unstarted',
                  closeability: false,
                  readiness: 'none',
                  closureBasis: null,
                  proposalPending: false,
                  turnId: null,
                  summary: null,
                },
                design: {
                  status: 'unstarted',
                  closeability: false,
                  readiness: 'none',
                  closureBasis: null,
                  proposalPending: false,
                  turnId: null,
                  summary: null,
                },
                requirements: {
                  status: 'unstarted',
                  closeability: false,
                  readiness: 'none',
                  closureBasis: null,
                  proposalPending: false,
                  turnId: null,
                  summary: null,
                },
                criteria: {
                  status: 'unstarted',
                  closeability: false,
                  readiness: 'none',
                  closureBasis: null,
                  proposalPending: false,
                  turnId: null,
                  summary: null,
                },
              },
            },
            turns: [],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (url.endsWith('/api/config')) {
        return new Response(JSON.stringify({ cwd: '/test/cwd' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.endsWith('/entities')) {
        return new Response(
          JSON.stringify({
            goals: [],
            terms: [],
            contexts: [],
            constraints: [],
            requirements: [],
            criteria: [],
            decisions: [],
            assumptions: [],
            relationships: [],
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }

      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const { router } = await renderRouteAt('/project/42');

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/project/42/framing');
    });
  });
});
