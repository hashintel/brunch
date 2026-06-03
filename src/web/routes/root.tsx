import { useSuspenseQuery, type QueryClient } from '@tanstack/react-query';
import { Outlet, createRootRouteWithContext, createRoute } from '@tanstack/react-router';

import type { WorkspaceSnapshot } from '../../print-snapshot.js';
import { workspaceSnapshotQueryOptions } from '../queries/workspace.js';
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
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(workspaceSnapshotQueryOptions(context.rpcClient)),
  component: WorkspaceSnapshotPage,
});

export function sessionProjectionTargetFromSnapshot(
  snapshot: WorkspaceSnapshot,
  viewedSpecId?: number,
): SessionProjectionTarget | null {
  if (!snapshot.session || !snapshot.spec) {
    return null;
  }
  if (viewedSpecId !== undefined && snapshot.spec.id !== viewedSpecId) {
    return null;
  }
  return { sessionId: snapshot.session.id, specId: snapshot.spec.id };
}

function RootLayout() {
  const { queryClient, rpcClient } = rootRoute.useRouteContext();
  useBrunchUpdateSubscription(queryClient, rpcClient);
  return <Outlet />;
}

function WorkspaceSnapshotPage() {
  const { rpcClient } = indexRoute.useRouteContext();
  const { data: snapshot } = useSuspenseQuery(workspaceSnapshotQueryOptions(rpcClient));

  return (
    <main>
      <p>Brunch workspace</p>
      <WorkspaceChrome snapshot={snapshot} />
      <SessionPanel snapshot={snapshot} />
    </main>
  );
}

export function WorkspaceChrome(options: { snapshot: WorkspaceSnapshot; fallbackSpecId?: number }) {
  const { snapshot } = options;
  const specLabel =
    snapshot.spec?.title ??
    (options.fallbackSpecId === undefined ? 'No spec selected' : `Spec ${options.fallbackSpecId}`);
  return (
    <dl aria-label="Workspace chrome">
      <div>
        <dt>cwd</dt>
        <dd>{snapshot.cwd}</dd>
      </div>
      <div>
        <dt>spec</dt>
        <dd>{specLabel}</dd>
      </div>
      <div>
        <dt>session</dt>
        <dd>{snapshot.session?.id ?? 'No session selected'}</dd>
      </div>
      <div>
        <dt>phase</dt>
        <dd>{snapshot.chrome.phase}</dd>
      </div>
      <div>
        <dt>chat mode</dt>
        <dd>{snapshot.chrome.chatMode}</dd>
      </div>
    </dl>
  );
}

export function SessionPanel(options: { snapshot: WorkspaceSnapshot; viewedSpecId?: number }) {
  if (!options.snapshot.session || !options.snapshot.spec) {
    return (
      <section aria-label="Session">
        <h2>Session</h2>
        <p>No Brunch session selected.</p>
      </section>
    );
  }

  if (options.viewedSpecId !== undefined && options.snapshot.spec.id !== options.viewedSpecId) {
    return (
      <section aria-label="Session">
        <h2>Session</h2>
        <p>{`No session is attached for viewed Spec ${options.viewedSpecId}.`}</p>
        <p>{`The TUI is active in Spec ${options.snapshot.spec.id}/${options.snapshot.session.id}.`}</p>
      </section>
    );
  }

  return (
    <section aria-label="Session">
      <h2>Session</h2>
      <p>{`Attached session: ${options.snapshot.session.id}`}</p>
      <p>{`Spec ${options.snapshot.spec.id}`}</p>
    </section>
  );
}
