import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { createRoute } from '@tanstack/react-router';

import { GraphOverviewPanel } from '../features/graph/GraphOverview.js';
import { graphOverviewQueryOptions } from '../queries/graph.js';
import { sessionTranscriptDisplayQueryOptions } from '../queries/session.js';
import { workspaceSnapshotQueryOptions } from '../queries/workspace.js';
import { rootRoute, sessionProjectionTargetFromSnapshot, TranscriptPanel, WorkspaceChrome } from './root.js';

export const specRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/spec/$specId',
  loader: ({ context, params }) => {
    const specId = Number(params.specId);
    return Promise.all([
      context.queryClient.ensureQueryData(workspaceSnapshotQueryOptions(context.rpcClient)),
      context.queryClient.ensureQueryData(graphOverviewQueryOptions(context.rpcClient, specId)),
    ]);
  },
  component: SpecRoutePage,
});

function SpecRoutePage() {
  const { rpcClient } = specRoute.useRouteContext();
  const { specId } = specRoute.useParams();
  const parsedSpecId = Number(specId);
  const { data: snapshot } = useSuspenseQuery(workspaceSnapshotQueryOptions(rpcClient));
  const { data: overview } = useSuspenseQuery(graphOverviewQueryOptions(rpcClient, parsedSpecId));
  const target = sessionProjectionTargetFromSnapshot(snapshot, parsedSpecId);
  const projection = useQuery(sessionTranscriptDisplayQueryOptions(rpcClient, target));

  return (
    <main>
      <p>Brunch workspace</p>
      <WorkspaceChrome snapshot={snapshot} fallbackSpecId={parsedSpecId} />
      <GraphOverviewPanel overview={overview} />
      <TranscriptPanel snapshot={snapshot} projection={projection} viewedSpecId={parsedSpecId} />
    </main>
  );
}
