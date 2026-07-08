import { useQuery, useSuspenseQuery, type QueryClient } from '@tanstack/react-query';
import { Link, Outlet, createRootRouteWithContext, createRoute } from '@tanstack/react-router';

import type { GraphSlice } from '../../graph/queries.js';
import { AppHeader } from '../components/app-header.js';
import { executeRunsQueryOptions, type RunListEntry, type RunSummary } from '../queries/execute.js';
import { graphOverviewQueryOptions } from '../queries/graph.js';
import {
  workspaceSelectionStateQueryOptions,
  workspaceStateQueryOptions,
  type WorkspaceSelectionState,
} from '../queries/workspace.js';
import type { WebSocketRpcClient } from '../rpc-client.js';
import { useBrunchUpdateSubscription } from '../subscriptions/brunch-updates.js';
import { useFollowWorkspaceSpec } from '../subscriptions/follow-workspace-spec.js';

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
      context.queryClient.ensureQueryData(executeRunsQueryOptions(context.rpcClient)),
    ]),
  component: WorkspaceStatePage,
});

function RootLayout() {
  const { queryClient, rpcClient } = rootRoute.useRouteContext();
  useBrunchUpdateSubscription(queryClient, rpcClient);
  const { data: state } = useSuspenseQuery(workspaceStateQueryOptions(rpcClient));
  useFollowWorkspaceSpec(state);
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
  const { data: state } = useSuspenseQuery(workspaceStateQueryOptions(rpcClient));
  const { data: selection } = useSuspenseQuery(workspaceSelectionStateQueryOptions(rpcClient));
  const { data: runs } = useSuspenseQuery(executeRunsQueryOptions(rpcClient));
  const currentSpec = state.spec ?? selection.specs[0]?.spec;
  const currentSpecId = currentSpec?.id;
  const { data: graphOverview } = useQuery({
    ...graphOverviewQueryOptions(rpcClient, currentSpecId ?? 0),
    enabled: currentSpecId !== undefined,
    retry: false,
    throwOnError: false,
  });
  const activeSpecRunCount =
    currentSpecId === undefined
      ? 0
      : selection.specs.length <= 1
        ? runs.runs.length
        : runs.runs.filter((run) => runSpecId(run) === currentSpecId).length;
  const latestRuns = [...runs.runs].reverse().slice(0, 3);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 pt-8 pb-10">
        <SpecList
          specs={selection.specs}
          activeSpecId={currentSpecId}
          graphOverview={graphOverview}
          runCount={activeSpecRunCount}
        />
        <LatestRunsPreview runs={latestRuns} total={runs.runs.length} />
      </div>
    </div>
  );
}

function runSpecId(run: RunListEntry): number | undefined {
  if ('unreadable' in run) return undefined;
  const specId = Number(run.specId);
  return Number.isInteger(specId) ? specId : undefined;
}

function LatestRunsPreview({ runs, total }: { runs: readonly RunListEntry[]; total: number }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="text-hint text-xxs font-mono">Runs</p>
          <p className="text-sub mt-0.5 text-xs">
            {total} executor {total === 1 ? 'run' : 'runs'}
          </p>
        </div>
        <Link to="/runs" className="text-link font-mono text-xs">
          view all runs
        </Link>
      </div>
      {runs.length === 0 ? (
        <p className="border-rule bg-tint text-sub rounded-xl border p-4 text-sm">No executor runs.</p>
      ) : (
        <ol className="grid gap-2 sm:grid-cols-3">
          {runs.map((run) => (
            <li key={run.runId}>
              {'unreadable' in run ? <UnreadableRunPreview run={run} /> : <RunPreview run={run} />}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function RunPreview({ run }: { run: RunSummary }) {
  return (
    <Link
      to="/runs/$runId"
      params={{ runId: run.runId }}
      className="border-rule hover:bg-tint flex min-h-24 flex-col justify-between rounded-xl border bg-white p-3 shadow-[var(--shadow-card)]"
    >
      <span className="text-ink font-mono text-xs font-semibold">{run.runId}</span>
      <span className="text-sub text-xs">{run.status}</span>
      <span className="text-hint font-mono text-[10px]">spec {run.specId}</span>
    </Link>
  );
}

function UnreadableRunPreview({ run }: { run: Extract<RunListEntry, { readonly unreadable: true }> }) {
  return (
    <Link
      to="/runs/$runId"
      params={{ runId: run.runId }}
      className="border-rule bg-tint text-sub flex min-h-24 flex-col justify-between rounded-xl border p-3"
    >
      <span className="font-mono text-xs font-semibold">{run.runId}</span>
      <span className="text-xs">unreadable metadata</span>
    </Link>
  );
}

function SpecList(options: {
  specs: WorkspaceSelectionState['specs'];
  activeSpecId: number | undefined;
  graphOverview: GraphSlice | undefined;
  runCount: number;
}) {
  const signals = specSignals(options.graphOverview);
  return (
    <nav aria-label="Specs" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="text-hint text-xxs font-mono">Specs</p>
          <p className="text-sub mt-0.5 text-xs">
            {options.specs.length} product {options.specs.length === 1 ? 'spec' : 'specs'}
          </p>
        </div>
      </div>
      {options.specs.length === 0 ? (
        <p className="border-rule text-sub rounded-xl border bg-blue-50/60 p-6 text-sm">
          No specs in this workspace.
        </p>
      ) : (
        <ul className="flex flex-col gap-2 rounded-2xl border border-blue-100 bg-blue-50/60 p-3 shadow-[var(--shadow-card)]">
          {options.specs.map(({ spec }) => (
            <li key={spec.id}>
              <Link
                to="/spec/$specId"
                params={{ specId: String(spec.id) }}
                className="flex flex-col gap-3 rounded-xl border border-blue-100 bg-white/80 p-4 hover:bg-white"
              >
                <span className="flex flex-wrap items-baseline gap-3">
                  <span className="shrink-0 font-mono text-xs text-blue-700">{`Spec ${spec.id}`}</span>
                  <span className="text-ink text-sm font-medium">{spec.title}</span>
                </span>
                {spec.id === options.activeSpecId ? (
                  <SpecProgress
                    technicalSolution={signals.technicalSolution}
                    validation={signals.validation}
                    runs={options.runCount}
                  />
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
}

function SpecProgress({
  technicalSolution,
  validation,
  runs,
}: {
  technicalSolution: number;
  validation: number;
  runs: number;
}) {
  const steps = [
    { label: 'Technical Design', count: technicalSolution, unit: 'node' },
    { label: 'Validation', count: validation, unit: 'node' },
    { label: 'Runs', count: runs, unit: 'run' },
  ] as const;

  return (
    <span className="border-rule bg-tint flex flex-col gap-3 rounded-xl border p-3">
      <span className="grid grid-cols-3 gap-1" aria-hidden="true">
        {steps.map((step) => (
          <span
            key={step.label}
            className={`h-1 rounded-full ${step.count > 0 ? 'bg-emerald-500' : 'bg-wash'}`}
          />
        ))}
      </span>
      <span className="grid gap-2 sm:grid-cols-3">
        {steps.map((step) => (
          <SpecProgressStep key={step.label} {...step} />
        ))}
      </span>
    </span>
  );
}

function SpecProgressStep({ label, count, unit }: { label: string; count: number; unit: string }) {
  const done = count > 0;
  return (
    <span className="flex items-start gap-2">
      <span
        className={
          done
            ? 'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 font-mono text-[10px] text-emerald-700'
            : 'bg-wash text-hint mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full font-mono text-[10px]'
        }
        title={done ? `${label} detected` : `${label} not detected yet`}
      >
        {done ? '✓' : '-'}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-hint font-mono text-[10px] tracking-[0.08em] uppercase">{label}</span>
        <span className="text-ink text-xs font-semibold">
          {done ? `${count} ${unit}${count === 1 ? '' : 's'}` : 'not detected'}
        </span>
      </span>
    </span>
  );
}

function specSignals(overview: GraphSlice | undefined): { technicalSolution: number; validation: number } {
  if (overview === undefined) return { technicalSolution: 0, validation: 0 };
  let technicalSolution = 0;
  let validation = 0;
  for (const node of overview.nodes) {
    if (node.plane === 'design' || isTechnicalDesignKind(node.kind)) {
      technicalSolution += 1;
    }
    if (
      node.kind === 'criterion' ||
      node.kind === 'check' ||
      node.kind === 'vv_method' ||
      node.kind === 'vv_obligation'
    ) {
      validation += 1;
    }
  }
  return { technicalSolution, validation };
}

function isTechnicalDesignKind(kind: GraphSlice['nodes'][number]['kind']): boolean {
  return kind === 'module' || kind === 'interface' || kind === 'entity' || kind === 'sketch';
}
