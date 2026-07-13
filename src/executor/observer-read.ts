import { access, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { BRUNCH_DIR } from '../constants.js';
import { agentStreamPath, type AgentStreamEvent } from './agent-result.js';
import type { BlockedStep, ExecutorNetEvent, ReadyStep, SchedulerPlan } from './orchestrate-topology.js';
import { parsePetriEvent, petriEventsPath } from './petri-events.js';
import { petriMarkingSnapshotMatchesRunMetadata, readPetriMarkingSnapshot } from './petri-marking.js';
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
import { verifyStreamPath, type VerifyStreamEvent } from './test-result.js';

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
  readonly agentStreamTail: readonly AgentStreamEvent[];
  readonly agentStreamTotal: number;
  readonly verifyStreamTail: readonly VerifyStreamEvent[];
  readonly verifyStreamTotal: number;
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
  const agentStream = await readAgentStreamTail(cwd, runId, metadata, agentStreamLimit);
  const verifyStream = await readVerifyStreamTail(cwd, runId, metadata, verifyStreamLimit);
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
    petriMarkingSnapshotMatchesRuntime(petriMarkingSnapshot, metadata, petriRuntimePlan, petriRuntime);
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
  return {
    ...summary,
    planPath: metadata.planPath,
    reportsTail: reports.tail,
    reportsTotal: reports.total,
    petriEventsTail: petriEvents.tail,
    petriEventsTotal: petriEvents.total,
    ...(petriRuntime === undefined
      ? {}
      : {
          petriReadySteps: petriRuntime.readySteps,
          petriBlockedSteps: petriRuntime.blockedSteps,
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
    agentStreamTail: agentStream.tail,
    agentStreamTotal: agentStream.total,
    verifyStreamTail: verifyStream.tail,
    verifyStreamTotal: verifyStream.total,
    sliceProgress: groupSliceProgress(reports.events),
    requirements: await readRequirementStatuses(
      metadata.populatedPlanPath ?? metadata.planPath,
      metadata,
      reports.events,
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
  },
  metadata: RunMetadata,
  runtime?: Pick<ExecutorPetriRuntime, 'currentMarking' | 'enabledTransitions'>,
  replayProjection?: Pick<PetriProjection, 'terminalEventKind' | 'haltedReason'>,
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
): boolean {
  if (runtime === undefined) return false;
  if (
    projectExecutorPetriTransitionHistory(metadata, plan)?.transitionIds.length !==
    snapshot.firedTransitionCount
  ) {
    return false;
  }
  const runtimeEntries = Object.entries(runtime.currentMarking);
  const snapshotEntries = Object.entries(snapshot.currentMarking);
  return (
    runtimeEntries.length === snapshotEntries.length &&
    runtimeEntries.every(([placeId, count]) => snapshot.currentMarking[placeId] === count)
  );
}

function sanitizeTerminalSummary(
  snapshot: {
    readonly terminalEventKind?: PetriProjection['terminalEventKind'] | undefined;
    readonly haltedReason?: string | undefined;
  },
  metadata: RunMetadata,
  replayProjection?: {
    readonly terminalEventKind?: PetriProjection['terminalEventKind'] | undefined;
    readonly haltedReason?: string | undefined;
  },
): Pick<PetriProjection, 'terminalEventKind' | 'haltedReason'> {
  if (snapshot.terminalEventKind === undefined && snapshot.haltedReason === undefined) {
    // A matching snapshot may lag the journal by the terminal fact (the append
    // wake-up races the marking persist). Backfill from replay truth only — never
    // from metadata expectation, so completion stays journal-ordered.
    if (!replayProjection?.terminalEventKind) return {};
    return {
      terminalEventKind: replayProjection.terminalEventKind,
      ...(replayProjection.haltedReason === undefined ? {} : { haltedReason: replayProjection.haltedReason }),
    };
  }
  const checkable = replayProjection?.terminalEventKind
    ? replayProjection
    : expectedTerminalSummary(metadata);
  if (!checkable?.terminalEventKind) {
    return {};
  }
  if (snapshot.terminalEventKind !== checkable.terminalEventKind) {
    return {};
  }
  if (snapshot.haltedReason !== checkable.haltedReason) {
    return {};
  }
  return {
    terminalEventKind: checkable.terminalEventKind,
    ...(checkable.haltedReason === undefined ? {} : { haltedReason: checkable.haltedReason }),
  };
}

function expectedTerminalSummary(
  metadata: RunMetadata,
): Pick<PetriProjection, 'terminalEventKind' | 'haltedReason'> | undefined {
  switch (metadata.status) {
    case 'promotion_prepared':
      return { terminalEventKind: 'net_completed' };
    case 'abandoned':
      return { terminalEventKind: 'net_halted', haltedReason: 'abandoned' };
    default:
      return undefined;
  }
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
): Promise<{ tail: readonly VerifyStreamEvent[]; total: number }> {
  const events = await readStreamEvents<VerifyStreamEvent>(
    cwd,
    runId,
    metadata,
    'verify_stream',
    verifyStreamPath,
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
}> {
  let raw: string;
  try {
    raw = await readFile(path, 'utf8');
  } catch {
    return { exists: false, events: [], tail: [], total: 0, torn: false };
  }
  const events: ExecutorNetEvent[] = [];
  let torn = false;
  const lines = raw.split('\n');
  const lastIndex = lines.length - 1;
  const hasTrailingNewline = raw.endsWith('\n');
  for (const [index, line] of lines.entries()) {
    if (index === lastIndex && line.length === 0) continue;
    if (line.length === 0) continue;
    try {
      const event = parsePetriEvent(JSON.parse(line));
      if (event === undefined) {
        torn = true;
        continue;
      }
      events.push(event);
    } catch {
      // A torn journal line never blocks the readable event tail.
      // Accept a complete final line even when the file is missing a trailing newline.
      torn = true;
      if (index !== lastIndex || hasTrailingNewline) continue;
    }
  }
  return { exists: true, events, tail: events.slice(-limit), total: events.length, torn };
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
): Promise<readonly RunRequirementStatus[]> {
  let plan: ExecutedPlanPayload;
  try {
    plan = JSON.parse(await readFile(planPath, 'utf8')) as ExecutedPlanPayload;
  } catch {
    return [];
  }

  const completed = new Set(metadata.completedSliceIds ?? []);
  const latestVerdicts = latestSliceVerdicts(reports);
  const criteriaByRequirement = criteriaCoverage(plan);
  const slices = plan.slices ?? [];

  return (plan.spec?.requirements ?? []).flatMap((requirement): RunRequirementStatus[] => {
    if (typeof requirement.item_id !== 'string' || typeof requirement.content !== 'string') return [];
    const sliceIds = slices.flatMap((slice) => {
      if (typeof slice.id !== 'string' || !Array.isArray(slice.derived_from)) return [];
      return slice.derived_from.includes(requirement.item_id) ? [slice.id] : [];
    });
    const completedSliceIds = sliceIds.filter((sliceId) => completed.has(sliceId));
    const failedSliceIds = sliceIds.filter((sliceId) => latestVerdicts.get(sliceId) === 'failed');
    const missingVerificationSliceIds = completedSliceIds.filter((sliceId) => !latestVerdicts.has(sliceId));
    const criterionIds = criteriaByRequirement.get(requirement.item_id) ?? [];

    return [
      {
        requirementId: requirement.item_id,
        content: requirement.content,
        status: requirementStatus({
          sliceIds,
          ...(metadata.activeSliceId === undefined ? {} : { activeSliceId: metadata.activeSliceId }),
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
  readonly completedSliceIds: readonly string[];
  readonly failedSliceIds: readonly string[];
  readonly missingVerificationSliceIds: readonly string[];
  readonly criterionIds: readonly string[];
}): RunRequirementStatusKind {
  if (args.sliceIds.length === 0) return 'unmapped';
  if (args.failedSliceIds.length > 0) return 'failed';
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
): Promise<{ tail: readonly AgentStreamEvent[]; total: number }> {
  if (!metadata.activeSliceId && (!metadata.completedSliceIds || metadata.completedSliceIds.length === 0)) {
    return { tail: [], total: 0 };
  }
  const events = await readStreamEvents<AgentStreamEvent>(
    cwd,
    runId,
    metadata,
    'agent_stream',
    agentStreamPath,
  );
  return { tail: events.slice(-limit), total: events.length };
}

async function readStreamEvents<T extends { readonly event: string }>(
  cwd: string,
  runId: string,
  metadata: RunMetadata,
  eventName: T['event'],
  pathFor: (cwd: string, runId: string, sliceId: string) => string,
): Promise<readonly T[]> {
  if (!metadata.activeSliceId && (!metadata.completedSliceIds || metadata.completedSliceIds.length === 0)) {
    return [];
  }
  const sliceIds = [
    ...(metadata.completedSliceIds ?? []),
    ...(metadata.activeSliceId && !(metadata.completedSliceIds ?? []).includes(metadata.activeSliceId)
      ? [metadata.activeSliceId]
      : []),
  ];
  const events: T[] = [];
  for (const sliceId of sliceIds) {
    events.push(...(await readStreamFile<T>(pathFor(cwd, runId, sliceId), eventName)));
  }
  return events;
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
