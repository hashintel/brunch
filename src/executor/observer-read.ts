import { access, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { BRUNCH_DIR } from '../constants.js';
import { agentStreamPath } from './agent-result.js';
import type { AgentStreamEvent, VerifyStreamEvent } from './isolated-slice-operations.js';
import type { BlockedStep, ExecutorNetEvent, ReadyStep, SchedulerPlan } from './orchestrate-topology.js';
import { petriEventsPath, readPetriJournal } from './petri-events.js';
import { inspectPetriJournalAuthority } from './petri-journal-authority.js';
import {
  petriMarkingSnapshotMatchesRunMetadata,
  readPetriMarkingSnapshot,
  type EpicVerificationClaim,
  type ParallelSliceBatchSnapshot,
} from './petri-marking.js';
import { canProjectPetriReplay } from './petri-replay-eligibility.js';
import { replayPetri, type PetriProjection } from './petri-replay.js';
import { readPetriRuntimePlan } from './petri-runtime-plan.js';
import {
  materializeExecutorPetriRuntime,
  projectExecutorPetriTransitionHistory,
  type ExecutorPetriRuntime,
} from './petri-runtime.js';
import { resolvePetrinautUrl } from './petrinaut/launcher-url.js';
import { reducePetrinautReplayExport, type PetrinautReplayExport } from './petrinaut/replay-export.js';
import { parseSdcpnFile, type SdcpnFile } from './petrinaut/sdcpn.js';
import { readRunMetadata, runDirPath, runMetadataPath, type RunMetadata } from './run.js';
import { runStreamEventsPath } from './slice-stream-events.js';
import { verifyStreamPath } from './test-result.js';

export interface RunPresence {
  readonly worktree: boolean;
  readonly reports: boolean;
  readonly petri: boolean;
  readonly promotion: boolean;
}

export interface RunSummary {
  readonly runId: string;
  readonly specId: string;
  readonly status: RunMetadata['status'];
  readonly activeSliceId?: string;
  readonly completedSliceIds?: readonly string[];
  readonly supersedesRunId?: string;
  readonly abandonedAt?: string;
  readonly abandonReason?: string;
  readonly presence: RunPresence;
}

export interface UnreadableRun {
  readonly runId: string;
  readonly unreadable: true;
}

export type RunListEntry = RunSummary | UnreadableRun;

export interface RunReportEvent {
  readonly event: string;
  readonly [key: string]: unknown;
}

export type RunRequirementStatusKind =
  | 'unmapped'
  | 'pending'
  | 'running'
  | 'failed'
  | 'missing_verification'
  | 'unverified'
  | 'passed';

export interface RunRequirementStatus {
  readonly requirementId: string;
  readonly content: string;
  readonly status: RunRequirementStatusKind;
  readonly sliceIds: readonly string[];
  readonly completedSliceIds: readonly string[];
  readonly failedSliceIds: readonly string[];
  readonly missingVerificationSliceIds: readonly string[];
  readonly criterionIds: readonly string[];
}

export interface RunSliceProgress {
  readonly sliceId: string;
  readonly progress: string;
}

export interface RunSliceStreamInventory {
  readonly sliceId: string;
  readonly state: 'claimed' | 'running' | 'succeeded_unintegrated' | 'failed' | 'integrated';
  readonly agentAttempts: readonly number[];
  readonly verifyAttempts: readonly number[];
}

export type PetriProjectionSource = 'snapshot' | 'replay';
export type PetriProjectionReplayReason = 'snapshot_missing_or_unreadable' | 'snapshot_stale';

export interface RunDetail extends RunSummary {
  readonly planPath: string;
  readonly reportsTail: readonly RunReportEvent[];
  readonly reportsTotal: number;
  readonly petriEventsTail: readonly ExecutorNetEvent[];
  readonly petriEventsTotal: number;
  readonly petriReadySteps?: readonly ReadyStep[];
  readonly petriBlockedSteps?: readonly BlockedStep[];
  readonly petriProjection?: PetriProjection;
  readonly petriProjectionSource?: PetriProjectionSource;
  readonly petriProjectionReplayReason?: PetriProjectionReplayReason;
  readonly petriParallelSliceBatch?: ParallelSliceBatchSnapshot;
  readonly agentStreamTail: readonly AgentStreamEvent[];
  readonly agentStreamTotal: number;
  readonly verifyStreamTail: readonly VerifyStreamEvent[];
  readonly verifyStreamTotal: number;
  readonly sliceStreamInventory: readonly RunSliceStreamInventory[];
  readonly sliceProgress: readonly RunSliceProgress[];
  readonly requirements: readonly RunRequirementStatus[];
  /** Raw parsed petrinaut/net.json — deliberately unshaped (frontier: raw view only). */
  readonly petriNet?: unknown;
  /** Derived Petrinaut replay payload from net.sdcpn.json + the complete Petri event journal. */
  readonly petrinautReplayExport?: PetrinautReplayExport;
  /** Relative replay-backed SSE endpoint; active same-process runs continue through terminal state. */
  readonly petrinautStreamPath?: string;
  /** Relative Brunch endpoint that redirects to the configured Petrinaut launcher URL. */
  readonly petrinautLaunchPath?: string;
}

export interface RunTraceEntry {
  readonly nodeCode: string;
  readonly runId: string;
  readonly specId: string;
  readonly runStatus: RunMetadata['status'];
  readonly sliceIds: readonly string[];
  readonly failedSliceIds: readonly string[];
  readonly completedSliceIds: readonly string[];
}

export interface RunTraceIndex {
  readonly traces: readonly RunTraceEntry[];
}

export const DEFAULT_REPORTS_TAIL_LIMIT = 50;
export const DEFAULT_PETRI_EVENTS_TAIL_LIMIT = 50;
export const DEFAULT_AGENT_STREAM_TAIL_LIMIT = 50;
export const DEFAULT_VERIFY_STREAM_TAIL_LIMIT = 50;

function runsRootPath(cwd: string): string {
  return join(cwd, BRUNCH_DIR, 'cook', 'runs');
}

export async function listRuns(cwd: string): Promise<readonly RunListEntry[]> {
  let entries;
  try {
    entries = await readdir(runsRootPath(cwd), { withFileTypes: true });
  } catch {
    return [];
  }
  const runIds = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  return Promise.all(
    runIds.map(async (runId) => {
      let metadataPath: string;
      try {
        metadataPath = runMetadataPath(cwd, runId);
      } catch {
        return { runId, unreadable: true as const };
      }
      const metadata = await readRunMetadata(metadataPath);
      if (metadata === undefined) {
        return { runId, unreadable: true as const };
      }
      return summarizeRun(cwd, runId, metadata);
    }),
  );
}

export async function readRunDetail(
  cwd: string,
  runId: string,
  options?: {
    readonly reportsTailLimit?: number;
    readonly agentStreamTailLimit?: number;
    readonly verifyStreamTailLimit?: number;
    readonly petrinautEnv?: { readonly PETRINAUT_URL?: string };
  },
): Promise<RunDetail | UnreadableRun | undefined> {
  const runDir = runDirPath(cwd, runId);
  if (!(await pathExists(runDir))) {
    return undefined;
  }
  const metadata = await readRunMetadata(runMetadataPath(cwd, runId));
  if (metadata === undefined) {
    return { runId, unreadable: true };
  }
  const summary = await summarizeRun(cwd, runId, metadata);
  const limit = options?.reportsTailLimit ?? DEFAULT_REPORTS_TAIL_LIMIT;
  const petriEventsLimit = DEFAULT_PETRI_EVENTS_TAIL_LIMIT;
  const agentStreamLimit = options?.agentStreamTailLimit ?? DEFAULT_AGENT_STREAM_TAIL_LIMIT;
  const verifyStreamLimit = options?.verifyStreamTailLimit ?? DEFAULT_VERIFY_STREAM_TAIL_LIMIT;
  const reports = await readReportsTail(reportsFilePath(cwd, runId, metadata), limit);
  const petriEvents = await readPetriEvents(petriEventsPath(cwd, runId), petriEventsLimit);
  const petriRuntimePlan = await readPetriRuntimePlan(cwd, metadata);
  let petriRuntime: ReturnType<typeof materializeExecutorPetriRuntime> | undefined;
  try {
    petriRuntime =
      petriRuntimePlan === undefined
        ? undefined
        : materializeExecutorPetriRuntime(metadata, petriRuntimePlan);
  } catch {
    petriRuntime = undefined;
  }
  const petriNet = await readPetriNet(petriFilePath(cwd, runId, metadata));
  const petriSdcpnFile = await readPetriSdcpnFile(petriSdcpnFilePath(cwd, runId));
  const petriReplayProjection = canProjectPetriReplay({ petriNet, petriEvents })
    ? replayPetri({ net: petriNet, events: petriEvents.events })
    : undefined;
  const petrinautReplayExport =
    petriSdcpnFile !== undefined && petriEvents.exists && !petriEvents.torn
      ? readPetrinautReplayExport(petriSdcpnFile, petriEvents.events)
      : undefined;
  const petrinautStreamPath = petrinautStreamPathForRun(runId);
  const petrinautLaunchAvailable =
    petrinautReplayExport === undefined ? false : canLaunchPetrinaut(options?.petrinautEnv ?? process.env);
  const petriMarkingSnapshot = await readPetriMarkingSnapshot({ cwd, runId });
  const hasMatchingPetriMarkingSnapshot =
    petriMarkingSnapshot !== undefined &&
    petriMarkingSnapshotMatchesRunMetadata(petriMarkingSnapshot, metadata) &&
    petriMarkingSnapshotMatchesRuntime(
      petriMarkingSnapshot,
      metadata,
      petriRuntimePlan,
      petriRuntime,
      petriReplayProjection,
    );
  const lifecycleTransitionIds = projectExecutorPetriTransitionHistory(
    metadata,
    petriRuntimePlan,
  )?.transitionIds;
  const journalAuthority = await inspectPetriJournalAuthority({
    cwd,
    runId,
    lifecycleTransitionIds,
    plan: petriRuntimePlan,
  });
  const journalClaimedSliceIds =
    journalAuthority.status === 'readable' ? journalAuthority.sliceStartClaimIds : [];
  const parallelAuthorityUnreadable =
    metadata.status !== 'abandoned' &&
    metadata.status !== 'promotion_prepared' &&
    (journalAuthority.status === 'unreadable' ||
      (journalAuthority.status === 'missing' && metadata.petriObservationPrepared === true) ||
      (journalClaimedSliceIds.length > 0 && !hasMatchingPetriMarkingSnapshot));
  const unreadableAuthoritySliceIds = parallelAuthorityUnreadable
    ? journalClaimedSliceIds.filter((sliceId) => !metadata.completedSliceIds?.includes(sliceId))
    : [];
  const petriProjectionEntry =
    (hasMatchingPetriMarkingSnapshot
      ? {
          projection: toPetriProjection(petriMarkingSnapshot, metadata, petriRuntime, petriReplayProjection),
          source: 'snapshot' as const,
        }
      : undefined) ??
    (petriReplayProjection
      ? toProjectionEntry(petriReplayProjection, 'replay', {
          replayReason:
            petriMarkingSnapshot === undefined ? 'snapshot_missing_or_unreadable' : 'snapshot_stale',
        })
      : undefined);
  const journalEpicVerificationClaims = petriEvents.readable
    ? projectJournalEpicVerificationClaims(petriEvents.events, metadata.completedEpicIds ?? [])
    : [];
  const epicVerificationClaims = mergeEpicVerificationClaims(
    hasMatchingPetriMarkingSnapshot ? petriMarkingSnapshot.epicVerificationClaims : undefined,
    journalEpicVerificationClaims,
  );
  let observedPetriRuntime = parallelAuthorityUnreadable ? undefined : petriRuntime;
  if (
    observedPetriRuntime &&
    ((hasMatchingPetriMarkingSnapshot && petriMarkingSnapshot.parallelSliceBatch) ||
      epicVerificationClaims.length > 0)
  ) {
    try {
      observedPetriRuntime = materializeExecutorPetriRuntime(metadata, petriRuntimePlan, {
        currentMarking: hasMatchingPetriMarkingSnapshot
          ? petriMarkingSnapshot.currentMarking
          : observedPetriRuntime.currentMarking,
        ...(hasMatchingPetriMarkingSnapshot && petriMarkingSnapshot.parallelSliceBatch
          ? { parallelSliceBatch: petriMarkingSnapshot.parallelSliceBatch }
          : {}),
        ...(epicVerificationClaims.length > 0 ? { epicVerificationClaims } : {}),
      });
    } catch {
      observedPetriRuntime = undefined;
    }
  }
  const authoritySliceIds =
    hasMatchingPetriMarkingSnapshot && petriMarkingSnapshot.parallelSliceBatch
      ? petriMarkingSnapshot.parallelSliceBatch.claimedSliceIds
      : unreadableAuthoritySliceIds.length > 0
        ? unreadableAuthoritySliceIds
        : undefined;
  const agentStream = await readAgentStreamTail(cwd, runId, metadata, agentStreamLimit, authoritySliceIds);
  const verifyStream = await readVerifyStreamTail(cwd, runId, metadata, verifyStreamLimit, authoritySliceIds);
  const sliceStreamInventory = await readSliceStreamInventory(
    cwd,
    runId,
    authoritySliceIds ?? [],
    observedPetriRuntime?.blockedSteps ?? [],
  );
  return {
    ...summary,
    planPath: metadata.planPath,
    reportsTail: reports.tail,
    reportsTotal: reports.total,
    petriEventsTail: petriEvents.tail,
    petriEventsTotal: petriEvents.total,
    ...(parallelAuthorityUnreadable
      ? {
          petriReadySteps: [],
          petriBlockedSteps: [
            { kind: 'authority_unreadable', blockers: [{ kind: 'parallel_authority_unreadable' }] },
            ...unreadableAuthoritySliceIds.map((sliceId) => ({
              kind: 'slice_start' as const,
              sliceId,
              blockers: [{ kind: 'parallel_authority_unreadable' as const }],
            })),
          ] satisfies readonly BlockedStep[],
        }
      : observedPetriRuntime === undefined
        ? {}
        : {
            petriReadySteps: observedPetriRuntime.readySteps,
            petriBlockedSteps: observedPetriRuntime.blockedSteps,
          }),
    ...(petriProjectionEntry === undefined
      ? {}
      : {
          petriProjection: petriProjectionEntry.projection,
          petriProjectionSource: petriProjectionEntry.source,
          ...(petriProjectionEntry.replayReason === undefined
            ? {}
            : { petriProjectionReplayReason: petriProjectionEntry.replayReason }),
        }),
    ...(hasMatchingPetriMarkingSnapshot && petriMarkingSnapshot.parallelSliceBatch
      ? { petriParallelSliceBatch: petriMarkingSnapshot.parallelSliceBatch }
      : {}),
    agentStreamTail: agentStream.tail,
    agentStreamTotal: agentStream.total,
    verifyStreamTail: verifyStream.tail,
    verifyStreamTotal: verifyStream.total,
    sliceStreamInventory,
    sliceProgress: groupSliceProgress(reports.events),
    requirements: await readRequirementStatuses(
      metadata.populatedPlanPath ?? metadata.planPath,
      metadata,
      reports.events,
      observedPetriRuntime?.blockedSteps ?? [],
    ),
    ...(petriNet === undefined ? {} : { petriNet }),
    ...(petrinautReplayExport === undefined
      ? {}
      : {
          petrinautReplayExport,
          petrinautStreamPath,
          ...(petrinautLaunchAvailable ? { petrinautLaunchPath: petrinautLaunchPathForRun(runId) } : {}),
        }),
  };
}

function projectJournalEpicVerificationClaims(
  events: readonly ExecutorNetEvent[],
  completedEpicIds: readonly string[],
): readonly EpicVerificationClaim[] {
  const completed = new Set(completedEpicIds);
  const claims = new Map<string, EpicVerificationClaim['phase']>();
  for (const event of events) {
    if (event.kind === 'epic_verification_claimed' && !completed.has(event.epicId)) {
      claims.set(event.epicId, 'claimed');
    }
    if (
      event.kind === 'transition_fired' &&
      event.step === 'epic_verify' &&
      event.epicId &&
      !completed.has(event.epicId)
    ) {
      claims.set(event.epicId, 'transitioned');
    }
  }
  return [...claims].map(([epicId, phase]) => ({ epicId, phase }));
}

function mergeEpicVerificationClaims(
  markingClaims: readonly EpicVerificationClaim[] | undefined,
  journalClaims: readonly EpicVerificationClaim[],
): readonly EpicVerificationClaim[] {
  const claims = new Map((markingClaims ?? []).map((claim) => [claim.epicId, claim]));
  for (const claim of journalClaims) {
    const current = claims.get(claim.epicId);
    if (!current || claim.phase === 'transitioned') claims.set(claim.epicId, claim);
  }
  return [...claims.values()];
}

export function petrinautStreamPathForRun(runId: string): string {
  return `/petrinaut/stream?runId=${encodeURIComponent(runId)}`;
}

export function petrinautLaunchPathForRun(runId: string): string {
  return `/petrinaut/launch?runId=${encodeURIComponent(runId)}`;
}

function canLaunchPetrinaut(env: { readonly PETRINAUT_URL?: string }): boolean {
  return 'url' in resolvePetrinautUrl({ env });
}

function toPetriProjection(
  snapshot: {
    readonly claimedTransitionIds?: readonly string[];
    readonly currentMarking: Record<string, number>;
    readonly firedTransitionCount: number;
    readonly terminalEventKind?: PetriProjection['terminalEventKind'];
    readonly haltedReason?: string;
    readonly terminalTs?: string;
    readonly failedSliceIds?: readonly string[];
    readonly parallelSliceBatch?: ParallelSliceBatchSnapshot;
  },
  metadata: RunMetadata,
  runtime?: Pick<ExecutorPetriRuntime, 'currentMarking' | 'enabledTransitions'>,
  replayProjection?: Pick<
    PetriProjection,
    'terminalEventKind' | 'haltedReason' | 'terminalTs' | 'failedSliceIds'
  >,
): PetriProjection {
  const claimedTransitionIds = sanitizeClaimedTransitionIds(snapshot.claimedTransitionIds, runtime);
  const terminalSummary = sanitizeTerminalSummary(snapshot, metadata, replayProjection);
  return {
    ...(claimedTransitionIds === undefined ? {} : { claimedTransitionIds }),
    currentMarking: snapshot.currentMarking,
    firedTransitionCount: snapshot.firedTransitionCount,
    ...terminalSummary,
  };
}

function sanitizeClaimedTransitionIds(
  claimedTransitionIds: readonly string[] | undefined,
  runtime?: Pick<ExecutorPetriRuntime, 'currentMarking' | 'enabledTransitions'>,
): readonly string[] | undefined {
  if (claimedTransitionIds === undefined || claimedTransitionIds.length === 0) {
    return claimedTransitionIds;
  }
  if (runtime === undefined) return undefined;
  const enabledById = new Map(runtime.enabledTransitions.map((transition) => [transition.id, transition]));
  const claimedInputs = new Map<string, number>();
  for (const transitionId of claimedTransitionIds) {
    const transition = enabledById.get(transitionId);
    if (!transition) return undefined;
    for (const arc of transition.inputArcs) {
      const nextClaimed = (claimedInputs.get(arc.placeId) ?? 0) + arc.weight;
      if (nextClaimed > (runtime.currentMarking[arc.placeId] ?? 0)) return undefined;
      claimedInputs.set(arc.placeId, nextClaimed);
    }
  }
  return claimedTransitionIds;
}

function petriMarkingSnapshotMatchesRuntime(
  snapshot: { readonly currentMarking: Record<string, number>; readonly firedTransitionCount: number },
  metadata: RunMetadata,
  plan: SchedulerPlan | undefined,
  runtime?: Pick<ExecutorPetriRuntime, 'currentMarking'>,
  replay?: Pick<PetriProjection, 'currentMarking' | 'firedTransitionCount'>,
): boolean {
  if (
    replay?.firedTransitionCount === snapshot.firedTransitionCount &&
    petriMarkingsEqual(replay.currentMarking, snapshot.currentMarking)
  ) {
    return true;
  }
  if (runtime === undefined) return false;
  if (
    projectExecutorPetriTransitionHistory(metadata, plan)?.transitionIds.length !==
    snapshot.firedTransitionCount
  ) {
    return false;
  }
  return petriMarkingsEqual(runtime.currentMarking, snapshot.currentMarking);
}

function petriMarkingsEqual(left: Record<string, number>, right: Record<string, number>): boolean {
  const leftEntries = Object.entries(left);
  return (
    leftEntries.length === Object.keys(right).length &&
    leftEntries.every(([placeId, count]) => right[placeId] === count)
  );
}

function sanitizeTerminalSummary(
  snapshot: {
    readonly terminalEventKind?: PetriProjection['terminalEventKind'] | undefined;
    readonly haltedReason?: string | undefined;
    readonly terminalTs?: string | undefined;
    readonly failedSliceIds?: readonly string[] | undefined;
    readonly parallelSliceBatch?: ParallelSliceBatchSnapshot;
  },
  metadata: RunMetadata,
  replayProjection?: {
    readonly terminalEventKind?: PetriProjection['terminalEventKind'] | undefined;
    readonly haltedReason?: string | undefined;
    readonly terminalTs?: string | undefined;
    readonly failedSliceIds?: readonly string[] | undefined;
  },
): Pick<PetriProjection, 'terminalEventKind' | 'haltedReason' | 'terminalTs' | 'failedSliceIds'> {
  if (snapshot.terminalEventKind === undefined && snapshot.haltedReason === undefined) {
    // A matching snapshot may lag the journal by the terminal fact (the append
    // wake-up races the marking persist). Backfill from replay truth only — never
    // from metadata expectation, so completion stays journal-ordered.
    if (!replayProjection?.terminalEventKind) return {};
    if (replayProjection.terminalTs === undefined || replayProjection.failedSliceIds === undefined) return {};
    return {
      terminalEventKind: replayProjection.terminalEventKind,
      ...(replayProjection.haltedReason === undefined ? {} : { haltedReason: replayProjection.haltedReason }),
      terminalTs: replayProjection.terminalTs,
      failedSliceIds: replayProjection.failedSliceIds,
    };
  }
  if (
    replayProjection?.terminalEventKind === undefined &&
    snapshot.parallelSliceBatch === undefined &&
    metadata.status !== 'promotion_prepared' &&
    metadata.status !== 'abandoned'
  ) {
    return {};
  }
  const checkable = replayProjection?.terminalEventKind ? replayProjection : snapshot;
  if (!checkable?.terminalEventKind) {
    return {};
  }
  if (checkable.terminalTs === undefined || checkable.failedSliceIds === undefined) return {};
  if (snapshot.terminalEventKind !== checkable.terminalEventKind) {
    return {};
  }
  if (snapshot.haltedReason !== checkable.haltedReason) {
    return {};
  }
  if (snapshot.terminalTs !== checkable.terminalTs) return {};
  if (!stringArraysEqual(snapshot.failedSliceIds, checkable.failedSliceIds)) return {};
  return {
    terminalEventKind: checkable.terminalEventKind,
    ...(checkable.haltedReason === undefined ? {} : { haltedReason: checkable.haltedReason }),
    terminalTs: checkable.terminalTs,
    failedSliceIds: checkable.failedSliceIds,
  };
}

function stringArraysEqual(
  left: readonly string[] | undefined,
  right: readonly string[] | undefined,
): boolean {
  if (left === undefined || right === undefined) return left === right;
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function toProjectionEntry(
  projection: PetriProjection | undefined,
  source: PetriProjectionSource,
  options?: { readonly replayReason?: PetriProjectionReplayReason },
):
  | {
      readonly projection: PetriProjection;
      readonly source: PetriProjectionSource;
      readonly replayReason?: PetriProjectionReplayReason;
    }
  | undefined {
  return projection
    ? { projection, source, ...(options?.replayReason ? { replayReason: options.replayReason } : {}) }
    : undefined;
}

function groupSliceProgress(events: readonly RunReportEvent[]): readonly RunSliceProgress[] {
  const bySlice = new Map<string, string[]>();
  for (const event of events) {
    if (typeof event['sliceId'] !== 'string') continue;
    const stage = eventStage(event);
    if (!stage) continue;
    const current = bySlice.get(event['sliceId']) ?? [];
    current.push(stage);
    bySlice.set(event['sliceId'], current);
  }
  return [...bySlice].map(([sliceId, stages]) => ({ sliceId, progress: stages.join(' -> ') }));
}

function eventStage(event: RunReportEvent): string | undefined {
  switch (event.event) {
    case 'slice_started':
      return 'started';
    case 'slice_execution_requested':
      return 'requested';
    case 'slice_agent_result':
      return 'agent';
    case 'slice_test_result':
      if (event['status'] === 'failed') return 'verify failed';
      if (event['status'] === 'passed') return 'verify passed';
      return undefined;
    case 'slice_completed':
      return 'completed';
    default:
      return undefined;
  }
}

export async function readRunTraceIndex(cwd: string, specId: string): Promise<RunTraceIndex> {
  let entries;
  try {
    entries = await readdir(runsRootPath(cwd), { withFileTypes: true });
  } catch {
    return { traces: [] };
  }

  const traces: RunTraceEntry[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const runId = entry.name;
    let metadata: RunMetadata | undefined;
    try {
      metadata = await readRunMetadata(runMetadataPath(cwd, runId));
    } catch {
      metadata = undefined;
    }
    if (!metadata || metadata.specId !== specId) continue;

    const reports = await readReportsTail(reportsFilePath(cwd, runId, metadata), 0);
    traces.push(...(await traceEntriesForRun(metadata, reports.events)));
  }
  return { traces };
}

async function readVerifyStreamTail(
  cwd: string,
  runId: string,
  metadata: RunMetadata,
  limit: number,
  sliceIds?: readonly string[],
): Promise<{ tail: readonly VerifyStreamEvent[]; total: number }> {
  const events = await readStreamEvents<VerifyStreamEvent>(
    cwd,
    runId,
    metadata,
    'verify_stream',
    verifyStreamPath,
    'verify',
    sliceIds,
  );
  return { tail: events.slice(-limit), total: events.length };
}

async function summarizeRun(cwd: string, runId: string, metadata: RunMetadata): Promise<RunSummary> {
  const runDir = runDirPath(cwd, runId);
  const [worktree, reports, petriNet, petriEvents, promotion] = await Promise.all([
    pathExists(metadata.worktreeDir ?? join(runDir, 'worktree')),
    pathExists(reportsFilePath(cwd, runId, metadata)),
    pathExists(petriFilePath(cwd, runId, metadata)),
    pathExists(petriEventsPath(cwd, runId)),
    pathExists(metadata.promotionPath ?? join(runDir, 'promotion', 'promotion.json')),
  ]);
  return {
    runId,
    specId: metadata.specId,
    status: metadata.status,
    ...(metadata.activeSliceId === undefined ? {} : { activeSliceId: metadata.activeSliceId }),
    ...(metadata.completedSliceIds === undefined ? {} : { completedSliceIds: metadata.completedSliceIds }),
    ...(metadata.supersedesRunId === undefined ? {} : { supersedesRunId: metadata.supersedesRunId }),
    ...(metadata.abandonedAt === undefined ? {} : { abandonedAt: metadata.abandonedAt }),
    ...(metadata.abandonReason === undefined ? {} : { abandonReason: metadata.abandonReason }),
    presence: { worktree, reports, petri: petriNet || petriEvents, promotion },
  };
}

function reportsFilePath(cwd: string, runId: string, metadata: RunMetadata): string {
  return metadata.reportsPath ?? join(runDirPath(cwd, runId), 'reports.jsonl');
}

function petriFilePath(cwd: string, runId: string, metadata: RunMetadata): string {
  return metadata.petriPath ?? join(runDirPath(cwd, runId), 'petrinaut', 'net.json');
}

function petriSdcpnFilePath(cwd: string, runId: string): string {
  return join(runDirPath(cwd, runId), 'petrinaut', 'net.sdcpn.json');
}

async function readPetriNet(path: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as unknown;
  } catch {
    return undefined;
  }
}

async function readPetriSdcpnFile(path: string): Promise<SdcpnFile | undefined> {
  try {
    return parseSdcpnFile(JSON.parse(await readFile(path, 'utf8')));
  } catch {
    return undefined;
  }
}

function readPetrinautReplayExport(
  sdcpnFile: SdcpnFile,
  events: readonly ExecutorNetEvent[],
): PetrinautReplayExport | undefined {
  try {
    return reducePetrinautReplayExport({ sdcpnFile, events });
  } catch {
    return undefined;
  }
}

async function readPetriEvents(
  path: string,
  limit: number,
): Promise<{
  exists: boolean;
  events: readonly ExecutorNetEvent[];
  tail: readonly ExecutorNetEvent[];
  total: number;
  torn: boolean;
  readable: boolean;
}> {
  const journal = await readPetriJournal(path);
  if (journal.status !== 'readable') {
    return {
      exists: journal.status !== 'missing',
      events: [],
      tail: [],
      total: 0,
      torn: journal.status === 'unreadable',
      readable: false,
    };
  }
  return {
    exists: true,
    events: journal.events,
    tail: journal.events.slice(-limit),
    total: journal.events.length,
    torn: false,
    readable: true,
  };
}

async function readReportsTail(
  path: string,
  limit: number,
): Promise<{ events: readonly RunReportEvent[]; tail: readonly RunReportEvent[]; total: number }> {
  let raw: string;
  try {
    raw = await readFile(path, 'utf8');
  } catch {
    return { events: [], tail: [], total: 0 };
  }
  // Every complete event line ends with the newline written in the same append;
  // a non-empty final segment is an in-flight partial append and is skipped.
  // ceiling: whole-file read per call; stream from the tail if reports.jsonl grows past a few MB.
  const events: RunReportEvent[] = [];
  for (const line of raw.split('\n').slice(0, -1)) {
    if (line.length === 0) {
      continue;
    }
    try {
      events.push(JSON.parse(line) as RunReportEvent);
    } catch {
      // A torn or corrupt line never blocks the readable remainder of the log.
    }
  }
  return { events, tail: events.slice(-limit), total: events.length };
}

interface ExecutedPlanPayload {
  readonly spec?: {
    readonly requirements?: readonly { readonly item_id?: unknown; readonly content?: unknown }[];
    readonly criteria?: readonly {
      readonly item_id?: unknown;
      readonly verifies?: readonly unknown[];
    }[];
  };
  readonly slices?: readonly {
    readonly id?: unknown;
    readonly derived_from?: readonly unknown[];
  }[];
}

async function traceEntriesForRun(
  metadata: RunMetadata,
  reports: readonly RunReportEvent[],
): Promise<readonly RunTraceEntry[]> {
  let plan: ExecutedPlanPayload;
  try {
    plan = JSON.parse(
      await readFile(metadata.populatedPlanPath ?? metadata.planPath, 'utf8'),
    ) as ExecutedPlanPayload;
  } catch {
    return [];
  }

  const sliceIdsByRequirement = sliceIdsByRequirementId(plan);
  const sliceIdsByNodeCode = new Map<string, Set<string>>();
  for (const requirement of plan.spec?.requirements ?? []) {
    if (typeof requirement.item_id !== 'string') continue;
    const sliceIds = sliceIdsByRequirement.get(requirement.item_id) ?? [];
    sliceIdsByNodeCode.set(requirement.item_id, new Set(sliceIds));
  }
  for (const criterion of plan.spec?.criteria ?? []) {
    if (typeof criterion.item_id !== 'string' || !Array.isArray(criterion.verifies)) continue;
    const sliceIds = new Set<string>();
    for (const requirementId of criterion.verifies) {
      if (typeof requirementId !== 'string') continue;
      for (const sliceId of sliceIdsByRequirement.get(requirementId) ?? []) sliceIds.add(sliceId);
    }
    sliceIdsByNodeCode.set(criterion.item_id, sliceIds);
  }

  const completed = new Set(metadata.completedSliceIds ?? []);
  const latestVerdicts = latestSliceVerdicts(reports);
  return [...sliceIdsByNodeCode]
    .filter(([, sliceIds]) => sliceIds.size > 0)
    .map(([nodeCode, sliceIds]) => {
      const allSliceIds = [...sliceIds];
      return {
        nodeCode,
        runId: metadata.runId,
        specId: metadata.specId,
        runStatus: metadata.status,
        sliceIds: allSliceIds,
        failedSliceIds: allSliceIds.filter((sliceId) => latestVerdicts.get(sliceId) === 'failed'),
        completedSliceIds: allSliceIds.filter((sliceId) => completed.has(sliceId)),
      };
    });
}

function sliceIdsByRequirementId(plan: ExecutedPlanPayload): ReadonlyMap<string, readonly string[]> {
  const byRequirement = new Map<string, string[]>();
  for (const slice of plan.slices ?? []) {
    if (typeof slice.id !== 'string' || !Array.isArray(slice.derived_from)) continue;
    for (const requirementId of slice.derived_from) {
      if (typeof requirementId !== 'string') continue;
      const existing = byRequirement.get(requirementId) ?? [];
      existing.push(slice.id);
      byRequirement.set(requirementId, existing);
    }
  }
  return byRequirement;
}

async function readRequirementStatuses(
  planPath: string,
  metadata: RunMetadata,
  reports: readonly RunReportEvent[],
  blockedSteps: readonly BlockedStep[],
): Promise<readonly RunRequirementStatus[]> {
  let plan: ExecutedPlanPayload;
  try {
    plan = JSON.parse(await readFile(planPath, 'utf8')) as ExecutedPlanPayload;
  } catch {
    return [];
  }

  const completed = new Set(metadata.completedSliceIds ?? []);
  const latestVerdicts = latestSliceVerdicts(reports);
  const parallelStates = new Map<
    string,
    'claimed' | 'running' | 'succeeded_unintegrated' | 'failed' | 'integrated' | 'authority_unreadable'
  >();
  for (const step of blockedSteps) {
    if (step.kind !== 'slice_start') continue;
    const blocker = step.blockers.find((candidate) => candidate.kind === 'parallel_authority');
    if (blocker?.kind === 'parallel_authority') parallelStates.set(step.sliceId, blocker.state);
    else if (step.blockers.some((candidate) => candidate.kind === 'parallel_authority_unreadable')) {
      parallelStates.set(step.sliceId, 'authority_unreadable');
    }
  }
  const criteriaByRequirement = criteriaCoverage(plan);
  const slices = plan.slices ?? [];

  return (plan.spec?.requirements ?? []).flatMap((requirement): RunRequirementStatus[] => {
    if (typeof requirement.item_id !== 'string' || typeof requirement.content !== 'string') return [];
    const sliceIds = slices.flatMap((slice) => {
      if (typeof slice.id !== 'string' || !Array.isArray(slice.derived_from)) return [];
      return slice.derived_from.includes(requirement.item_id) ? [slice.id] : [];
    });
    const completedSliceIds = sliceIds.filter((sliceId) => completed.has(sliceId));
    const failedSliceIds = sliceIds.filter(
      (sliceId) =>
        latestVerdicts.get(sliceId) === 'failed' ||
        parallelStates.get(sliceId) === 'failed' ||
        parallelStates.get(sliceId) === 'authority_unreadable',
    );
    const activeSliceIds = sliceIds.filter((sliceId) => {
      const state = parallelStates.get(sliceId);
      return state === 'claimed' || state === 'running' || state === 'succeeded_unintegrated';
    });
    const missingVerificationSliceIds = completedSliceIds.filter((sliceId) => !latestVerdicts.has(sliceId));
    const criterionIds = criteriaByRequirement.get(requirement.item_id) ?? [];

    return [
      {
        requirementId: requirement.item_id,
        content: requirement.content,
        status: requirementStatus({
          sliceIds,
          ...(metadata.activeSliceId === undefined ? {} : { activeSliceId: metadata.activeSliceId }),
          activeSliceIds,
          completedSliceIds,
          failedSliceIds,
          missingVerificationSliceIds,
          criterionIds,
        }),
        sliceIds,
        completedSliceIds,
        failedSliceIds,
        missingVerificationSliceIds,
        criterionIds,
      },
    ];
  });
}

function latestSliceVerdicts(reports: readonly RunReportEvent[]): Map<string, 'passed' | 'failed'> {
  const latest = new Map<string, 'passed' | 'failed'>();
  for (const event of reports) {
    if (event.event !== 'slice_test_result') continue;
    if (typeof event['sliceId'] !== 'string') continue;
    if (event['status'] !== 'passed' && event['status'] !== 'failed') continue;
    latest.set(event['sliceId'], event['status']);
  }
  return latest;
}

function criteriaCoverage(plan: ExecutedPlanPayload): Map<string, readonly string[]> {
  const coverage = new Map<string, string[]>();
  for (const criterion of plan.spec?.criteria ?? []) {
    if (typeof criterion.item_id !== 'string' || !Array.isArray(criterion.verifies)) continue;
    for (const requirementId of criterion.verifies) {
      if (typeof requirementId !== 'string') continue;
      const existing = coverage.get(requirementId) ?? [];
      existing.push(criterion.item_id);
      coverage.set(requirementId, existing);
    }
  }
  return coverage;
}

function requirementStatus(args: {
  readonly sliceIds: readonly string[];
  readonly activeSliceId?: string;
  readonly activeSliceIds: readonly string[];
  readonly completedSliceIds: readonly string[];
  readonly failedSliceIds: readonly string[];
  readonly missingVerificationSliceIds: readonly string[];
  readonly criterionIds: readonly string[];
}): RunRequirementStatusKind {
  if (args.sliceIds.length === 0) return 'unmapped';
  if (args.failedSliceIds.length > 0) return 'failed';
  if (args.activeSliceIds.length > 0) return 'running';
  if (
    args.activeSliceId !== undefined &&
    args.sliceIds.includes(args.activeSliceId) &&
    !args.completedSliceIds.includes(args.activeSliceId)
  ) {
    return 'running';
  }
  if (args.completedSliceIds.length < args.sliceIds.length) return 'pending';
  if (args.missingVerificationSliceIds.length > 0) return 'missing_verification';
  if (args.criterionIds.length === 0) return 'unverified';
  return 'passed';
}

async function readAgentStreamTail(
  cwd: string,
  runId: string,
  metadata: RunMetadata,
  limit: number,
  sliceIds?: readonly string[],
): Promise<{ tail: readonly AgentStreamEvent[]; total: number }> {
  if (
    !sliceIds?.length &&
    !metadata.activeSliceId &&
    (!metadata.completedSliceIds || metadata.completedSliceIds.length === 0)
  ) {
    return { tail: [], total: 0 };
  }
  const events = await readStreamEvents<AgentStreamEvent>(
    cwd,
    runId,
    metadata,
    'agent_stream',
    agentStreamPath,
    'agent',
    sliceIds,
  );
  return { tail: events.slice(-limit), total: events.length };
}

async function readStreamEvents<T extends { readonly event: string }>(
  cwd: string,
  runId: string,
  metadata: RunMetadata,
  eventName: T['event'],
  pathFor: (cwd: string, runId: string, sliceId: string, attempt?: number) => string,
  stage: 'agent' | 'verify',
  authoritySliceIds?: readonly string[],
): Promise<readonly T[]> {
  if (
    !authoritySliceIds?.length &&
    !metadata.activeSliceId &&
    (!metadata.completedSliceIds || metadata.completedSliceIds.length === 0)
  ) {
    return [];
  }
  const sliceIds = authoritySliceIds ?? [
    ...(metadata.completedSliceIds ?? []),
    ...(metadata.activeSliceId && !(metadata.completedSliceIds ?? []).includes(metadata.activeSliceId)
      ? [metadata.activeSliceId]
      : []),
  ];
  const runOrdered = await readRunOrderedStreamEvents<T>(
    runStreamEventsPath(agentStreamPath(cwd, runId, '_stream_index_')),
    eventName,
    new Set(sliceIds),
  );
  if (runOrdered !== undefined) return runOrdered;
  const events: T[] = [];
  for (const sliceId of sliceIds) {
    const attempts = authoritySliceIds
      ? await streamArtifactAttempts(cwd, runId, sliceId, stage)
      : Array.from({ length: streamArtifactAttemptCount(metadata, sliceId, stage) }, (_, index) => index + 1);
    for (const attempt of attempts) {
      events.push(...(await readStreamFile<T>(pathFor(cwd, runId, sliceId, attempt), eventName)));
    }
  }
  return events;
}

async function readRunOrderedStreamEvents<T extends { readonly event: string }>(
  path: string,
  eventName: T['event'],
  sliceIds: ReadonlySet<string>,
): Promise<readonly T[] | undefined> {
  let raw: string;
  try {
    raw = await readFile(path, 'utf8');
  } catch {
    return undefined;
  }
  const events: (T & { readonly runSequence?: number; readonly sliceId?: string })[] = [];
  for (const line of raw.split('\n').slice(0, -1)) {
    try {
      const event = JSON.parse(line) as T & { readonly runSequence?: number; readonly sliceId?: string };
      if (event.event === eventName && event.sliceId && sliceIds.has(event.sliceId)) events.push(event);
    } catch {
      // A torn index line does not hide prior durable stream events.
    }
  }
  return events.sort((left, right) => (left.runSequence ?? 0) - (right.runSequence ?? 0));
}

async function streamArtifactAttempts(
  cwd: string,
  runId: string,
  sliceId: string,
  stage: 'agent' | 'verify',
): Promise<readonly number[]> {
  try {
    const entries = await readdir(join(runDirPath(cwd, runId), 'streams', sliceId));
    const pattern = stage === 'agent' ? /^agent-attempt-(\d+)\.jsonl$/u : /^verify-attempt-(\d+)\.jsonl$/u;
    return entries
      .flatMap((entry) => {
        const match = pattern.exec(entry);
        return match?.[1] ? [Number(match[1])] : [];
      })
      .sort((left, right) => left - right);
  } catch {
    return [];
  }
}

async function readSliceStreamInventory(
  cwd: string,
  runId: string,
  sliceIds: readonly string[],
  blockedSteps: readonly BlockedStep[],
): Promise<readonly RunSliceStreamInventory[]> {
  return Promise.all(
    sliceIds.map(async (sliceId) => {
      const blocker = blockedSteps
        .find((step) => step.kind === 'slice_start' && step.sliceId === sliceId)
        ?.blockers.find((reason) => reason.kind === 'parallel_authority');
      return {
        sliceId,
        state: blocker?.kind === 'parallel_authority' ? blocker.state : 'claimed',
        agentAttempts: await streamArtifactAttempts(cwd, runId, sliceId, 'agent'),
        verifyAttempts: await streamArtifactAttempts(cwd, runId, sliceId, 'verify'),
      };
    }),
  );
}

function streamArtifactAttemptCount(
  metadata: RunMetadata,
  sliceId: string,
  stage: 'agent' | 'verify',
): number {
  const cycles = metadata.sliceAttemptHistory?.[sliceId]?.[stage] ?? [];
  const completedAttempts = cycles.reduce(
    (total, cycle) => total + (cycle.outcome === 'reset' ? 0 : cycle.attempts),
    0,
  );
  const isActiveStage =
    metadata.activeSliceId === sliceId &&
    ((stage === 'agent' && metadata.status === 'slice_execution_requested') ||
      (stage === 'verify' && metadata.status === 'agent_result_ingested'));
  const latest = cycles.at(-1);
  const exhausted = latest?.outcome === 'exhausted' && metadata.activeSliceAttempts === latest.attempts;
  return Math.max(
    1,
    completedAttempts + (isActiveStage && !exhausted ? (metadata.activeSliceAttempts ?? 0) + 1 : 0),
  );
}

async function readStreamFile<T extends { readonly event: string }>(
  path: string,
  eventName: T['event'],
): Promise<readonly T[]> {
  let raw: string;
  try {
    raw = await readFile(path, 'utf8');
  } catch {
    return [];
  }
  const events: T[] = [];
  for (const line of raw.split('\n').slice(0, -1)) {
    if (line.length === 0) continue;
    try {
      const event = JSON.parse(line) as T;
      if (event.event === eventName) events.push(event);
    } catch {
      // A torn stream line never blocks the readable stream tail.
    }
  }
  return events;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
