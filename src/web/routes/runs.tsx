import { useSuspenseQuery } from '@tanstack/react-query';
import { Link, createRoute, type ErrorComponentProps } from '@tanstack/react-router';
import { useState } from 'react';

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
      <nav aria-label="Executor runs" className="flex flex-col gap-4">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-hint text-xxs font-mono">Runs</p>
            <h1 className="text-ink mt-1 text-base font-semibold tracking-[-0.01em]">Executor Runs</h1>
          </div>
          <span className="border-rule bg-tint text-sub rounded-lg border px-2.5 py-1 font-mono text-xs">
            {data.runs.length} {data.runs.length === 1 ? 'run' : 'runs'}
          </span>
        </header>
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
  const indicator = RUNNING_INDICATORS[run.status];
  return (
    <Link
      to="/runs/$runId"
      params={{ runId: run.runId }}
      className="border-rule hover:bg-tint flex flex-col gap-3 rounded-xl border bg-white p-4 shadow-[var(--shadow-card)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-ink shrink-0 font-mono text-sm font-semibold">{run.runId}</span>
        <RunStatusPill status={run.status} />
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-hint font-mono text-xs">spec {run.specId}</span>
        {run.activeSliceId === undefined ? null : (
          <span className="text-sub text-xs">active {run.activeSliceId}</span>
        )}
        {run.completedSliceIds === undefined || run.completedSliceIds.length === 0 ? null : (
          <span className="text-sub text-xs">{run.completedSliceIds.length} completed</span>
        )}
        {indicator === undefined ? null : <span className="text-link text-xs">{indicator}</span>}
      </div>
      <div className="border-rule flex flex-wrap items-center justify-between gap-2 border-t pt-2">
        <PresenceFlags runId={run.runId} presence={run.presence} />
      </div>
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

  const detail = normalizeRunDetail(run);
  const indicator = RUNNING_INDICATORS[detail.status];
  return (
    <PageColumn>
      <div className="flex flex-col gap-5">
        <header className="border-rule flex flex-col gap-3 rounded-2xl border bg-white p-5 shadow-[var(--shadow-card)]">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-ink font-mono text-base font-semibold">{detail.runId}</h1>
            <RunStatusPill status={detail.status} />
          </div>
          {indicator === undefined ? null : <span className="text-sub text-xs">{indicator}</span>}
          <div className="flex flex-wrap gap-2">
            <SmallFact label="spec" value={detail.specId} />
            {detail.activeSliceId === undefined ? null : (
              <SmallFact label="active" value={detail.activeSliceId} />
            )}
            {detail.completedSliceIds === undefined || detail.completedSliceIds.length === 0 ? null : (
              <SmallFact label="completed" value={String(detail.completedSliceIds.length)} />
            )}
          </div>
        </header>
        <dl className="border-rule bg-tint flex flex-col gap-1 rounded-xl border p-4 text-sm">
          <DetailRow label="spec">{detail.specId}</DetailRow>
          <DetailRow label="plan">{detail.planPath}</DetailRow>
          {detail.activeSliceId === undefined ? null : (
            <DetailRow label="active slice">{detail.activeSliceId}</DetailRow>
          )}
          {detail.completedSliceIds === undefined || detail.completedSliceIds.length === 0 ? null : (
            <DetailRow label="completed slices">{detail.completedSliceIds.join(', ')}</DetailRow>
          )}
          <DetailRow label="artifacts">
            <PresenceFlags runId={detail.runId} presence={detail.presence} />
          </DetailRow>
        </dl>
        <RequirementsPanel run={detail} />
        <StreamPanel
          label="Worker stream"
          emptyText="No worker stream yet."
          events={detail.agentStreamTail}
          total={detail.agentStreamTotal}
        />
        <StreamPanel
          label="Verify stream"
          emptyText="No verify stream yet."
          events={detail.verifyStreamTail}
          total={detail.verifyStreamTotal}
        />
        <ReportsTimeline run={detail} />
        {detail.petriProjection === undefined &&
        (detail.petriReadySteps?.length ?? 0) === 0 &&
        (detail.petriBlockedSteps?.length ?? 0) === 0 ? null : (
          <PetriProjectionBlock
            projection={detail.petriProjection}
            readySteps={detail.petriReadySteps}
            blockedSteps={detail.petriBlockedSteps}
            source={detail.petriProjectionSource}
            replayReason={detail.petriProjectionReplayReason}
          />
        )}
        {detail.petrinautReplayExport === undefined ? null : (
          <PetrinautReplayExportBlock
            streamPath={
              detail.petrinautStreamPath ?? `/petrinaut/stream?runId=${encodeURIComponent(detail.runId)}`
            }
            launchPath={detail.petrinautLaunchPath}
            replayExport={detail.petrinautReplayExport}
          />
        )}
        {detail.petriNet === undefined ? null : <PetriRawBlock net={detail.petriNet} />}
      </div>
    </PageColumn>
  );
}

function normalizeRunDetail(run: RunDetail): RunDetail {
  return {
    ...run,
    reportsTail: run.reportsTail ?? [],
    reportsTotal: run.reportsTotal ?? 0,
    petriEventsTail: run.petriEventsTail ?? [],
    petriEventsTotal: run.petriEventsTotal ?? 0,
    petriReadySteps: run.petriReadySteps ?? [],
    petriBlockedSteps: run.petriBlockedSteps ?? [],
    agentStreamTail: run.agentStreamTail ?? [],
    agentStreamTotal: run.agentStreamTotal ?? 0,
    verifyStreamTail: run.verifyStreamTail ?? [],
    verifyStreamTotal: run.verifyStreamTotal ?? 0,
    sliceProgress: run.sliceProgress ?? [],
    requirements: run.requirements ?? [],
  };
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
        <details open className="border-rule rounded-xl border bg-white p-4 shadow-[var(--shadow-card)]">
          <summary className="text-sub hover:text-ink cursor-pointer text-sm font-medium">
            {`${label}: show ${rows.length} compacted log rows`}
            {failures.length === 0 ? null : (
              <span className="text-link ml-2 font-mono text-xs">{failures.length} failure lines</span>
            )}
          </summary>
          <div className="mt-3 flex flex-col gap-3">
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
          </div>
          <details className="mt-3">
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
        </details>
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

function PetrinautReplayExportBlock({
  streamPath,
  launchPath,
  replayExport,
}: {
  streamPath: string;
  launchPath: string | undefined;
  replayExport: NonNullable<RunDetail['petrinautReplayExport']>;
}) {
  const markedPlaces = Object.keys(replayExport.initialState).length;
  return (
    <section className="border-rule flex flex-col gap-2 rounded-xl border bg-white p-4 shadow-[var(--shadow-card)]">
      <p className="text-hint font-mono text-xs">Petrinaut replay export</p>
      <p className="text-sub text-xs">
        {`${replayExport.definition.places.length} places • ${replayExport.definition.transitions.length} transitions • ${replayExport.transitionFirings.length} firings`}
      </p>
      <p className="text-sub text-xs">{`${markedPlaces} initially marked places`}</p>
      <a className="text-link font-mono text-xs" href={streamPath}>
        SSE replay endpoint
      </a>
      {launchPath === undefined ? null : (
        <a className="text-link font-mono text-xs" href={launchPath}>
          Open in Petrinaut
        </a>
      )}
    </section>
  );
}

function PetriProjectionBlock({
  projection,
  readySteps,
  blockedSteps,
  source,
  replayReason,
}: {
  projection?: RunDetail['petriProjection'];
  readySteps?: RunDetail['petriReadySteps'];
  blockedSteps?: RunDetail['petriBlockedSteps'];
  source?: RunDetail['petriProjectionSource'];
  replayReason?: RunDetail['petriProjectionReplayReason'];
}) {
  return (
    <section className="border-rule flex flex-col gap-2 rounded-xl border bg-white p-4 shadow-[var(--shadow-card)]">
      <p className="text-hint font-mono text-xs">
        {projection === undefined ? 'Petri frontier (derived)' : 'Petri projection (derived)'}
      </p>
      {projection === undefined ? null : (
        <p className="text-sub text-xs">
          {`${projection.firedTransitionCount} fired transitions`}
          {source === undefined ? '' : ` • source: ${source}`}
        </p>
      )}
      {projection?.claimedTransitionIds === undefined ||
      projection.claimedTransitionIds.length === 0 ? null : (
        <p className="text-sub text-xs">{`claimed: ${projection.claimedTransitionIds.join(', ')}`}</p>
      )}
      {replayReason !== 'snapshot_missing_or_unreadable' ? null : (
        <p className="text-sub text-xs">
          replay chosen because no readable persisted marking snapshot was available
        </p>
      )}
      {replayReason !== 'snapshot_stale' ? null : (
        <p className="text-sub text-xs">
          replay chosen because the persisted marking snapshot no longer matches current lifecycle facts
        </p>
      )}
      {projection?.terminalEventKind === undefined ? null : (
        <p className="text-sub text-xs">
          {projection.terminalEventKind}
          {projection.haltedReason === undefined ? '' : ` — ${projection.haltedReason}`}
        </p>
      )}
      {readySteps === undefined || readySteps.length === 0 ? null : (
        <div className="flex flex-col gap-1">
          <p className="text-sub text-xs">Ready now</p>
          <ul className="text-sub flex flex-col gap-1 font-mono text-xs">
            {readySteps.map((step, index) => (
              <li key={`${step.kind}-${'sliceId' in step ? step.sliceId : index}`}>
                {describeReadyStep(step)}
              </li>
            ))}
          </ul>
        </div>
      )}
      {blockedSteps === undefined || blockedSteps.length === 0 ? null : (
        <div className="flex flex-col gap-1">
          <p className="text-sub text-xs">Blocked now</p>
          <ul className="text-sub flex flex-col gap-1 font-mono text-xs">
            {blockedSteps.map((step) => (
              <li
                key={`${step.kind}-${step.kind === 'slice_start' ? step.sliceId : step.kind === 'epic_verify' ? step.epicId : 'run'}`}
              >
                {describeBlockedStep(step)}
              </li>
            ))}
          </ul>
        </div>
      )}
      {projection === undefined ? null : (
        <pre className="text-sub overflow-x-auto text-xs">
          {JSON.stringify(projection.currentMarking, null, 2)}
        </pre>
      )}
    </section>
  );
}

function describeReadyStep(step: NonNullable<RunDetail['petriReadySteps']>[number]): string {
  if (!('sliceId' in step)) return step.kind;
  return `${step.kind}:${step.sliceId}${step.epicId === undefined ? '' : ` (${step.epicId})`}${step.derivedFrom === undefined ? '' : ` ← ${step.derivedFrom.join(', ')}`}`;
}

function describeBlockedStep(step: NonNullable<RunDetail['petriBlockedSteps']>[number]): string {
  const subject = step.kind === 'authority_unreadable' ? step.kind : describeReadyStep(step);
  return `${subject} blocked by ${step.blockers
    .map((blocker) =>
      blocker.kind === 'dependency'
        ? blocker.sliceId
        : blocker.kind === 'epic_dependency'
          ? `epic ${blocker.epicId}`
          : blocker.kind === 'parallel_authority'
            ? `parallel ${blocker.state}`
            : blocker.kind === 'epic_verification_authority'
              ? `epic verification ${blocker.phase}`
              : blocker.kind === 'parallel_authority_unreadable'
                ? 'parallel authority unreadable'
                : `active slice ${blocker.sliceId}`,
    )
    .join(', ')}`;
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline gap-3">
      <dt className="text-hint w-28 shrink-0 font-mono text-xs">{label}</dt>
      <dd className="text-ink min-w-0 text-sm">{children}</dd>
    </div>
  );
}

function RunStatusPill({ status }: { status: RunSummary['status'] }) {
  const className = runStatusClassName(status);
  return (
    <span className={`rounded-full px-2.5 py-1 font-mono text-xs font-medium ${className}`}>{status}</span>
  );
}

function runStatusClassName(status: RunSummary['status']): string {
  if (status === 'slice_execution_requested') return 'bg-blue-50 text-blue-700';
  if (status === 'agent_result_ingested') return 'bg-violet-50 text-violet-700';
  if (status === 'abandoned') return 'bg-red-50 text-red-700';
  if (status === 'run_completed' || status === 'promotion_prepared' || status === 'landed')
    return 'bg-emerald-50 text-emerald-700';
  if (status === 'test_result_ingested' || status === 'slice_completed') return 'bg-amber-50 text-amber-700';
  return 'bg-wash text-sub';
}

function SmallFact({ label, value }: { label: string; value: string }) {
  return (
    <span className="border-rule bg-tint inline-flex items-baseline gap-1 rounded-lg border px-2 py-1">
      <span className="text-hint font-mono text-[10px]">{label}</span>
      <span className="text-ink font-mono text-xs">{value}</span>
    </span>
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

function PresenceFlags({ runId, presence }: { runId: string; presence: RunSummary['presence'] }) {
  const [copyMessage, setCopyMessage] = useState<string | undefined>();

  async function copyArtifactPath(artifact: RunArtifact, event: React.MouseEvent | React.KeyboardEvent) {
    event.preventDefault();
    event.stopPropagation();
    const path = artifactPath(runId, artifact.id);
    try {
      await navigator.clipboard.writeText(path);
      setCopyMessage(`copied ${artifact.label} path`);
    } catch {
      setCopyMessage('copy unavailable');
    }
  }

  return (
    <span className="flex min-w-0 flex-wrap items-center gap-1.5" aria-label="Run artifacts">
      <span className="text-hint mr-0.5 font-mono text-[10px] tracking-[0.08em] uppercase">Artifacts</span>
      {RUN_ARTIFACTS.map((artifact) => {
        const present = presence[artifact.id];
        const path = artifactPath(runId, artifact.id);
        return (
          <span
            key={artifact.id}
            role="button"
            tabIndex={0}
            title={`${artifact.description}. Click to copy ${path}`}
            onClick={(event) => void copyArtifactPath(artifact, event)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') void copyArtifactPath(artifact, event);
            }}
            className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs ${
              present ? 'border-rule text-ink bg-white' : 'border-rule bg-tint text-hint'
            } cursor-pointer`}
          >
            <span aria-hidden="true" className="font-mono text-[10px]">
              {artifact.icon}
            </span>
            <span className={present ? '' : 'line-through'}>{artifact.label}</span>
            <span className="sr-only">{artifact.id}</span>
          </span>
        );
      })}
      {copyMessage === undefined ? null : (
        <span className="text-link ml-1 font-mono text-[10px]" role="status">
          {copyMessage}
        </span>
      )}
    </span>
  );
}

type RunArtifact = (typeof RUN_ARTIFACTS)[number];

const RUN_ARTIFACTS = [
  {
    id: 'worktree',
    icon: 'W',
    label: 'workspace',
    description: 'Run working directory exists',
  },
  {
    id: 'reports',
    icon: 'E',
    label: 'events',
    description: 'Lifecycle reports.jsonl exists',
  },
  {
    id: 'petri',
    icon: 'F',
    label: 'flow',
    description: 'Petrinaut/Petri flow artifact exists',
  },
  {
    id: 'promotion',
    icon: 'P',
    label: 'promotion',
    description: 'Promotion artifact exists',
  },
] as const satisfies readonly {
  readonly id: keyof RunSummary['presence'];
  readonly icon: string;
  readonly label: string;
  readonly description: string;
}[];

function artifactPath(runId: string, artifact: keyof RunSummary['presence']): string {
  const runRoot = `.brunch/cook/runs/${runId}`;
  switch (artifact) {
    case 'worktree':
      return `${runRoot}/worktree`;
    case 'reports':
      return `${runRoot}/reports.jsonl`;
    case 'petri':
      return `${runRoot}/petrinaut/net.json`;
    case 'promotion':
      return `${runRoot}/promotion/promotion.json`;
  }
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
