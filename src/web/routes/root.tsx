import { useSuspenseQuery, type QueryClient } from '@tanstack/react-query';
import { Outlet, createRootRouteWithContext, createRoute } from '@tanstack/react-router';
import type { ReactNode } from 'react';

import type { WorkspaceState } from '../../projections/workspace/workspace-state.js';
import { workspaceStateQueryOptions } from '../queries/workspace.js';
import type { WebSocketRpcClient } from '../rpc-client.js';
import { useBrunchUpdateSubscription } from '../subscriptions/brunch-updates.js';

export type SessionProjectionTarget = {
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
  loader: ({ context }) => context.queryClient.ensureQueryData(workspaceStateQueryOptions(context.rpcClient)),
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

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-5 py-8 sm:px-8 lg:px-10">
      <p className="text-brunch-muted font-mono text-xs tracking-[0.35em] uppercase">Brunch workspace</p>
      <WorkspaceChrome state={state} />
      <SessionPanel state={state} />
    </main>
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
      className="border-brunch-rule/80 bg-brunch-card/85 grid gap-3 rounded-[2rem] border p-5 shadow-[0_24px_80px_rgb(73_50_24_/_0.12)] backdrop-blur sm:grid-cols-2 lg:grid-cols-5"
    >
      <div className="rounded-2xl bg-white/45 p-4 lg:col-span-2">
        <dt className="text-brunch-muted font-mono text-[0.68rem] tracking-[0.22em] uppercase">cwd</dt>
        <dd className="text-brunch-ink mt-2 font-mono text-sm break-all">{state.cwd}</dd>
      </div>
      <div className="rounded-2xl bg-white/45 p-4">
        <dt className="text-brunch-muted font-mono text-[0.68rem] tracking-[0.22em] uppercase">spec</dt>
        <dd className="text-brunch-ink mt-2 text-lg leading-tight font-semibold">{specLabel}</dd>
      </div>
      <div className="rounded-2xl bg-white/45 p-4">
        <dt className="text-brunch-muted font-mono text-[0.68rem] tracking-[0.22em] uppercase">session</dt>
        <dd className="text-brunch-ink mt-2 font-mono text-sm break-all">
          {state.session?.id ?? 'No session selected'}
        </dd>
      </div>
      <div className="rounded-2xl bg-white/45 p-4">
        <dt className="text-brunch-muted font-mono text-[0.68rem] tracking-[0.22em] uppercase">phase</dt>
        <dd className="text-brunch-ink mt-2 text-sm font-medium">{state.chrome.phase}</dd>
      </div>
      <div className="border-brunch-rule/70 rounded-2xl border bg-white/35 p-4 sm:col-span-2 lg:col-span-5">
        <dt className="text-brunch-muted font-mono text-[0.68rem] tracking-[0.22em] uppercase">chat mode</dt>
        <dd className="text-brunch-accent mt-2 text-sm font-medium">{state.chrome.chatMode}</dd>
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
      className="border-brunch-rule/70 rounded-[1.75rem] border bg-white/55 p-5 shadow-[0_14px_50px_rgb(73_50_24_/_0.08)]"
    >
      <h2 className="text-brunch-ink text-2xl font-semibold tracking-[-0.03em]">Session</h2>
      <div className="text-brunch-muted mt-3 space-y-2 text-sm">{content}</div>
    </section>
  );
}
