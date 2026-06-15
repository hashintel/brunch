import { useSuspenseQuery } from '@tanstack/react-query';
import { createRoute } from '@tanstack/react-router';

import { KnowledgeGraphView } from '../features/graph/structured-list-view.js';
import { graphOverviewQueryOptions } from '../queries/graph.js';
import { workspaceStateQueryOptions } from '../queries/workspace.js';
import { parseSpecId } from '../spec-id.js';
import { rootRoute } from './root.js';

export const specRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/spec/$specId',
  loader: ({ context, params }) => {
    const specId = parseSpecId(params.specId);
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
  const parsedSpecId = parseSpecId(specId);
  if (parsedSpecId === undefined) return <InvalidSpecRoutePage />;
  return <ValidSpecRoutePage specId={parsedSpecId} />;
}

function InvalidSpecRoutePage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-6 pt-8 pb-10">
        <p className="border-rule text-link rounded-xl border bg-white p-4 text-sm shadow-[var(--shadow-card)]">
          Invalid spec id.
        </p>
      </div>
    </div>
  );
}

function ValidSpecRoutePage({ specId }: { specId: number }) {
  const { rpcClient } = specRoute.useRouteContext();
  const { data: state } = useSuspenseQuery(workspaceStateQueryOptions(rpcClient));
  const { data: overview } = useSuspenseQuery(graphOverviewQueryOptions(rpcClient, specId));
  const specTitle = state.spec?.id === specId ? state.spec.title : undefined;

  return <KnowledgeGraphView overview={overview} {...(specTitle ? { specTitle } : {})} />;
}
