import { useSuspenseQuery } from '@tanstack/react-query';
import { createRoute } from '@tanstack/react-router';

import { GraphOverviewPanel } from '../features/graph/GraphOverview.js';
import { graphOverviewQueryOptions } from '../queries/graph.js';
import { workspaceSnapshotQueryOptions } from '../queries/workspace.js';
import { rootRoute, SessionPanel, WorkspaceChrome } from './root.js';

export const specRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/spec/$specId',
  loader: ({ context, params }) => {
    const specId = parseSpecRouteId(params.specId);
    if (specId === undefined) {
      return context.queryClient.ensureQueryData(workspaceSnapshotQueryOptions(context.rpcClient));
    }
    return Promise.all([
      context.queryClient.ensureQueryData(workspaceSnapshotQueryOptions(context.rpcClient)),
      context.queryClient.ensureQueryData(graphOverviewQueryOptions(context.rpcClient, specId)),
    ]);
  },
  component: SpecRoutePage,
});

function SpecRoutePage() {
  const { specId } = specRoute.useParams();
  const parsedSpecId = parseSpecRouteId(specId);
  if (parsedSpecId === undefined) return <InvalidSpecRoutePage />;
  return <ValidSpecRoutePage specId={parsedSpecId} />;
}

function InvalidSpecRoutePage() {
  const { rpcClient } = specRoute.useRouteContext();
  const { data: snapshot } = useSuspenseQuery(workspaceSnapshotQueryOptions(rpcClient));
  return (
    <main>
      <p>Brunch workspace</p>
      <WorkspaceChrome snapshot={snapshot} />
      <p>Invalid spec id.</p>
    </main>
  );
}

function ValidSpecRoutePage({ specId }: { specId: number }) {
  const { rpcClient } = specRoute.useRouteContext();
  const { data: snapshot } = useSuspenseQuery(workspaceSnapshotQueryOptions(rpcClient));
  const { data: overview } = useSuspenseQuery(graphOverviewQueryOptions(rpcClient, specId));

  return (
    <main>
      <p>Brunch workspace</p>
      <WorkspaceChrome snapshot={snapshot} fallbackSpecId={specId} />
      <GraphOverviewPanel overview={overview} />
      <SessionPanel snapshot={snapshot} viewedSpecId={specId} />
    </main>
  );
}

function parseSpecRouteId(value: string): number | undefined {
  if (!/^[1-9]\d*$/u.test(value)) return undefined;
  const specId = Number(value);
  return Number.isSafeInteger(specId) ? specId : undefined;
}
