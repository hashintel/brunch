// @vitest-environment happy-dom

import { StrictMode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const createRootMock = vi.fn();
const renderMock = vi.fn();
const router = { __brand: 'router' };
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
  RouterProvider: RouterProviderMock,
}));

vi.mock('./router.js', () => ({
  router,
}));

beforeEach(() => {
  vi.resetModules();
  createRootMock.mockReset();
  renderMock.mockReset();
  QueryClientMock.mockReset();
  QueryClientProviderMock.mockClear();
  RouterProviderMock.mockClear();
  document.body.innerHTML = '<div id="root"></div>';
  createRootMock.mockReturnValue({ render: renderMock });
});

describe('main entrypoint', () => {
  it('boots the app with the shared router provider', async () => {
    await import('./main.js');

    expect(createRootMock).toHaveBeenCalledWith(document.getElementById('root'));
    expect(QueryClientMock).toHaveBeenCalledWith({
      defaultOptions: {
        queries: {
          staleTime: 30_000,
          refetchOnWindowFocus: false,
        },
      },
    });

    const appTree = renderMock.mock.calls[0]?.[0];
    expect(appTree.type).toBe(StrictMode);

    const queryClientProvider = appTree.props.children;
    expect(queryClientProvider.type).toBe(QueryClientProviderMock);

    const routerProvider = queryClientProvider.props.children;
    expect(routerProvider.type).toBe(RouterProviderMock);
    expect(routerProvider.props.router).toBe(router);
  });
});
