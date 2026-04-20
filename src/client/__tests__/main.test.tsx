// @vitest-environment happy-dom

import { StrictMode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const createRootMock = vi.fn();
const renderMock = vi.fn();
const routeTree = { __brand: 'generated-route-tree' };
const router = { __brand: 'router' };
const createRouterMock = vi.fn(() => router);
const RouterProviderMock = vi.fn(() => null);
const QueryClientProviderMock = vi.fn(({ children }: { children: React.ReactNode }) => <>{children}</>);
const QueryClientMock = vi.fn();

vi.mock('react-dom/client', () => ({
  createRoot: createRootMock,
}));

vi.mock('@tanstack/react-query', () => ({
  QueryClient: QueryClientMock,
  QueryClientProvider: QueryClientProviderMock,
}));

vi.mock('@tanstack/react-router', () => ({
  createRoute: vi.fn(() => ({})),
  createRootRoute: vi.fn(() => ({
    addChildren: vi.fn(() => ({ __brand: 'manual-route-tree' })),
  })),
  createRouter: createRouterMock,
  RouterProvider: RouterProviderMock,
}));

vi.mock('../routeTree.gen.js', () => ({
  routeTree,
}));

beforeEach(() => {
  vi.resetModules();
  createRootMock.mockReset();
  renderMock.mockReset();
  createRouterMock.mockReset();
  createRouterMock.mockReturnValue(router);
  QueryClientMock.mockReset();
  QueryClientProviderMock.mockClear();
  RouterProviderMock.mockClear();
  document.body.innerHTML = '<div id="root"></div>';
  createRootMock.mockReturnValue({ render: renderMock });
});

describe('main entrypoint', () => {
  it('boots the app with a router built from the generated route tree', async () => {
    await import('../main.js');

    expect(createRootMock).toHaveBeenCalledWith(document.getElementById('root'));
    expect(QueryClientMock).toHaveBeenCalledWith({
      defaultOptions: {
        queries: {
          staleTime: 30_000,
          refetchOnWindowFocus: false,
        },
      },
    });
    expect(createRouterMock).toHaveBeenCalledWith({ routeTree });

    const appTree = renderMock.mock.calls[0]?.[0];
    expect(appTree.type).toBe(StrictMode);

    const children = Array.isArray(appTree.props.children)
      ? appTree.props.children
      : [appTree.props.children];
    const queryClientProvider = children[0];
    expect(queryClientProvider.type).toBe(QueryClientProviderMock);

    const routerProvider = queryClientProvider.props.children;
    expect(routerProvider.type).toBe(RouterProviderMock);
    expect(routerProvider.props.router).toBe(router);
  });
});
