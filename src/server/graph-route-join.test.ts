// @vitest-environment happy-dom

import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createMemoryHistory } from '@tanstack/history';
import { QueryClientProvider } from '@tanstack/react-query';
import { createRouter, RouterProvider } from '@tanstack/react-router';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { crossPhaseDecisionLink } from '@/client/__fixtures__/graph-view.js';
import { queryClient } from '@/client/query-client.js';
import type { SpecificationState } from '@/shared/specification.js';

/**
 * The /graph route is the JOIN slice. It is the sole writer of
 * `src/client/routes/specification/$id/graph.tsx` and the only place that
 * composes the three pieces together:
 *
 *   - it lifts the knowledge-graph header OUT of the structured list view and
 *     hosts it at the route level so BOTH views share one header,
 *   - it hosts the list/graph ViewToggle,
 *   - it reads the active view from the `?view` URL param, and
 *   - it feeds both the StructuredListView and the GraphCanvas from a single
 *     project-wide entity state, rendering only the active view.
 *
 * The route component is code-split by the TanStack Router plugin, so it is
 * exercised the way the application drives it: through the real router, at a
 * real URL, with `fetch` stubbed so the route loaders resolve. This keeps the
 * test on the public surface (the URL) rather than the route's internals.
 */

// src/server/graph-route-join.test.ts -> repo root
const packageRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const routePath = resolve(packageRoot, 'src/client/routes/specification/$id/graph.tsx');

const SPEC_ID = 42;

// crossPhaseDecisionLink: goal + constraint + decision + requirement = 4 items,
// and 3 relationships between them.
const POPULATED_ENTITIES = crossPhaseDecisionLink();
const EXPECTED_ITEM_COUNT = 4;
const EXPECTED_CONNECTION_COUNT = 3;

const minimalSpecificationState: SpecificationState = {
  specification: {
    id: SPEC_ID,
    name: 'Test spec',
    mode: 'greenfield',
    active_turn_id: null,
    created_at: '',
    updated_at: '',
  },
  workflow: {
    phases: {
      grounding: {
        status: 'closed',
        closeability: false,
        readiness: 'low',
        closureBasis: null,
        proposalPending: false,
        turnId: null,
        summary: null,
      },
      design: {
        status: 'closed',
        closeability: false,
        readiness: 'low',
        closureBasis: null,
        proposalPending: false,
        turnId: null,
        summary: null,
      },
      requirements: {
        status: 'closed',
        closeability: false,
        readiness: 'low',
        closureBasis: null,
        proposalPending: false,
        turnId: null,
        summary: null,
      },
      criteria: {
        status: 'closed',
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

const fetchMock = vi.fn<typeof fetch>();

function jsonResponse(data: unknown) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function defaultFetchHandler(input: RequestInfo | URL): Response {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

  if (url.match(/\/api\/specifications\/\d+\/reconciliation-needs/)) {
    return jsonResponse({ openNeeds: [] });
  }
  if (url.match(/\/api\/specifications\/\d+\/entities/)) {
    return jsonResponse(POPULATED_ENTITIES);
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
  return jsonResponse([]);
}

/**
 * React Flow measures its container and node sizes through ResizeObserver,
 * DOMMatrixReadOnly and element offset getters — none of which exist in a
 * headless DOM. Install the standard @xyflow/react test doubles so the graph
 * canvas actually mounts. This is test plumbing, not behaviour under test.
 */
function mockReactFlow() {
  class MockResizeObserver {
    callback: ResizeObserverCallback;
    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }
    observe(target: Element) {
      this.callback(
        [
          {
            target,
            contentRect: { width: 40, height: 40, top: 0, left: 0, right: 40, bottom: 40 },
          } as unknown as ResizeObserverEntry,
        ],
        this as unknown as ResizeObserver,
      );
    }
    unobserve() {}
    disconnect() {}
  }
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = MockResizeObserver;

  class MockDOMMatrixReadOnly {
    m22: number;
    constructor(transform?: string) {
      const scale = transform?.match(/scale\(([\d.]+)\)/)?.[1];
      this.m22 = scale === undefined ? 1 : Number(scale);
    }
  }
  (globalThis as unknown as { DOMMatrixReadOnly: unknown }).DOMMatrixReadOnly = MockDOMMatrixReadOnly;

  try {
    Object.defineProperties(globalThis.HTMLElement.prototype, {
      offsetHeight: {
        configurable: true,
        get() {
          return parseFloat((this as HTMLElement).style.height) || 40;
        },
      },
      offsetWidth: {
        configurable: true,
        get() {
          return parseFloat((this as HTMLElement).style.width) || 40;
        },
      },
    });
  } catch {
    // offset getters already redefined by an earlier test in this worker
  }

  (globalThis.SVGElement.prototype as unknown as { getBBox: () => unknown }).getBBox = () => ({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });
  (
    globalThis.Element.prototype as unknown as { getBoundingClientRect: () => unknown }
  ).getBoundingClientRect = function () {
    return { x: 0, y: 0, top: 0, left: 0, bottom: 40, right: 40, width: 40, height: 40, toJSON() {} };
  };
}

// Keep the unrelated heavy screens out of the route tree's import graph so this
// test stays focused on the /graph route (mirrors src/client/__tests__/router).
vi.mock('@/client/routes/-project-list.js', () => ({
  SpecificationList: () => null,
  fetchSpecificationListLoaderData: vi.fn(async () => []),
}));
vi.mock('@/client/routes/specification/$id/_view/-continuous-workspace-view.js', () => ({
  ContinuousWorkspaceView: () => null,
}));
vi.mock('@/client/routes/specification/$id/-export-preview.js', () => ({
  ExportPreview: () => null,
}));

import { routeTree } from '@/client/routeTree.gen.js';

async function renderRouteAt(pathname: string) {
  const history = createMemoryHistory({ initialEntries: [pathname] });
  const router = createRouter({ routeTree, history });

  await act(async () => {
    await router.load();
  });

  return render(
    createElement(QueryClientProvider, { client: queryClient }, createElement(RouterProvider, { router })),
  );
}

const graphView = (path = '') => `/specification/${SPEC_ID}/graph${path}`;

beforeAll(() => {
  mockReactFlow();
});

beforeEach(() => {
  queryClient.clear();
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (input) => defaultFetchHandler(input));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('graph route module', () => {
  it('is the sole composing route file at src/client/routes/specification/$id/graph.tsx', () => {
    expect(existsSync(routePath)).toBe(true);
  });
});

describe('graph route — renders the active view chosen by the ?view param', () => {
  it('shows the structured list view by default (no ?view param)', async () => {
    const { container } = await renderRouteAt(graphView());

    await waitFor(() => {
      expect(container.querySelector('[data-graph-row]')).toBeTruthy();
    });
    // The spatial graph canvas is not mounted for the list view.
    expect(container.querySelector('.react-flow')).toBeNull();
  });

  it('shows the structured list view for ?view=list', async () => {
    const { container } = await renderRouteAt(graphView('?view=list'));

    await waitFor(() => {
      expect(container.querySelector('[data-graph-row]')).toBeTruthy();
    });
    expect(container.querySelector('.react-flow')).toBeNull();
  });

  it('shows the spatial graph canvas for the ?view=graph deep link', async () => {
    const { container } = await renderRouteAt(graphView('?view=graph'));

    await waitFor(() => {
      expect(container.querySelector('.react-flow')).toBeTruthy();
    });
    // The list rows are not rendered when the graph view is active.
    expect(container.querySelector('[data-graph-row]')).toBeNull();
  });

  it('falls back to the list view for an unrecognised ?view value', async () => {
    const { container } = await renderRouteAt(graphView('?view=totally-bogus'));

    await waitFor(() => {
      expect(container.querySelector('[data-graph-row]')).toBeTruthy();
    });
    expect(container.querySelector('.react-flow')).toBeNull();
  });
});

describe('graph route — shares one header lifted out of the list view', () => {
  it('renders the knowledge-graph header in the list view', async () => {
    const { container } = await renderRouteAt(graphView('?view=list'));

    await waitFor(() => {
      expect(container.querySelector('[data-knowledge-graph-identity]')).toBeTruthy();
    });
  });

  it('renders the same header in the graph view, proving it is owned by the route, not the list', async () => {
    const { container } = await renderRouteAt(graphView('?view=graph'));

    // The graph view does not mount StructuredListView, so the header can only
    // appear here if the route lifted it out and hosts it itself.
    await waitFor(() => {
      expect(container.querySelector('.react-flow')).toBeTruthy();
    });
    expect(container.querySelector('[data-knowledge-graph-identity]')).toBeTruthy();
  });
});

describe('graph route — hosts the list/graph view toggle', () => {
  it('marks the list segment active and offers the graph segment in the list view', async () => {
    await renderRouteAt(graphView('?view=list'));

    expect((await screen.findByRole('button', { name: /list view/i })).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect((await screen.findByRole('button', { name: /graph view/i })).getAttribute('aria-pressed')).toBe(
      'false',
    );
  });

  it('marks the graph segment active and offers the list segment in the graph view', async () => {
    await renderRouteAt(graphView('?view=graph'));

    expect((await screen.findByRole('button', { name: /graph view/i })).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect((await screen.findByRole('button', { name: /list view/i })).getAttribute('aria-pressed')).toBe(
      'false',
    );
  });
});

describe('graph route — feeds both views from one project-wide entity state', () => {
  it('drives the shared header counts from the project-wide entities (list view)', async () => {
    const { container } = await renderRouteAt(graphView('?view=list'));

    const header = await waitFor(() => {
      const el = container.querySelector('[data-knowledge-graph-identity]');
      if (el === null) throw new Error('header not rendered');
      return el as HTMLElement;
    });

    expect(within(header).getByText(String(EXPECTED_ITEM_COUNT))).toBeTruthy();
    expect(within(header).getByText(String(EXPECTED_CONNECTION_COUNT))).toBeTruthy();
  });

  it('renders one list row per project-wide knowledge item', async () => {
    const { container } = await renderRouteAt(graphView('?view=list'));

    await waitFor(() => {
      expect(container.querySelector('[data-graph-row]')).toBeTruthy();
    });
    expect(container.querySelectorAll('[data-graph-row]').length).toBe(EXPECTED_ITEM_COUNT);
  });

  it('renders one graph node per project-wide knowledge item, fed from the same source', async () => {
    const { container } = await renderRouteAt(graphView('?view=graph'));

    await waitFor(() => {
      expect(container.querySelectorAll('.react-flow__node').length).toBe(EXPECTED_ITEM_COUNT);
    });
    // The header in the graph view reflects the same project-wide entity state.
    const header = container.querySelector('[data-knowledge-graph-identity]');
    if (header === null) throw new Error('header not rendered in graph view');
    expect(within(header as HTMLElement).getByText(String(EXPECTED_ITEM_COUNT))).toBeTruthy();
  });
});

describe('graph route — graph empty state parity with list view', () => {
  it('passes the return-to-workflow action into the graph empty state', async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.match(/\/api\/specifications\/\d+\/entities/)) {
        return jsonResponse({
          goals: [],
          terms: [],
          contexts: [],
          constraints: [],
          requirements: [],
          criteria: [],
          decisions: [],
          assumptions: [],
          relationships: [],
        });
      }
      return defaultFetchHandler(input);
    });

    const { container } = await renderRouteAt(graphView('?view=graph'));

    await waitFor(() => {
      expect(container.querySelector('[data-graph-empty-state]')).toBeTruthy();
    });
    const action = screen.getByRole('link', { name: /view output/i });
    expect(action.getAttribute('href')).toBe(`/specification/${SPEC_ID}/export`);
    expect(container.querySelector('[data-graph-empty-state]')?.contains(action)).toBe(true);
  });
});
