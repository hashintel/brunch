import { useMutation, useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { Link, createRoute, type ErrorComponentProps } from '@tanstack/react-router';

import {
  executeRunQueryOptions,
  executeReplanAbandonRun,
  executeReplanRecommendationQueryOptions,
  executeReplanRegeneratePlan,
  executeReplanStartNewRun,
  executeRunsQueryOptions,
  type ReplanRecommendation,
  type RunRetryAction,
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

const ANSI_ESCAPE_PATTERN = new RegExp(
  String.raw`[\u001B\u009B][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[a-zA-Z\d]*)*)?\u0007)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))`,
  'gu',
);

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
        <ReplanningPanel run={run} />
        <RequirementsPanel run={run} />
        <StreamPanel
          label="Worker stream"
          emptyText="No worker stream yet."
          events={run.agentStreamTail}
          total={run.agentStreamTotal}
        />
        <StreamPanel
          label="Verify stream"
          emptyText="No verify stream yet."
          events={run.verifyStreamTail}
          total={run.verifyStreamTotal}
        />
        <ReportsTimeline run={run} />
        {run.petriNet === undefined ? null : <PetriRawBlock net={run.petriNet} />}
      </div>
    </PageColumn>
  );
}

function ReplanningPanel({ run }: { run: RunDetail }) {
  const { queryClient, rpcClient } = runDetailRoute.useRouteContext();
  const specId = Number(run.specId);
  const canReadRecommendation = Number.isInteger(specId) && specId > 0;
  const recommendation = useQuery({
    ...executeReplanRecommendationQueryOptions(rpcClient, { runId: run.runId, specId }),
    enabled: canReadRecommendation,
  });
  const actionMutation = useMutation({
    mutationFn: (action: WebReplanAction) => executeWebReplanAction(rpcClient, run, specId, action),
    async onSuccess() {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['execute.runs'] }),
        queryClient.invalidateQueries({ queryKey: ['execute.run', run.runId] }),
      ]);
    },
  });

  return (
    <section aria-label="Replanning" className="flex flex-col gap-2">
      <p className="text-hint text-xxs font-mono">Replanning</p>
      <div className="border-rule flex flex-col gap-3 rounded-xl border bg-white p-4 shadow-[var(--shadow-card)]">
        {!canReadRecommendation ? (
          <p className="text-sub text-sm">This run has an invalid spec id for replanning.</p>
        ) : recommendation.isPending ? (
          <p className="text-sub text-sm">Checking replanning options…</p>
        ) : recommendation.isError ? (
          <p className="text-link text-sm">Unable to load replanning recommendation.</p>
        ) : (
          <ReplanningRecommendationView recommendation={recommendation.data} />
        )}
        <div className="flex flex-wrap gap-2">
          {WEB_REPLAN_ACTIONS.map((action) => {
            const available = recommendation.data?.allowedActions.includes(action.id) ?? false;
            const webCallable = isWebCallableReplanAction(action.id);
            const disabled = !canReadRecommendation || !available || !webCallable || actionMutation.isPending;
            return (
              <button
                key={action.id}
                type="button"
                disabled={disabled}
                onClick={() => {
                  if (isWebCallableReplanAction(action.id)) actionMutation.mutate(action.id);
                }}
                className="border-rule disabled:text-hint disabled:bg-tint text-ink rounded-lg border px-3 py-1.5 text-xs disabled:cursor-not-allowed"
              >
                {action.label}
              </button>
            );
          })}
        </div>
        {recommendation.data?.allowedActions.includes('retry_current_step') ? (
          <p className="text-hint text-xs">
            Retry current step requires executor runtime authority and is available through the Execute tool,
            not web RPC.
          </p>
        ) : null}
        {actionMutation.data === undefined ? null : (
          <p className="text-sub text-sm">Last replanning action: {actionMutation.data.status}</p>
        )}
        {actionMutation.isError ? <p className="text-link text-sm">Replanning action failed.</p> : null}
      </div>
    </section>
  );
}

function ReplanningRecommendationView({ recommendation }: { recommendation: ReplanRecommendation }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-baseline gap-3">
        <span className="text-ink font-mono text-xs">{recommendation.status}</span>
        <span className="text-sub text-xs">
          recommended: {formatReplanAction(recommendation.recommendedAction)}
        </span>
      </div>
      <p className="text-sub text-sm">{recommendation.diagnosis}</p>
      <p className="text-hint text-xs">
        allowed: {recommendation.allowedActions.map(formatReplanAction).join(', ')}
      </p>
    </div>
  );
}

type WebReplanAction = 'regenerate_plan' | 'start_new_run' | 'abandon_run';

const WEB_REPLAN_ACTIONS: readonly { readonly id: RunRetryAction; readonly label: string }[] = [
  { id: 'retry_current_step', label: 'Retry current step' },
  { id: 'regenerate_plan', label: 'Regenerate plan' },
  { id: 'start_new_run', label: 'Start new run' },
  { id: 'abandon_run', label: 'Abandon run' },
];

function isWebCallableReplanAction(action: RunRetryAction): action is WebReplanAction {
  return action === 'regenerate_plan' || action === 'start_new_run' || action === 'abandon_run';
}

function executeWebReplanAction(
  rpcClient: Parameters<typeof executeReplanRegeneratePlan>[0],
  run: RunDetail,
  specId: number,
  action: WebReplanAction,
) {
  switch (action) {
    case 'regenerate_plan':
      return executeReplanRegeneratePlan(rpcClient, { runId: run.runId, specId });
    case 'start_new_run':
      return executeReplanStartNewRun(rpcClient, { previousRunId: run.runId, specId });
    case 'abandon_run':
      return executeReplanAbandonRun(rpcClient, {
        runId: run.runId,
        reason: 'Abandoned from the run observer replanning panel',
      });
  }
}

function formatReplanAction(action: RunRetryAction): string {
  return action.replace(/_/gu, ' ');
}

function RequirementsPanel({ run }: { run: RunDetail }) {
  const linkedSliceIds = new Set(run.sliceProgress.map((slice) => slice.sliceId));
  return (
    <section aria-label="Requirement status" className="flex flex-col gap-2">
      <p className="text-hint text-xxs font-mono">Requirements</p>
      {run.requirements.length === 0 ? (
        <p className="border-rule bg-tint text-sub rounded-xl border p-4 text-sm">
          No requirements projected.
        </p>
      ) : (
        <ol className="border-rule flex flex-col gap-2 rounded-xl border bg-white p-4 shadow-[var(--shadow-card)]">
          {run.requirements.map((requirement) => {
            const sliceLogTarget = requirementSliceLogTarget(requirement, linkedSliceIds);
            return (
              <li key={requirement.requirementId} className="flex flex-col gap-1">
                <div className="flex flex-wrap items-baseline gap-3">
                  <span className="text-ink font-mono text-xs">{requirement.requirementId}</span>
                  <span className="text-sub font-mono text-xs">{requirement.status}</span>
                  {requirement.sliceIds.length === 0 ? null : (
                    <span className="text-hint text-xs">{requirement.sliceIds.join(', ')}</span>
                  )}
                </div>
                <p className="text-sub text-sm">{requirement.content}</p>
                {requirement.criterionIds.length === 0 ? (
                  <p className="text-hint text-xs">no criterion witness</p>
                ) : (
                  <p className="text-hint text-xs">criteria: {requirement.criterionIds.join(', ')}</p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Link
                    to="/spec/$specId"
                    params={{ specId: run.specId }}
                    className="text-link font-mono text-xs"
                  >
                    view in graph
                  </Link>
                  {sliceLogTarget === undefined ? null : (
                    <a href={`#slice-${sliceLogTarget}`} className="text-link font-mono text-xs">
                      view slice log
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function requirementSliceLogTarget(
  requirement: RunDetail['requirements'][number],
  linkedSliceIds: ReadonlySet<string>,
): string | undefined {
  const priority = [
    ...requirement.failedSliceIds,
    ...requirement.missingVerificationSliceIds,
    ...requirement.sliceIds,
  ];
  return priority.find((sliceId) => linkedSliceIds.has(sliceId));
}

interface StreamEventView {
  readonly sliceId: string;
  readonly sequence: number;
  readonly kind: string;
  readonly message: string;
}

function StreamPanel({
  label,
  emptyText,
  events,
  total,
}: {
  label: string;
  emptyText: string;
  events: readonly StreamEventView[];
  total: number;
}) {
  const rows = compactStreamEvents(events);
  const failures = label === 'Verify stream' ? verifyFailures(events) : [];
  return (
    <section aria-label={label} className="flex flex-col gap-2">
      <p className="text-hint text-xxs font-mono">
        {`${label} — showing ${events.length} of ${total} events`}
      </p>
      {events.length === 0 ? (
        <p className="border-rule bg-tint text-sub rounded-xl border p-4 text-sm">{emptyText}</p>
      ) : (
        <div className="border-rule flex flex-col gap-3 rounded-xl border bg-white p-4 shadow-[var(--shadow-card)]">
          {failures.length === 0 ? null : (
            <section aria-label="Verify failures" className="bg-tint border-rule rounded-lg border p-3">
              <p className="text-link mb-2 font-mono text-xs">Verify failures</p>
              <ul className="flex flex-col gap-2">
                {failures.map((failure) => (
                  <li
                    key={`${failure.sliceId}-${failure.sequence}`}
                    className="text-ink font-mono text-xs whitespace-pre-wrap"
                  >
                    {failure.message}
                  </li>
                ))}
              </ul>
            </section>
          )}
          <ol className="flex flex-col gap-2">
            {rows.map((event) => (
              <li key={`${event.sliceId}-${event.sequence}`} className="flex flex-col gap-1">
                <div className="flex flex-wrap items-baseline gap-3">
                  <span className="text-ink font-mono text-xs">{event.kind}</span>
                  <span className="text-sub text-xs">{event.sliceId}</span>
                  <span className="text-hint font-mono text-xs">#{event.sequence}</span>
                  {event.count > 1 ? (
                    <span className="text-hint font-mono text-xs">x{event.count}</span>
                  ) : null}
                </div>
                <p className="text-sub text-sm whitespace-pre-wrap">{event.message}</p>
              </li>
            ))}
          </ol>
          <details>
            <summary className="text-hint cursor-pointer font-mono text-xs">Raw {label} events</summary>
            <pre className="text-sub mt-2 overflow-x-auto font-mono text-xs whitespace-pre-wrap">
              {events.map(
                (event) =>
                  `${JSON.stringify({
                    kind: event.kind,
                    sliceId: event.sliceId,
                    sequence: event.sequence,
                    message: stripAnsi(event.message),
                  })}\n`,
              )}
            </pre>
          </details>
        </div>
      )}
    </section>
  );
}

interface CompactStreamEventView extends StreamEventView {
  readonly count: number;
}

function compactStreamEvents(events: readonly StreamEventView[]): readonly CompactStreamEventView[] {
  const rows: CompactStreamEventView[] = [];
  for (const event of events) {
    const message = cleanStreamMessage(event.message);
    const previous = rows.at(-1);
    if (previous && previous.sliceId === event.sliceId && previous.kind === event.kind) {
      if (message === previous.message) {
        rows[rows.length - 1] = { ...previous, count: previous.count + 1 };
        continue;
      }
      if (message.startsWith(previous.message)) {
        rows[rows.length - 1] = { ...event, message, count: 1 };
        continue;
      }
    }
    rows.push({ ...event, message, count: 1 });
  }
  return rows;
}

function verifyFailures(events: readonly StreamEventView[]): readonly StreamEventView[] {
  return events
    .filter((event) => event.kind === 'stderr' || /\b(?:FAIL|Failed Tests|Error:)\b/u.test(event.message))
    .map((event) => ({ ...event, message: cleanStreamMessage(event.message).trim() }))
    .filter((event) => event.message.length > 0);
}

function cleanStreamMessage(value: string): string {
  return stripMarkdownMarkers(stripAnsi(value));
}

function stripAnsi(value: string): string {
  return value.replace(ANSI_ESCAPE_PATTERN, '');
}

function stripMarkdownMarkers(value: string): string {
  return value
    .replace(/\*\*([^*]+)\*\*/gu, '$1')
    .replace(/__([^_]+)__/gu, '$1')
    .replace(/`([^`]+)`/gu, '$1')
    .replace(/^#{1,6}\s+/gmu, '')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/gu, '$1');
}

function PetriRawBlock({ net }: { net: unknown }) {
  return (
    <details className="border-rule rounded-xl border bg-white p-4 shadow-[var(--shadow-card)]">
      <summary className="text-hint cursor-pointer font-mono text-xs">Petri net (raw)</summary>
      <pre className="text-sub mt-2 overflow-x-auto text-xs">{JSON.stringify(net, null, 2)}</pre>
    </details>
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
  const hasEvents = run.reportsTail.length > 0 || run.sliceProgress.length > 0;
  return (
    <section aria-label="Run events" className="flex flex-col gap-2">
      <p className="text-hint text-xxs font-mono">
        {`Events — showing ${run.reportsTail.length} of ${run.reportsTotal} events`}
      </p>
      {!hasEvents ? (
        <p className="border-rule bg-tint text-sub rounded-xl border p-4 text-sm">No events yet.</p>
      ) : (
        <div className="border-rule flex flex-col gap-3 rounded-xl border bg-white p-4 shadow-[var(--shadow-card)]">
          <ol className="flex flex-col gap-2">
            {run.sliceProgress.map((slice) => (
              <li id={`slice-${slice.sliceId}`} key={slice.sliceId} className="flex flex-col gap-1">
                <div className="flex flex-wrap items-baseline gap-3">
                  <span className="text-ink font-mono text-xs">{slice.sliceId}</span>
                  <span className="text-sub text-xs">{slice.progress}</span>
                </div>
              </li>
            ))}
          </ol>
          <details>
            <summary className="text-hint cursor-pointer font-mono text-xs">Raw events</summary>
            <ol className="mt-2 flex flex-col gap-1">
              {run.reportsTail.map((event, index) => (
                <li key={index} className="flex flex-wrap items-baseline gap-3">
                  <span className="text-ink font-mono text-xs">{event.event}</span>
                  {typeof event['sliceId'] === 'string' ? (
                    <span className="text-sub text-xs">#{event['sliceId']}</span>
                  ) : null}
                </li>
              ))}
            </ol>
          </details>
        </div>
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
