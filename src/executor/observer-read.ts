import { access, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { BRUNCH_DIR } from '../constants.js';
import { agentStreamPath, type AgentStreamEvent } from './agent-result.js';
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

export interface RunDetail extends RunSummary {
  readonly planPath: string;
  readonly reportsTail: readonly RunReportEvent[];
  readonly reportsTotal: number;
  readonly agentStreamTail: readonly AgentStreamEvent[];
  readonly agentStreamTotal: number;
  readonly verifyStreamTail: readonly VerifyStreamEvent[];
  readonly verifyStreamTotal: number;
  readonly requirements: readonly RunRequirementStatus[];
  /** Raw parsed petrinaut/net.json — deliberately unshaped (frontier: raw view only). */
  readonly petriNet?: unknown;
}

export const DEFAULT_REPORTS_TAIL_LIMIT = 50;
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
  const agentStreamLimit = options?.agentStreamTailLimit ?? DEFAULT_AGENT_STREAM_TAIL_LIMIT;
  const verifyStreamLimit = options?.verifyStreamTailLimit ?? DEFAULT_VERIFY_STREAM_TAIL_LIMIT;
  const reports = await readReportsTail(reportsFilePath(cwd, runId, metadata), limit);
  const agentStream = await readAgentStreamTail(cwd, runId, metadata, agentStreamLimit);
  const verifyStream = await readVerifyStreamTail(cwd, runId, metadata, verifyStreamLimit);
  const petriNet = await readPetriNet(petriFilePath(cwd, runId, metadata));
  return {
    ...summary,
    planPath: metadata.planPath,
    reportsTail: reports.tail,
    reportsTotal: reports.total,
    agentStreamTail: agentStream.tail,
    agentStreamTotal: agentStream.total,
    verifyStreamTail: verifyStream.tail,
    verifyStreamTotal: verifyStream.total,
    requirements: await readRequirementStatuses(
      metadata.populatedPlanPath ?? metadata.planPath,
      metadata,
      reports.events,
    ),
    ...(petriNet === undefined ? {} : { petriNet }),
  };
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
  const [worktree, reports, petri, promotion] = await Promise.all([
    pathExists(metadata.worktreeDir ?? join(runDir, 'worktree')),
    pathExists(reportsFilePath(cwd, runId, metadata)),
    pathExists(petriFilePath(cwd, runId, metadata)),
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
    presence: { worktree, reports, petri, promotion },
  };
}

function reportsFilePath(cwd: string, runId: string, metadata: RunMetadata): string {
  return metadata.reportsPath ?? join(runDirPath(cwd, runId), 'reports.jsonl');
}

function petriFilePath(cwd: string, runId: string, metadata: RunMetadata): string {
  return metadata.petriPath ?? join(runDirPath(cwd, runId), 'petrinaut', 'net.json');
}

async function readPetriNet(path: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as unknown;
  } catch {
    return undefined;
  }
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
