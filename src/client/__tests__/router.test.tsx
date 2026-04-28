// @vitest-environment happy-dom

import { createMemoryHistory } from '@tanstack/history';
import { QueryClientProvider } from '@tanstack/react-query';
import { createRouter, RouterProvider } from '@tanstack/react-router';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { EntitiesData } from '@/shared/api-types.js';
import type { SpecificationState } from '@/shared/specification.js';

import { queryClient } from '../query-client.js';

const fetchMock = vi.fn<typeof fetch>();
let interviewViewRenderCount = 0;
let interviewViewMountCount = 0;
let interviewViewUnmountCount = 0;

const minimalSpecificationState: SpecificationState = {
  specification: {
    id: 42,
    name: 'Test',
    mode: 'greenfield',
    active_turn_id: null,
    created_at: '',
    updated_at: '',
  },
  workflow: {
    phases: {
      grounding: {
        status: 'unstarted',
        closeability: false,
        readiness: 'low',
        closureBasis: null,
        proposalPending: false,
        turnId: null,
        summary: null,
      },
      design: {
        status: 'unstarted',
        closeability: false,
        readiness: 'low',
        closureBasis: null,
        proposalPending: false,
        turnId: null,
        summary: null,
      },
      requirements: {
        status: 'unstarted',
        closeability: false,
        readiness: 'low',
        closureBasis: null,
        proposalPending: false,
        turnId: null,
        summary: null,
      },
      criteria: {
        status: 'unstarted',
        closeability: false,
        readiness: 'low',
        closureBasis: null,
        proposalPending: false,
        turnId: null,
        summary: null,
      },
    },
  },
  turns: [],
};

const minimalEntitiesData: EntitiesData = {
  goals: [],
  terms: [],
  contexts: [],
  constraints: [],
  requirements: [],
  criteria: [],
  decisions: [],
  assumptions: [],
  relationships: [],
};

vi.mock('../routes/-project-list.js', () => ({
  SpecificationList: () => <h1>Specifications screen</h1>,
  fetchSpecificationListLoaderData: vi.fn(async () => []),
}));

vi.mock('../routes/specification/$id/_view/-interview-controller', () => ({
  useInterviewController: () => ({ __brand: 'interview-controller' }),
}));

vi.mock('../routes/specification/$id/_view/-interview-view.js', () => ({
  InterviewView: () => {
    interviewViewRenderCount += 1;

    useEffect(() => {
      interviewViewMountCount += 1;
      return () => {
        interviewViewUnmountCount += 1;
      };
    }, []);

    return <h1>Interview screen</h1>;
  },
}));

vi.mock('../routes/specification/$id/-export-preview.js', () => ({
  ExportPreview: () => <h1>Export screen</h1>,
}));

import { routeTree } from '../routeTree.gen.js';

function jsonResponse(data: unknown) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function createDeferredPromise<T>() {
  let resolve!: (value: T) => void;

  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

function defaultFetchHandler(input: RequestInfo | URL): Response {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

  if (url.match(/\/api\/specifications\/\d+\/entities/)) {
    return jsonResponse(minimalEntitiesData);
  }
  if (url.match(/\/api\/specifications\/\d+\/export/)) {
    return jsonResponse({ ready: false });
  }
  if (url.match(/\/api\/specifications\/\d+$/)) {
    return jsonResponse(minimalSpecificationState);
  }
  if (url.endsWith('/api/config')) {
    return jsonResponse({ cwd: '/test/cwd' });
  }
  if (url.endsWith('/api/specifications')) {
    return jsonResponse([]);
  }

  return jsonResponse([]);
}

async function renderRouteAt(pathname: string) {
  const history = createMemoryHistory({ initialEntries: [pathname] });
  const router = createRouter({ routeTree, history });

  await act(async () => {
    await router.load();
  });

  return {
    router,
    ...render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    ),
  };
}

beforeEach(() => {
  queryClient.clear();
  fetchMock.mockReset();
  interviewViewRenderCount = 0;
  interviewViewMountCount = 0;
  interviewViewUnmountCount = 0;
  fetchMock.mockImplementation(async (input) => defaultFetchHandler(input));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('generated routeTree', () => {
  it('maps the dashboard URL to the specification list screen', async () => {
    await renderRouteAt('/');

    expect(await screen.findByRole('heading', { name: 'Specifications screen' })).toBeTruthy();
  });

  it('maps the grounding phase URL to the interview workspace screen with sidebar', async () => {
    await renderRouteAt('/specification/42/grounding');

    expect(await screen.findByRole('heading', { name: 'Interview screen' })).toBeTruthy();
    expect(screen.getByTestId('phase-sidebar')).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith('/api/specifications/42');
    expect(fetchMock).toHaveBeenCalledWith('/api/specifications/42/entities?mode=active-path');
  });

  it('maps the elicitation phase URL to the interview workspace screen', async () => {
    await renderRouteAt('/specification/42/elicitation');

    expect(await screen.findByRole('heading', { name: 'Interview screen' })).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith('/api/specifications/42');
    expect(fetchMock).toHaveBeenCalledWith('/api/specifications/42/entities?mode=active-path');
  });

  it('maps the requirements-review phase URL to the interview workspace screen', async () => {
    await renderRouteAt('/specification/42/requirements-review');

    expect(await screen.findByRole('heading', { name: 'Interview screen' })).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith('/api/specifications/42');
  });

  it('maps the acceptance-review phase URL to the interview workspace screen', async () => {
    await renderRouteAt('/specification/42/acceptance-review');

    expect(await screen.findByRole('heading', { name: 'Interview screen' })).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith('/api/specifications/42');
  });

  it('keeps the project layout pending skeleton active while the route loader is unresolved', async () => {
    const deferredFetch = createDeferredPromise<Response>();
    fetchMock.mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.match(/\/api\/specifications\/\d+$/)) {
        return deferredFetch.promise;
      }
      return defaultFetchHandler(input);
    });

    const history = createMemoryHistory({ initialEntries: ['/specification/42/grounding'] });
    const router = createRouter({ routeTree, history, defaultPendingMs: 0 });

    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );
    void router.load();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/specifications/42');
    });

    // The interview screen should not be rendered while loading
    expect(screen.queryByRole('heading', { name: 'Interview screen' })).toBeNull();

    await act(async () => {
      deferredFetch.resolve(jsonResponse(minimalSpecificationState));
    });

    expect(await screen.findByRole('heading', { name: 'Interview screen' })).toBeTruthy();
  });

  it('maps the export URL to the export route loader and screen', async () => {
    await renderRouteAt('/specification/42/export');

    expect(await screen.findByRole('heading', { name: 'Export screen' })).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith('/api/specifications/42/export');
  });

  it('maps the graph URL to the structured-list view as a peer route, with no active phase highlight on the sidebar', async () => {
    const { container } = await renderRouteAt('/specification/42/graph');

    // Structured list mounts under the spec layout shell
    expect(container.querySelector('[data-graph-structured-list]')).toBeTruthy();
    // Phase sidebar still renders (continuity per D114)
    expect(screen.getByTestId('phase-sidebar')).toBeTruthy();
    // No phase Link carries the is-active class on /graph
    const sidebar = screen.getByTestId('phase-sidebar');
    expect(sidebar.querySelectorAll('.is-active')).toHaveLength(0);
    // Loader fetches whole-spec entities (D129), not active-path
    expect(fetchMock).toHaveBeenCalledWith('/api/specifications/42/entities?mode=project-wide');
    expect(fetchMock).toHaveBeenCalledWith('/api/specifications/42');

    // Header strip surfaces a "Knowledge graph" title and a Back-to-chat
    // link targeting the current reachable phase (default workflow has all
    // phases unstarted, so current reachable = grounding)
    expect(screen.getByText('Knowledge graph')).toBeTruthy();
    const backLink = screen.getByRole('link', { name: /back to chat/i });
    expect(backLink).toBeTruthy();
    expect(backLink.getAttribute('href')).toContain('/specification/42/grounding');
  });

  it('redirects project index to the grounding phase by default through one authoritative bundle fetch path', async () => {
    const { router } = await renderRouteAt('/specification/42');

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/specification/42/grounding');
    });

    const specificationFetches = fetchMock.mock.calls.filter(([input]) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      return url === '/api/specifications/42';
    });
    expect(specificationFetches).toHaveLength(1);
  });

  it('refreshes only the entities domain for observer-owned invalidation on a mounted interview route', async () => {
    await renderRouteAt('/specification/42/grounding');

    expect(await screen.findByRole('heading', { name: 'Interview screen' })).toBeTruthy();
    expect(interviewViewRenderCount).toBe(1);
    expect(interviewViewMountCount).toBe(1);
    expect(interviewViewUnmountCount).toBe(0);

    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ['specification', '42', 'entities'] });
    });

    await waitFor(() => {
      const entityFetches = fetchMock.mock.calls.filter(([input]) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        return url === '/api/specifications/42/entities?mode=active-path';
      });
      expect(entityFetches).toHaveLength(2);
    });

    const specificationFetches = fetchMock.mock.calls.filter(([input]) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      return url === '/api/specifications/42';
    });
    expect(specificationFetches).toHaveLength(1);
    expect(interviewViewRenderCount).toBe(1);
    expect(interviewViewMountCount).toBe(1);
    expect(interviewViewUnmountCount).toBe(0);
  });

  it('refreshes the specification bundle without remounting the interview route for mutation-owned invalidation', async () => {
    await renderRouteAt('/specification/42/grounding');

    expect(await screen.findByRole('heading', { name: 'Interview screen' })).toBeTruthy();
    expect(interviewViewMountCount).toBe(1);
    expect(interviewViewUnmountCount).toBe(0);

    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ['specification', '42', 'bundle'] });
    });

    await waitFor(() => {
      const specificationFetches = fetchMock.mock.calls.filter(([input]) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        return url === '/api/specifications/42';
      });
      expect(specificationFetches).toHaveLength(2);
    });

    const entityFetches = fetchMock.mock.calls.filter(([input]) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      return url === '/api/specifications/42/entities?mode=active-path';
    });
    expect(entityFetches).toHaveLength(1);
    expect(interviewViewMountCount).toBe(1);
    expect(interviewViewUnmountCount).toBe(0);
  });

  it('redirects a completed specification index to the output route through one authoritative bundle fetch path', async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

      if (url.match(/\/api\/specifications\/\d+$/)) {
        return jsonResponse({
          ...minimalSpecificationState,
          workflow: {
            phases: {
              grounding: { ...minimalSpecificationState.workflow.phases.grounding, status: 'closed' },
              design: { ...minimalSpecificationState.workflow.phases.design, status: 'closed' },
              requirements: { ...minimalSpecificationState.workflow.phases.requirements, status: 'closed' },
              criteria: { ...minimalSpecificationState.workflow.phases.criteria, status: 'closed' },
            },
          },
        });
      }

      return defaultFetchHandler(input);
    });

    const { router } = await renderRouteAt('/specification/42');

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/specification/42/export');
    });

    const specificationFetches = fetchMock.mock.calls.filter(([input]) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      return url === '/api/specifications/42';
    });
    expect(specificationFetches).toHaveLength(1);
  });
});
