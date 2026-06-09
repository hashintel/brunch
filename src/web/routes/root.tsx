import { useSuspenseQuery, type QueryClient } from '@tanstack/react-query';
import { Link, Outlet, createRootRouteWithContext, createRoute } from '@tanstack/react-router';
import type { ReactNode } from 'react';

import type { WorkspaceState } from '../../projections/workspace/workspace-state.js';
import {
  workspaceSelectionStateQueryOptions,
  workspaceStateQueryOptions,
  type WorkspaceSelectionState,
} from '../queries/workspace.js';
import type { WebSocketRpcClient } from '../rpc-client.js';
import { useBrunchUpdateSubscription } from '../subscriptions/brunch-updates.js';

type SessionProjectionTarget = {
  sessionId: string;
  specId: number;
};
export interface BrunchWebRouterContext {
  queryClient: QueryClient;
  rpcClient: WebSocketRpcClient;
}

export const rootRoute = createRootRouteWithContext<BrunchWebRouterContext>()({
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

export function sessionProjectionTargetFromState(
  state: WorkspaceState,
  viewedSpecId?: number,
): SessionProjectionTarget | null {
  if (!state.session || !state.spec) {
    return null;
  }
  if (viewedSpecId !== undefined && state.spec.id !== viewedSpecId) {
    return null;
  }
  return { sessionId: state.session.id, specId: state.spec.id };
}

function RootLayout() {
  const { queryClient, rpcClient } = rootRoute.useRouteContext();
  useBrunchUpdateSubscription(queryClient, rpcClient);
  return <Outlet />;
}

function WorkspaceStatePage() {
  const { rpcClient } = indexRoute.useRouteContext();
  const { data: state } = useSuspenseQuery(workspaceStateQueryOptions(rpcClient));
  const { data: selection } = useSuspenseQuery(workspaceSelectionStateQueryOptions(rpcClient));

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-4 px-5 py-8 sm:px-8 lg:px-10">
      <p className="text-hint font-mono text-xs">Brunch workspace</p>
      <WorkspaceChrome state={state} />
      <SpecList specs={selection.specs} />
      <SessionPanel state={state} />
    </main>
  );
}

function SpecList(options: { specs: WorkspaceSelectionState['specs'] }) {
  return (
    <nav
      aria-label="Specs"
      className="border-rule rounded-xl border bg-white p-4 shadow-[var(--shadow-card)]"
    >
      <h2 className="text-ink text-base font-semibold">Specs</h2>
      {options.specs.length === 0 ? (
        <p className="text-sub mt-2 text-sm">No specs in this workspace.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1">
          {options.specs.map(({ spec }) => (
            <li key={spec.id}>
              <Link
                to="/spec/$specId"
                params={{ specId: String(spec.id) }}
                className="hover:border-rule hover:bg-tint flex items-baseline gap-3 rounded-lg border border-transparent px-2 py-1.5"
              >
                <span className="text-hint shrink-0 font-mono text-xs">{`Spec ${spec.id}`}</span>
                <span className="text-link text-sm">{spec.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
}

export function WorkspaceChrome(options: { state: WorkspaceState; fallbackSpecId?: number }) {
  const { state } = options;
  const specLabel =
    state.spec?.title ??
    (options.fallbackSpecId === undefined ? 'No spec selected' : `Spec ${options.fallbackSpecId}`);
  return (
    <dl
      aria-label="Workspace chrome"
      className="border-rule overflow-hidden rounded-xl border bg-white p-4 shadow-[var(--shadow-card)]"
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <dt className="text-xxs text-hint font-mono">cwd</dt>
          <dd className="text-ink mt-1 font-mono text-sm break-all">{state.cwd}</dd>
        </div>
        <div>
          <dt className="text-xxs text-hint font-mono">spec</dt>
          <dd className="text-ink mt-1 text-sm font-medium">{specLabel}</dd>
        </div>
        <div>
          <dt className="text-xxs text-hint font-mono">session</dt>
          <dd className="text-ink mt-1 font-mono text-sm break-all">
            {state.session?.id ?? 'No session selected'}
          </dd>
        </div>
      </div>
      <div className="border-rule mt-4 grid gap-4 border-t pt-4 sm:grid-cols-2">
        <div>
          <dt className="text-xxs text-hint font-mono">phase</dt>
          <dd className="text-ink mt-1 text-sm font-medium">{state.chrome.phase}</dd>
        </div>
        <div>
          <dt className="text-xxs text-hint font-mono">chat mode</dt>
          <dd className="text-link mt-1 text-sm font-medium">{state.chrome.chatMode}</dd>
        </div>
      </div>
    </dl>
  );
}

export function SessionPanel(options: { state: WorkspaceState; viewedSpecId?: number }) {
  let content: ReactNode;
  if (!options.state.session || !options.state.spec) {
    content = <p>No Brunch session selected.</p>;
  } else if (options.viewedSpecId !== undefined && options.state.spec.id !== options.viewedSpecId) {
    content = (
      <>
        <p>{`No session is attached for viewed Spec ${options.viewedSpecId}.`}</p>
        <p>{`The TUI is active in Spec ${options.state.spec.id}/${options.state.session.id}.`}</p>
      </>
    );
  } else {
    content = (
      <>
        <p>{`Attached session: ${options.state.session.id}`}</p>
        <p>{`Spec ${options.state.spec.id}`}</p>
      </>
    );
  }

  return (
    <section
      aria-label="Session"
      className="border-rule rounded-xl border bg-white p-4 shadow-[var(--shadow-card)]"
    >
      <h2 className="text-ink text-base font-semibold">Session</h2>
      <div className="text-sub mt-2 space-y-1 text-sm">{content}</div>
    </section>
  );
}
