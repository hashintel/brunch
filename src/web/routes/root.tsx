import { useSuspenseQuery, type QueryClient } from '@tanstack/react-query';
import { Link, Outlet, createRootRouteWithContext, createRoute } from '@tanstack/react-router';

import { AppHeader } from '../components/app-header.js';
import {
  workspaceSelectionStateQueryOptions,
  workspaceStateQueryOptions,
  type WorkspaceSelectionState,
} from '../queries/workspace.js';
import type { WebSocketRpcClient } from '../rpc-client.js';
import { useBrunchUpdateSubscription } from '../subscriptions/brunch-updates.js';

export interface BrunchWebRouterContext {
  queryClient: QueryClient;
  rpcClient: WebSocketRpcClient;
}

export const rootRoute = createRootRouteWithContext<BrunchWebRouterContext>()({
  loader: ({ context }) => context.queryClient.ensureQueryData(workspaceStateQueryOptions(context.rpcClient)),
  component: RootLayout,
});

export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(workspaceStateQueryOptions(context.rpcClient)),
      context.queryClient.ensureQueryData(workspaceSelectionStateQueryOptions(context.rpcClient)),
    ]),
  component: WorkspaceStatePage,
});

function RootLayout() {
  const { queryClient, rpcClient } = rootRoute.useRouteContext();
  useBrunchUpdateSubscription(queryClient, rpcClient);
  const { data: state } = useSuspenseQuery(workspaceStateQueryOptions(rpcClient));
  return (
    <div className="flex h-screen flex-col bg-white">
      <AppHeader cwd={state.cwd} />
      <div className="min-h-0 flex-1 overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}

function WorkspaceStatePage() {
  const { rpcClient } = indexRoute.useRouteContext();
  const { data: selection } = useSuspenseQuery(workspaceSelectionStateQueryOptions(rpcClient));

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-6 pt-8 pb-10">
        <SpecList specs={selection.specs} />
      </div>
    </div>
  );
}

function SpecList(options: { specs: WorkspaceSelectionState['specs'] }) {
  return (
    <nav aria-label="Specs" className="flex flex-col gap-3">
      <p className="text-hint text-xxs font-mono">Specifications</p>
      {options.specs.length === 0 ? (
        <p className="border-rule bg-tint text-sub rounded-xl border p-6 text-sm">
          No specs in this workspace.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {options.specs.map(({ spec }) => (
            <li key={spec.id}>
              <Link
                to="/spec/$specId"
                params={{ specId: String(spec.id) }}
                className="border-rule hover:bg-tint flex items-baseline gap-3 rounded-xl border bg-white p-3 shadow-[var(--shadow-card)]"
              >
                <span className="text-hint shrink-0 font-mono text-xs">{`Spec ${spec.id}`}</span>
                <span className="text-ink text-sm">{spec.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
}
