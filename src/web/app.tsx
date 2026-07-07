import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createRouter, type AnyRouter } from '@tanstack/react-router';
import { Suspense } from 'react';

import { createBrunchQueryClient } from './query-client.js';
import { indexRoute, rootRoute, type BrunchWebRouterContext } from './routes/root.js';
import { runDetailRoute, runsRoute } from './routes/runs.js';
import { specRoute } from './routes/spec.js';
import type { WebSocketRpcClient } from './rpc-client.js';

type BrunchWebRouter = AnyRouter;

export interface BrunchWebRuntime {
  queryClient: BrunchWebRouterContext['queryClient'];
  rpcClient: WebSocketRpcClient;
  router: BrunchWebRouter;
  dispose(): void;
}

const routeTree = rootRoute.addChildren([indexRoute, specRoute, runsRoute, runDetailRoute]);

export function createBrunchWebRouter(options: BrunchWebRouterContext): BrunchWebRouter {
  return createRouter({
    routeTree,
    defaultPreloadStaleTime: 0,
    context: options,
    Wrap: ({ children }) => (
      <QueryClientProvider client={options.queryClient}>{children}</QueryClientProvider>
    ),
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: BrunchWebRouter;
  }
}

export function createBrunchWebRuntime(options: { rpcClient: WebSocketRpcClient }): BrunchWebRuntime {
  const queryClient = createBrunchQueryClient();
  const router = createBrunchWebRouter({
    queryClient,
    rpcClient: options.rpcClient,
  });

  return {
    queryClient,
    rpcClient: options.rpcClient,
    router,
    dispose() {
      options.rpcClient.close();
      queryClient.clear();
    },
  };
}

export function BrunchWebApp(options: { runtime: BrunchWebRuntime }) {
  return (
    <Suspense fallback={<main aria-busy="true">Loading Brunch workspace…</main>}>
      <RouterProvider router={options.runtime.router} />
    </Suspense>
  );
}
