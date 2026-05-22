import {
  QueryClient,
  QueryClientProvider,
  queryOptions,
  useSuspenseQuery,
} from "@tanstack/react-query"
import {
  RouterProvider,
  createRootRouteWithContext,
  createRouter,
} from "@tanstack/react-router"
import { Suspense } from "react"

import type { WorkspaceSnapshot } from "../print-snapshot.js"
import type { WebSocketRpcClient } from "./rpc-client.js"

type RouterContext = {
  queryClient: QueryClient
  rpcClient: WebSocketRpcClient
}

export interface BrunchWebRuntime {
  queryClient: QueryClient
  rpcClient: WebSocketRpcClient
  router: ReturnType<typeof createBrunchWebRouter>
  dispose(): void
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(
      workspaceSnapshotQueryOptions(context.rpcClient),
    ),
  component: WorkspaceSnapshotPage,
})

const routeTree = rootRoute

export function createBrunchWebRouter(options: {
  queryClient: QueryClient
  rpcClient: WebSocketRpcClient
}) {
  return createRouter({
    routeTree,
    defaultPreloadStaleTime: 0,
    context: options,
    Wrap: ({ children }) => (
      <QueryClientProvider client={options.queryClient}>
        {children}
      </QueryClientProvider>
    ),
  })
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createBrunchWebRouter>
  }
}

export function createBrunchWebRuntime(options: {
  rpcClient: WebSocketRpcClient
}): BrunchWebRuntime {
  const queryClient = new QueryClient()
  const router = createBrunchWebRouter({
    queryClient,
    rpcClient: options.rpcClient,
  })

  return {
    queryClient,
    rpcClient: options.rpcClient,
    router,
    dispose() {
      options.rpcClient.close()
      queryClient.clear()
    },
  }
}

export function BrunchWebApp(options: { runtime: BrunchWebRuntime }) {
  return (
    <Suspense
      fallback={<main aria-busy="true">Loading Brunch workspace…</main>}
    >
      <RouterProvider router={options.runtime.router} />
    </Suspense>
  )
}

function workspaceSnapshotQueryOptions(rpcClient: WebSocketRpcClient) {
  return queryOptions({
    queryKey: ["workspace.snapshot"],
    queryFn: () => rpcClient.request<WorkspaceSnapshot>("workspace.snapshot"),
  })
}

function WorkspaceSnapshotPage() {
  const { rpcClient } = rootRoute.useRouteContext()
  const { data: snapshot } = useSuspenseQuery(
    workspaceSnapshotQueryOptions(rpcClient),
  )

  return (
    <main>
      <p>Brunch workspace</p>
      <dl aria-label="Workspace chrome">
        <div>
          <dt>cwd</dt>
          <dd>{snapshot.cwd}</dd>
        </div>
        <div>
          <dt>spec</dt>
          <dd>{snapshot.spec?.title ?? "<none>"}</dd>
        </div>
        <div>
          <dt>session</dt>
          <dd>{snapshot.session?.id ?? "<none>"}</dd>
        </div>
        <div>
          <dt>phase</dt>
          <dd>{snapshot.chrome.phase}</dd>
        </div>
        <div>
          <dt>chatMode</dt>
          <dd>{snapshot.chrome.chatMode}</dd>
        </div>
      </dl>
    </main>
  )
}
