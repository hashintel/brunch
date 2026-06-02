import {
  QueryClient,
  QueryClientProvider,
  queryOptions,
  useQuery,
  useSuspenseQuery,
} from "@tanstack/react-query"
import {
  RouterProvider,
  createRootRouteWithContext,
  createRouter,
} from "@tanstack/react-router"
import { Suspense } from "react"

import type { TranscriptDisplayProjection } from "../elicitation-exchange.js"
import type { WorkspaceSnapshot } from "../print-snapshot.js"
import type { WebSocketRpcClient } from "./rpc-client.js"

type RouterContext = {
  queryClient: QueryClient
  rpcClient: WebSocketRpcClient
}

type SessionProjectionTarget = {
  sessionId: string
  specId: string
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

function sessionProjectionTargetFromSnapshot(
  snapshot: WorkspaceSnapshot,
): SessionProjectionTarget | null {
  if (!snapshot.session || !snapshot.spec) {
    return null
  }
  return { sessionId: snapshot.session.id, specId: snapshot.spec.id }
}

function sessionTranscriptDisplayQueryOptions(
  rpcClient: WebSocketRpcClient,
  target: SessionProjectionTarget | null,
) {
  return {
    queryKey: [
      "session.transcriptDisplay",
      target?.sessionId ?? null,
      target?.specId ?? null,
    ],
    queryFn: () =>
      rpcClient.request<TranscriptDisplayProjection>(
        "session.transcriptDisplay",
        target ?? unreachableSessionProjectionTarget(),
      ),
    enabled: target !== null,
    retry: false,
  }
}

function unreachableSessionProjectionTarget(): never {
  throw new Error("Session transcript query is disabled without a target")
}

function WorkspaceSnapshotPage() {
  const { rpcClient } = rootRoute.useRouteContext()
  const { data: snapshot } = useSuspenseQuery(
    workspaceSnapshotQueryOptions(rpcClient),
  )
  const target = sessionProjectionTargetFromSnapshot(snapshot)
  const projection = useQuery(
    sessionTranscriptDisplayQueryOptions(rpcClient, target),
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
      <TranscriptPanel snapshot={snapshot} projection={projection} />
    </main>
  )
}

function TranscriptPanel(options: {
  snapshot: WorkspaceSnapshot
  projection: ReturnType<typeof useQuery<TranscriptDisplayProjection>>
}) {
  if (!options.snapshot.session || !options.snapshot.spec) {
    return (
      <section aria-label="Session transcript">
        <h2>Session transcript</h2>
        <p>No Brunch session selected.</p>
      </section>
    )
  }

  if (options.projection.isError) {
    return (
      <section aria-label="Session transcript">
        <h2>Session transcript</h2>
        <p>{`Transcript unavailable: ${errorMessage(options.projection.error)}`}</p>
      </section>
    )
  }

  if (!options.projection.data) {
    return (
      <section aria-busy="true" aria-label="Session transcript">
        <h2>Session transcript</h2>
        <p>Loading transcript…</p>
      </section>
    )
  }

  const projection = options.projection.data
  return (
    <section aria-label="Session transcript">
      <h2>Session transcript</h2>
      {projection.rows.length === 0 ? <p>No transcript messages yet.</p> : null}
      <ol>
        {projection.rows.map((row) => (
          <li key={row.id}>
            <article aria-label={`${row.role} message`}>
              <strong>{row.role}</strong>
              <p>{row.text}</p>
            </article>
          </li>
        ))}
      </ol>
    </section>
  )
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
