import { useSuspenseQuery } from '@tanstack/react-query';
import { Link, createRoute, type ErrorComponentProps } from '@tanstack/react-router';

import {
  executeRunQueryOptions,
  executeRunsQueryOptions,
  type RunDetail,
  type RunListEntry,
  type RunSummary,
  type UnreadableRun,
} from '../queries/execute.js';
import { rootRoute } from './root.js';

/**
 * Long crank states with no reports.jsonl events while a subprocess grinds.
 * The indicator is honest presence-of-work copy, never invented progress.
 */
const RUNNING_INDICATORS: Readonly<Partial<Record<RunSummary['status'], string>>> = {
  slice_execution_requested: 'agent running…',
  agent_result_ingested: 'verify running…',
};

export const runsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/runs',
  loader: ({ context }) => context.queryClient.ensureQueryData(executeRunsQueryOptions(context.rpcClient)),
  component: RunsPage,
});

export const runDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/runs/$runId',
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(executeRunQueryOptions(context.rpcClient, params.runId)),
  component: RunDetailPage,
  errorComponent: RunLoadErrorPage,
});

function isUnreadable(entry: RunListEntry | RunDetail | UnreadableRun): entry is UnreadableRun {
  return 'unreadable' in entry;
}

function RunsPage() {
  const { rpcClient } = runsRoute.useRouteContext();
  const { data } = useSuspenseQuery(executeRunsQueryOptions(rpcClient));

  return (
    <PageColumn>
      <nav aria-label="Executor runs" className="flex flex-col gap-3">
        <p className="text-hint text-xxs font-mono">Runs</p>
        {data.runs.length === 0 ? (
          <p className="border-rule bg-tint text-sub rounded-xl border p-6 text-sm">No executor runs.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {data.runs.map((entry) => (
              <li key={entry.runId}>
                {isUnreadable(entry) ? (
                  <UnreadableRunCard runId={entry.runId} />
                ) : (
                  <RunSummaryLink run={entry} />
                )}
              </li>
            ))}
          </ul>
        )}
      </nav>
    </PageColumn>
  );
}

function RunSummaryLink({ run }: { run: RunSummary }) {
  return (
    <Link
      to="/runs/$runId"
      params={{ runId: run.runId }}
      className="border-rule hover:bg-tint flex flex-wrap items-baseline gap-3 rounded-xl border bg-white p-3 shadow-[var(--shadow-card)]"
    >
      <span className="text-hint shrink-0 font-mono text-xs">{run.runId}</span>
      <span className="text-ink text-sm">{run.status}</span>
      {RUNNING_INDICATORS[run.status] === undefined ? null : (
        <span className="text-sub text-xs">{RUNNING_INDICATORS[run.status]}</span>
      )}
      <PresenceFlags presence={run.presence} />
    </Link>
  );
}

function UnreadableRunCard({ runId }: { runId: string }) {
  return (
    <p className="border-rule bg-tint text-sub rounded-xl border p-3 text-sm">
      <span className="text-hint mr-3 font-mono text-xs">{runId}</span>
      unreadable run metadata
    </p>
  );
}

function RunDetailPage() {
  const { runId } = runDetailRoute.useParams();
  const { rpcClient } = runDetailRoute.useRouteContext();
  const { data: run } = useSuspenseQuery(executeRunQueryOptions(rpcClient, runId));

  if (isUnreadable(run)) {
    return (
      <PageColumn>
        <UnreadableRunCard runId={run.runId} />
      </PageColumn>
    );
  }

  const indicator = RUNNING_INDICATORS[run.status];
  return (
    <PageColumn>
      <div className="flex flex-col gap-4">
        <header className="flex flex-wrap items-baseline gap-3">
          <h1 className="text-hint font-mono text-xs">{run.runId}</h1>
          <span className="text-ink text-sm">{run.status}</span>
          {indicator === undefined ? null : <span className="text-sub text-xs">{indicator}</span>}
        </header>
        <dl className="border-rule flex flex-col gap-1 rounded-xl border bg-white p-4 text-sm shadow-[var(--shadow-card)]">
          <DetailRow label="spec">{run.specId}</DetailRow>
          <DetailRow label="plan">{run.planPath}</DetailRow>
          {run.activeSliceId === undefined ? null : (
            <DetailRow label="active slice">{run.activeSliceId}</DetailRow>
          )}
          {run.completedSliceIds === undefined || run.completedSliceIds.length === 0 ? null : (
            <DetailRow label="completed slices">{run.completedSliceIds.join(', ')}</DetailRow>
          )}
          <DetailRow label="artifacts">
            <PresenceFlags presence={run.presence} />
          </DetailRow>
        </dl>
        <ReportsTimeline run={run} />
      </div>
    </PageColumn>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline gap-3">
      <dt className="text-hint w-28 shrink-0 font-mono text-xs">{label}</dt>
      <dd className="text-ink min-w-0 text-sm">{children}</dd>
    </div>
  );
}

function ReportsTimeline({ run }: { run: RunDetail }) {
  return (
    <section aria-label="Run events" className="flex flex-col gap-2">
      <p className="text-hint text-xxs font-mono">
        {`Events — showing ${run.reportsTail.length} of ${run.reportsTotal} events`}
      </p>
      {run.reportsTail.length === 0 ? (
        <p className="border-rule bg-tint text-sub rounded-xl border p-4 text-sm">No events yet.</p>
      ) : (
        <ol className="border-rule flex flex-col gap-1 rounded-xl border bg-white p-4 shadow-[var(--shadow-card)]">
          {run.reportsTail.map((event, index) => (
            <li key={index} className="flex flex-wrap items-baseline gap-3">
              <span className="text-ink font-mono text-xs">{event.event}</span>
              {typeof event['sliceId'] === 'string' ? (
                <span className="text-sub text-xs">{event['sliceId']}</span>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function PresenceFlags({ presence }: { presence: RunSummary['presence'] }) {
  return (
    <span className="flex flex-wrap gap-2">
      {(['worktree', 'reports', 'petri', 'promotion'] as const).map((artifact) => (
        <span
          key={artifact}
          className={
            presence[artifact] ? 'text-ink font-mono text-xs' : 'text-hint font-mono text-xs line-through'
          }
        >
          {artifact}
        </span>
      ))}
    </span>
  );
}

function RunLoadErrorPage(props: ErrorComponentProps) {
  return (
    <PageColumn>
      <p className="border-rule text-link rounded-xl border bg-white p-4 text-sm shadow-[var(--shadow-card)]">
        This run could not be loaded. {props.error.message}
      </p>
    </PageColumn>
  );
}

function PageColumn({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-6 pt-8 pb-10">{children}</div>
    </div>
  );
}
