// @vitest-environment happy-dom

import { createMemoryHistory } from '@tanstack/history';
import { createRouter, RouterProvider } from '@tanstack/react-router';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const routeHarness = vi.hoisted(() => ({
  fetchInterviewWorkspaceLoaderData: vi.fn(async (id: string) => ({ id, kind: 'interview' })),
  fetchKnowledgeWorkspaceLoaderData: vi.fn(async (id: string) => ({ id, kind: 'knowledge' })),
  fetchExportPreviewLoaderData: vi.fn(async (id: string) => ({ id, ready: false })),
}));
const fetchMock = vi.fn<typeof fetch>();

vi.mock('./components/route-skeletons.js', () => ({
  InterviewWorkspaceSkeleton: () => <div>Interview loading</div>,
  KnowledgeWorkspaceSkeleton: () => <div>Knowledge loading</div>,
}));

vi.mock('./routes/ProjectList.js', () => ({
  ProjectList: () => <h1>Projects screen</h1>,
}));

vi.mock('./routes/InterviewWorkspace.js', () => ({
  InterviewWorkspace: () => <h1>Interview screen</h1>,
}));

vi.mock('./routes/KnowledgeWorkspace.js', () => ({
  KnowledgeWorkspace: () => <h1>Knowledge screen</h1>,
}));

vi.mock('./routes/ExportPreview.js', () => ({
  ExportPreview: () => <h1>Export screen</h1>,
}));

vi.mock('./workspace/workspace-loader.js', () => ({
  fetchInterviewWorkspaceLoaderData: routeHarness.fetchInterviewWorkspaceLoaderData,
  fetchKnowledgeWorkspaceLoaderData: routeHarness.fetchKnowledgeWorkspaceLoaderData,
}));

vi.mock('./routes/export-loader.js', () => ({
  fetchExportPreviewLoaderData: routeHarness.fetchExportPreviewLoaderData,
}));

import { routeTree } from './router.js';

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
  routeHarness.fetchInterviewWorkspaceLoaderData.mockClear();
  routeHarness.fetchKnowledgeWorkspaceLoaderData.mockClear();
  routeHarness.fetchExportPreviewLoaderData.mockClear();
  fetchMock.mockImplementation(
    async () =>
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
  );
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('routeTree', () => {
  it('maps the dashboard URL to the project list screen', async () => {
    await renderRouteAt('/');

    expect(await screen.findByRole('heading', { name: 'Projects screen' })).toBeTruthy();
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/projects');
    });
  });

  it('maps the interview workspace URL to the interview route loader and screen', async () => {
    await renderRouteAt('/project/42');

    expect(await screen.findByRole('heading', { name: 'Interview screen' })).toBeTruthy();
    expect(routeHarness.fetchInterviewWorkspaceLoaderData).toHaveBeenCalledWith('42');
  });

  it('keeps the interview workspace pending skeleton active while the route loader is unresolved', async () => {
    const deferredLoader = createDeferredPromise<{ id: string; kind: string }>();
    routeHarness.fetchInterviewWorkspaceLoaderData.mockImplementationOnce(() => deferredLoader.promise);

    const history = createMemoryHistory({ initialEntries: ['/project/42'] });
    const router = createRouter({ routeTree, history, defaultPendingMs: 0 });

    render(<RouterProvider router={router} />);
    void router.load();

    expect(await screen.findByText('Interview loading')).toBeTruthy();
    expect(routeHarness.fetchInterviewWorkspaceLoaderData).toHaveBeenCalledWith('42');

    await act(async () => {
      deferredLoader.resolve({ id: '42', kind: 'interview' });
    });

    expect(await screen.findByRole('heading', { name: 'Interview screen' })).toBeTruthy();
  });

  it('maps the knowledge URL to the knowledge route loader and screen', async () => {
    await renderRouteAt('/project/42/knowledge');

    expect(await screen.findByRole('heading', { name: 'Knowledge screen' })).toBeTruthy();
    expect(routeHarness.fetchKnowledgeWorkspaceLoaderData).toHaveBeenCalledWith('42');
  });

  it('maps the export URL to the export route loader and screen', async () => {
    await renderRouteAt('/project/42/export');

    expect(await screen.findByRole('heading', { name: 'Export screen' })).toBeTruthy();
    expect(routeHarness.fetchExportPreviewLoaderData).toHaveBeenCalledWith('42');
  });
});
