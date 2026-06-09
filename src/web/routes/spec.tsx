import { useSuspenseQuery } from '@tanstack/react-query';
import { createRoute } from '@tanstack/react-router';

import { GraphOverviewPanel } from '../features/graph/GraphOverview.js';
import { graphOverviewQueryOptions } from '../queries/graph.js';
import { workspaceStateQueryOptions } from '../queries/workspace.js';
import { rootRoute, SessionPanel, WorkspaceChrome } from './root.js';

export const specRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/spec/$specId',
  loader: ({ context, params }) => {
    const specId = parseSpecRouteId(params.specId);
    if (specId === undefined) {
      return context.queryClient.ensureQueryData(workspaceStateQueryOptions(context.rpcClient));
    }
    return Promise.all([
      context.queryClient.ensureQueryData(workspaceStateQueryOptions(context.rpcClient)),
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
  const { data: state } = useSuspenseQuery(workspaceStateQueryOptions(rpcClient));
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-4 px-5 py-8 sm:px-8 lg:px-10">
      <p className="text-hint font-mono text-xs">Brunch workspace</p>
      <WorkspaceChrome state={state} />
      <p className="border-rule text-link rounded-xl border bg-white p-4 text-sm shadow-[var(--shadow-card)]">
        Invalid spec id.
      </p>
    </main>
  );
}

function ValidSpecRoutePage({ specId }: { specId: number }) {
  const { rpcClient } = specRoute.useRouteContext();
  const { data: state } = useSuspenseQuery(workspaceStateQueryOptions(rpcClient));
  const { data: overview } = useSuspenseQuery(graphOverviewQueryOptions(rpcClient, specId));

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-4 px-5 py-8 sm:px-8 lg:px-10">
      <p className="text-hint font-mono text-xs">Brunch workspace</p>
      <WorkspaceChrome state={state} fallbackSpecId={specId} />
      <GraphOverviewPanel overview={overview} />
      <SessionPanel state={state} viewedSpecId={specId} />
    </main>
  );
}

function parseSpecRouteId(value: string): number | undefined {
  if (!/^[1-9]\d*$/u.test(value)) return undefined;
  const specId = Number(value);
  return Number.isSafeInteger(specId) ? specId : undefined;
}
