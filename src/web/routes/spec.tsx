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
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-5 py-8 sm:px-8 lg:px-10">
      <p className="text-brunch-muted font-mono text-xs tracking-[0.35em] uppercase">Brunch workspace</p>
      <WorkspaceChrome snapshot={snapshot} />
      <p className="border-brunch-accent/40 text-brunch-accent rounded-[1.5rem] border bg-white/60 p-5">
        Invalid spec id.
      </p>
    </main>
  );
}

function ValidSpecRoutePage({ specId }: { specId: number }) {
  const { rpcClient } = specRoute.useRouteContext();
  const { data: snapshot } = useSuspenseQuery(workspaceSnapshotQueryOptions(rpcClient));
  const { data: overview } = useSuspenseQuery(graphOverviewQueryOptions(rpcClient, specId));

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-5 py-8 sm:px-8 lg:px-10">
      <p className="text-brunch-muted font-mono text-xs tracking-[0.35em] uppercase">Brunch workspace</p>
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
