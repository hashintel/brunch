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

const rootRoute = createRootRouteWithContext<RouterContext>()({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(
      workspaceSnapshotQueryOptions(context.rpcClient),
    ),
  component: WorkspaceSnapshotPage,
})

const routeTree = rootRoute

export function createBrunchWebRouter(rpcClient: WebSocketRpcClient) {
  const queryClient = new QueryClient()

  return createRouter({
    routeTree,
    defaultPreloadStaleTime: 0,
    context: { queryClient, rpcClient },
    Wrap: ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  })
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createBrunchWebRouter>
  }
}

export function BrunchWebApp(options: { rpcClient: WebSocketRpcClient }) {
  const router = createBrunchWebRouter(options.rpcClient)
  return (
    <Suspense
      fallback={<main aria-busy="true">Loading Brunch workspace…</main>}
    >
      <RouterProvider router={router} />
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
