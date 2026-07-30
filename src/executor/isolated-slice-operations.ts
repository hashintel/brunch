import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import type { ResolvedExecutionActions } from './execution-contract.js';
import type {
  AgentRunnerPort,
  AgentRunnerRuntime,
  AgentRunResult,
  AgentRepairContextAuthority,
  GitSliceIntegrationPort,
  TestRunnerPort,
  TestRunResult,
  VerifyTarget,
} from './execution-ports.js';
import {
  materializePublicPacket,
  type PublicPacketMaterialization,
  type PublicPacketReference,
} from './execution-public-packet.js';
import type { ReadyStep } from './orchestrate-topology.js';
import { populatedPlanPath } from './populate.js';
import {
  MAX_STAGE_ATTEMPTS,
  sliceRepairProtocol,
  sliceRepairTopology,
  type ActiveSliceRepairContext,
  type SliceRepairDiagnostic,
  type SliceRepairHistory,
  type SliceRepairHistoryDelta,
  type SliceRepairStage,
} from './slice-repair-cycle.js';
import { appendRunOrderedStreamEvent } from './slice-stream-events.js';

export interface AgentStreamEvent {
  readonly event: 'agent_stream';
  readonly runId: string;
  readonly epicId?: string;
  readonly sliceId: string;
  readonly sequence: number;
  readonly runSequence?: number;
  readonly kind: 'status' | 'message' | 'tool';
  readonly message: string;
}

export interface VerifyStreamEvent {
  readonly event: 'verify_stream';
  readonly runId: string;
  readonly epicId?: string;
  readonly sliceId: string;
  readonly sequence: number;
  readonly runSequence?: number;
  readonly kind: 'status' | 'stdout' | 'stderr';
  readonly message: string;
}

export type SliceReportRecorder = (event: Record<string, unknown>) => Promise<void>;

export class IsolatedSliceOperationError extends Error {
  constructor(readonly reason: string) {
    super(reason);
  }
}

export type IsolatedAttemptOutcome =
  | {
      readonly status: 'succeeded';
      readonly transitionId: string;
      readonly verdictTransitionId?: string;
      readonly historyDelta: SliceRepairHistoryDelta;
    }
  | {
      readonly status: 'verification_failed';
      readonly reason: 'slice_verification_not_passed';
      readonly transitionId: string;
      readonly verdictTransitionId: string;
      readonly historyDelta: SliceRepairHistoryDelta;
    }
  | {
      readonly status: 'retry' | 'exhausted';
      readonly reason: 'agent_run_failed' | 'test_run_failed';
      readonly message: string;
      readonly transitionId: string;
      readonly historyDelta?: SliceRepairHistoryDelta;
      readonly fact: {
        readonly step: 'agent_result' | 'test_result';
        readonly attempt: number;
        readonly reason: 'agent_run_failed' | 'test_run_failed';
      };
    };

const attemptOutcomes = new WeakMap<object, IsolatedAttemptOutcome>();

export function attachIsolatedAttemptOutcome<Result extends object>(
  result: Result,
  outcome: IsolatedAttemptOutcome,
): Result {
  attemptOutcomes.set(result, outcome);
  return result;
}

export function isolatedAttemptOutcomeFor(result: object): IsolatedAttemptOutcome | undefined {
  return attemptOutcomes.get(result);
}

export function sliceStartReport(args: {
  readonly runId: string;
  readonly sliceId: string;
  readonly epicId?: string;
}): Record<string, unknown> {
  return {
    event: 'slice_started',
    runId: args.runId,
    ...(args.epicId === undefined ? {} : { epicId: args.epicId }),
    sliceId: args.sliceId,
    status: 'slice_started',
  };
}

export interface SliceRequestContext {
  readonly scopeHandoffRequired: boolean;
  readonly scopeId?: string;
  readonly definition?: string;
  readonly criteria?: readonly { readonly kind: string; readonly target: string }[];
  readonly derivedFrom?: readonly string[];
  readonly requirements?: readonly {
    readonly itemId: string;
    readonly title: string;
    readonly content: string;
  }[];
  readonly publicPacket?: PublicPacketReference;
  readonly designContext?: readonly { readonly itemId: string; readonly content: string }[];
  readonly verificationContext?: readonly { readonly itemId: string; readonly content: string }[];
  readonly instruction?: string;
}

interface PlanSliceRequestShape {
  readonly scope_id?: string;
  readonly definition?: string;
  readonly verification?: readonly { readonly kind?: string; readonly target?: string }[];
  readonly derived_from?: readonly string[];
  readonly depends_on?: readonly string[];
  readonly design_context?: readonly { readonly item_id?: string; readonly content?: string }[];
  readonly verification_context?: readonly { readonly item_id?: string; readonly content?: string }[];
}

export async function readSliceRequestContext(args: {
  readonly cwd: string;
  readonly runId: string;
  readonly populatedPlanPath?: string;
  readonly publicPacket?: PublicPacketMaterialization;
  readonly sliceId: string;
}): Promise<
  | {
      readonly status: 'ok';
      readonly requestContext: SliceRequestContext;
      readonly publicPacket?: PublicPacketMaterialization;
    }
  | { readonly status: 'invalid'; readonly message: string }
> {
  const planPath = args.populatedPlanPath ?? populatedPlanPath(args.cwd, args.runId);
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(planPath, 'utf8'));
  } catch (error) {
    return {
      status: 'invalid',
      message: `Could not read populated plan for ${args.sliceId}: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
  if (!isRecord(parsed)) {
    return { status: 'invalid', message: 'Populated plan is not an object.' };
  }
  const payload = parsed as {
    readonly scope_handoff_required?: boolean;
    readonly spec?: {
      readonly requirements?: readonly {
        readonly item_id?: string;
        readonly title?: string;
        readonly content?: string;
      }[];
    };
    readonly slices?: readonly ({ readonly id?: string } & PlanSliceRequestShape)[];
  };
  if (
    (payload.spec !== undefined && !isRecord(payload.spec)) ||
    (payload.spec?.requirements !== undefined &&
      (!Array.isArray(payload.spec.requirements) || !payload.spec.requirements.every(isRecord))) ||
    (payload.slices !== undefined && (!Array.isArray(payload.slices) || !payload.slices.every(isRecord)))
  ) {
    return { status: 'invalid', message: 'Populated plan has malformed requirement or slice arrays.' };
  }
  if (typeof payload.scope_handoff_required !== 'boolean') {
    return { status: 'invalid', message: 'Populated plan has an invalid scope_handoff_required marker.' };
  }
  const slice = payload.slices?.find((candidate) => candidate.id === args.sliceId);
  if (!slice) {
    return { status: 'invalid', message: `Populated plan does not contain active slice ${args.sliceId}.` };
  }
  const criteria = Array.isArray(slice.verification)
    ? slice.verification.flatMap((criterion) =>
        isNonBlank(criterion?.kind) && isNonBlank(criterion?.target)
          ? [{ kind: criterion.kind, target: criterion.target }]
          : [],
      )
    : [];
  const derivedFrom = Array.isArray(slice.derived_from) ? slice.derived_from.filter(isNonBlank) : [];
  const designContext = Array.isArray(slice.design_context)
    ? slice.design_context.flatMap((item) =>
        isNonBlank(item?.item_id) && isNonBlank(item?.content)
          ? [{ itemId: item.item_id, content: item.content }]
          : [],
      )
    : [];
  const verificationContext = Array.isArray(slice.verification_context)
    ? slice.verification_context.flatMap((item) =>
        isNonBlank(item?.item_id) && isNonBlank(item?.content)
          ? [{ itemId: item.item_id, content: item.content }]
          : [],
      )
    : [];
  const carriesScopeContext =
    slice.scope_id !== undefined ||
    slice.design_context !== undefined ||
    slice.verification_context !== undefined;
  if (carriesScopeContext && payload.scope_handoff_required !== true) {
    return {
      status: 'invalid',
      message: `Scope slice ${args.sliceId} disagrees with scope_handoff_required.`,
    };
  }
  const scoped = payload.scope_handoff_required === true;
  if (scoped) {
    const missing = [
      ...(!isNonBlank(slice.scope_id) ? ['scope_id'] : []),
      ...(!isNonBlank(slice.definition) ? ['definition'] : []),
      ...(criteria.length === 0 ? ['verification'] : []),
      ...(derivedFrom.length === 0 ? ['derived_from'] : []),
      ...(designContext.length === 0 ? ['design_context'] : []),
      ...(verificationContext.length === 0 ? ['verification_context'] : []),
    ];
    if (missing.length > 0) {
      return {
        status: 'invalid',
        message: `Scope slice ${args.sliceId} is missing valid ${missing.join(', ')}.`,
      };
    }
  }
  const requirementIds = collectWorkerRequirementIds(slice, payload.slices ?? []);
  if (requirementIds.status === 'invalid') {
    return { status: 'invalid', message: `Scope slice ${args.sliceId} ${requirementIds.message}` };
  }
  const requirementEntries = payload.spec?.requirements ?? [];
  const requirementEntryIds = requirementEntries.flatMap((requirement) =>
    isNonBlank(requirement.item_id) ? [requirement.item_id] : [],
  );
  if (new Set(requirementEntryIds).size !== requirementEntryIds.length) {
    return { status: 'invalid', message: 'Populated plan contains duplicate requirement ids.' };
  }
  const requirementsById = new Map(
    requirementEntries.flatMap((requirement) =>
      isNonBlank(requirement.item_id) && isNonBlank(requirement.title) && isNonBlank(requirement.content)
        ? [
            [
              requirement.item_id,
              {
                itemId: requirement.item_id,
                title: requirement.title,
                content: requirement.content,
              },
            ] as const,
          ]
        : [],
    ),
  );
  const unresolved = requirementIds.ids.find((requirementId) => !requirementsById.has(requirementId));
  if (scoped && unresolved !== undefined) {
    return {
      status: 'invalid',
      message: `Scope slice ${args.sliceId} cannot resolve exact requirement content for ${unresolved}.`,
    };
  }
  const requiredIds = new Set(requirementIds.ids);
  const requirements = Array.from(requirementsById.values()).filter((requirement) =>
    requiredIds.has(requirement.itemId),
  );
  return {
    status: 'ok',
    requestContext: {
      scopeHandoffRequired: scoped,
      ...(typeof slice.scope_id === 'string' ? { scopeId: slice.scope_id } : {}),
      ...(isNonBlank(slice.definition) ? { definition: slice.definition } : {}),
      ...(Array.isArray(slice.verification) ? { criteria } : {}),
      ...(Array.isArray(slice.derived_from) ? { derivedFrom } : {}),
      ...(requirements.length > 0 ? { requirements } : {}),
      ...(args.publicPacket ? { publicPacket: args.publicPacket.reference } : {}),
      ...(Array.isArray(slice.design_context) ? { designContext } : {}),
      ...(Array.isArray(slice.verification_context) ? { verificationContext } : {}),
      ...(criteria.length > 0
        ? { instruction: 'Make the minimum change that satisfies every criterion.' }
        : {}),
    },
    ...(args.publicPacket ? { publicPacket: args.publicPacket } : {}),
  };
}

function collectWorkerRequirementIds(
  slice: { readonly id?: string } & PlanSliceRequestShape,
  slices: readonly ({ readonly id?: string } & PlanSliceRequestShape)[],
):
  | { readonly status: 'ok'; readonly ids: readonly string[] }
  | { readonly status: 'invalid'; readonly message: string } {
  const byId = new Map(
    slices.flatMap((candidate) => (isNonBlank(candidate.id) ? [[candidate.id, candidate]] : [])),
  );
  const sliceIds = slices.flatMap((candidate) => (isNonBlank(candidate.id) ? [candidate.id] : []));
  if (new Set(sliceIds).size !== sliceIds.length) {
    return { status: 'invalid', message: 'contains duplicate slice ids.' };
  }
  const ids = new Set<string>();
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (candidate: { readonly id?: string } & PlanSliceRequestShape): string | undefined => {
    if (!isNonBlank(candidate.id) || visited.has(candidate.id)) return undefined;
    if (visiting.has(candidate.id)) return `has a cyclic slice dependency at ${candidate.id}.`;
    if (
      (candidate.depends_on !== undefined &&
        (!Array.isArray(candidate.depends_on) || !candidate.depends_on.every(isNonBlank))) ||
      (candidate.derived_from !== undefined &&
        (!Array.isArray(candidate.derived_from) || !candidate.derived_from.every(isNonBlank)))
    ) {
      return `has malformed dependency or requirement references at ${candidate.id}.`;
    }
    if (
      new Set(candidate.depends_on ?? []).size !== (candidate.depends_on ?? []).length ||
      new Set(candidate.derived_from ?? []).size !== (candidate.derived_from ?? []).length
    ) {
      return `has duplicate dependency or requirement references at ${candidate.id}.`;
    }
    visiting.add(candidate.id);
    for (const dependencyId of candidate.depends_on ?? []) {
      const dependency = byId.get(dependencyId);
      if (!dependency) return `depends on unknown slice ${dependencyId}.`;
      const error = visit(dependency);
      if (error) return error;
    }
    for (const requirementId of candidate.derived_from ?? []) {
      if (isNonBlank(requirementId)) ids.add(requirementId);
    }
    visiting.delete(candidate.id);
    visited.add(candidate.id);
    return undefined;
  };

  const error = visit(slice);
  return error ? { status: 'invalid', message: error } : { status: 'ok', ids: Array.from(ids) };
}

function isNonBlank(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function prepareIsolatedSlice(args: {
  readonly runId: string;
  readonly sliceId: string;
  readonly epicId?: string;
  readonly runWorktreeDir: string;
  readonly sliceWorktreeDir: string;
  readonly requestPath: string;
  readonly requestContext?: SliceRequestContext;
  readonly publicPacket?: PublicPacketMaterialization;
  readonly gitSliceIntegration: GitSliceIntegrationPort;
  readonly recordReport: SliceReportRecorder;
}) {
  const workspace = await args.gitSliceIntegration.prepare({
    runWorktreeDir: args.runWorktreeDir,
    sliceWorktreeDir: args.sliceWorktreeDir,
    sliceId: args.sliceId,
  });
  if (workspace.status === 'failed') return workspace;
  let packetEffects: Awaited<ReturnType<typeof materializePublicPacket>> = [];
  try {
    if (args.publicPacket) {
      packetEffects = await materializePublicPacket({
        packet: args.publicPacket,
        sliceWorktreeDir: args.sliceWorktreeDir,
      });
    }
    await mkdir(dirname(args.requestPath), { recursive: true });
    await writeFile(
      args.requestPath,
      `${JSON.stringify(
        {
          runId: args.runId,
          sliceId: args.sliceId,
          ...(args.epicId === undefined ? {} : { epicId: args.epicId }),
          action: 'execute_slice',
          status: 'requested',
          ...args.requestContext,
        },
        null,
        2,
      )}\n`,
      'utf8',
    );
  } catch (error) {
    throw new IsolatedSliceOperationError(thrownSliceEffectReason('slice_artifact_write_failed', error));
  }
  await args.recordReport({
    event: 'slice_execution_requested',
    runId: args.runId,
    ...(args.epicId === undefined ? {} : { epicId: args.epicId }),
    sliceId: args.sliceId,
    status: 'slice_execution_requested',
  });
  return { ...workspace, sideEffects: [...workspace.sideEffects, ...packetEffects] };
}

export async function runIsolatedAgentAttempt(args: {
  readonly runId: string;
  readonly sliceId: string;
  readonly epicId?: string;
  readonly worktreeDir: string;
  readonly requestPath: string;
  readonly resultPath: string;
  readonly streamPath: string;
  readonly cycle: number;
  readonly attempt: number;
  readonly artifactAttempt: number;
  readonly repairContext?: ActiveSliceRepairContext;
  readonly repairContextAuthority?: AgentRepairContextAuthority;
  readonly agentRunner: AgentRunnerPort;
  readonly runtime?: AgentRunnerRuntime;
  readonly recordReport: SliceReportRecorder;
  readonly onUpdate?: (event: AgentStreamEvent) => void;
}): Promise<{
  readonly result: AgentRunResult;
  readonly outcome: IsolatedAttemptOutcome;
  readonly wroteStream: boolean;
}> {
  let sequence = 0;
  let wroteStream = false;
  let streamQueue = Promise.resolve();
  const result = await args.agentRunner.run({
    worktreeDir: args.worktreeDir,
    requestPath: args.requestPath,
    resultPath: args.resultPath,
    runId: args.runId,
    ...(args.epicId === undefined ? {} : { epicId: args.epicId }),
    sliceId: args.sliceId,
    cycle: args.cycle,
    ...(args.repairContext === undefined ? {} : { repairContext: args.repairContext }),
    ...(args.repairContextAuthority === undefined
      ? {}
      : { repairContextAuthority: args.repairContextAuthority }),
    ...(args.runtime ? { runtime: args.runtime } : {}),
    onUpdate: (update) => {
      const event = {
        event: 'agent_stream' as const,
        runId: args.runId,
        ...(args.epicId === undefined ? {} : { epicId: args.epicId }),
        sliceId: args.sliceId,
        sequence: sequence++,
        kind: update.kind,
        message: update.message,
      };
      const write = streamQueue.then(async () => {
        const persisted = await appendRunOrderedStreamEvent({ streamPath: args.streamPath, event });
        wroteStream = true;
        try {
          args.onUpdate?.(persisted);
        } catch {
          // Observer failures never affect execution.
        }
      });
      streamQueue = write.catch(() => undefined);
      return write;
    },
  });
  await streamQueue;
  if (result.status === 'completed') {
    await args.recordReport({
      event: 'slice_agent_result',
      runId: args.runId,
      ...(args.epicId === undefined ? {} : { epicId: args.epicId }),
      sliceId: args.sliceId,
      cycle: args.cycle,
      artifactAttempt: args.artifactAttempt,
      status: 'completed',
      ...(result.summary ? { summary: result.summary } : {}),
    });
  }
  return {
    result,
    outcome: classifyIsolatedAttempt({
      stage: 'agent',
      sliceId: args.sliceId,
      cycle: args.cycle,
      attempt: args.attempt,
      artifactAttempt: args.artifactAttempt,
      result,
    }),
    wroteStream,
  };
}

export async function runIsolatedVerifyAttempt(args: {
  readonly runId: string;
  readonly sliceId: string;
  readonly epicId?: string;
  readonly worktreeDir: string;
  readonly streamPath: string;
  readonly cycle: number;
  readonly attempt: number;
  readonly artifactAttempt: number;
  readonly testRunner: TestRunnerPort;
  readonly executionActions?: ResolvedExecutionActions;
  readonly verifyTarget?: VerifyTarget;
  readonly signal?: AbortSignal;
  readonly recordReport: SliceReportRecorder;
  readonly onUpdate?: (event: VerifyStreamEvent) => void;
}): Promise<{
  readonly result: TestRunResult;
  readonly outcome: IsolatedAttemptOutcome;
  readonly wroteStream: boolean;
  readonly diagnostics: {
    readonly stdout: SliceRepairDiagnostic;
    readonly stderr: SliceRepairDiagnostic;
  };
}> {
  let sequence = 0;
  let wroteStream = false;
  let stdout = '';
  let stderr = '';
  let stdoutTruncated = false;
  let stderrTruncated = false;
  const result = await args.testRunner.run({
    worktreeDir: args.worktreeDir,
    ...(args.executionActions ? { executionActions: args.executionActions } : {}),
    ...(args.verifyTarget ? { verifyTarget: args.verifyTarget } : {}),
    ...(args.signal ? { signal: args.signal } : {}),
    onUpdate: async (update) => {
      if (update.kind === 'stdout') {
        ({ text: stdout, truncated: stdoutTruncated } = appendBoundedDiagnostic(
          stdout,
          stdoutTruncated,
          update.message,
        ));
      } else if (update.kind === 'stderr') {
        ({ text: stderr, truncated: stderrTruncated } = appendBoundedDiagnostic(
          stderr,
          stderrTruncated,
          update.message,
        ));
      }
      const event = {
        event: 'verify_stream' as const,
        runId: args.runId,
        ...(args.epicId === undefined ? {} : { epicId: args.epicId }),
        sliceId: args.sliceId,
        sequence: sequence++,
        kind: update.kind,
        message: update.message,
      };
      const persisted = await appendRunOrderedStreamEvent({ streamPath: args.streamPath, event });
      wroteStream = true;
      try {
        args.onUpdate?.(persisted);
      } catch {
        // Observer failures never affect execution.
      }
    },
  });
  if (result.status === 'completed') {
    await args.recordReport({
      event: 'slice_test_result',
      runId: args.runId,
      ...(args.epicId === undefined ? {} : { epicId: args.epicId }),
      sliceId: args.sliceId,
      cycle: args.cycle,
      artifactAttempt: args.artifactAttempt,
      status: result.verdict,
      exitCode: result.exitCode,
      ...(result.target ? { target: result.target } : {}),
      ...(result.actions ? { actions: result.actions } : {}),
    });
  }
  return {
    result,
    outcome: classifyIsolatedAttempt({
      stage: 'verify',
      sliceId: args.sliceId,
      cycle: args.cycle,
      attempt: args.attempt,
      artifactAttempt: args.artifactAttempt,
      result,
    }),
    wroteStream,
    diagnostics: {
      stdout: {
        text: stdout,
        utf8Bytes: Buffer.byteLength(stdout, 'utf8'),
        truncated: stdoutTruncated,
      },
      stderr: {
        text: stderr,
        utf8Bytes: Buffer.byteLength(stderr, 'utf8'),
        truncated: stderrTruncated,
      },
    },
  };
}

export async function integrateIsolatedSlice(args: {
  readonly runId: string;
  readonly sliceId: string;
  readonly epicId?: string;
  readonly runWorktreeDir: string;
  readonly sliceWorktreeDir: string;
  readonly baseSha: string;
  readonly gitSliceIntegration: GitSliceIntegrationPort;
  readonly recordReport: SliceReportRecorder;
}) {
  const result = await args.gitSliceIntegration.integrate({
    runWorktreeDir: args.runWorktreeDir,
    sliceWorktreeDir: args.sliceWorktreeDir,
    sliceId: args.sliceId,
    baseSha: args.baseSha,
  });
  if (result.status !== 'integrated') {
    const status = result.status === 'conflict' ? 'slice_integration_conflict' : 'slice_integration_failed';
    await args.recordReport({
      event: status,
      runId: args.runId,
      ...(args.epicId === undefined ? {} : { epicId: args.epicId }),
      sliceId: args.sliceId,
      status,
      message: result.message,
    });
    return result;
  }
  await args.recordReport({
    event: 'slice_integrated',
    runId: args.runId,
    ...(args.epicId === undefined ? {} : { epicId: args.epicId }),
    sliceId: args.sliceId,
    status: 'slice_integrated',
    sliceCommitSha: result.sliceCommitSha,
    integrationCommitSha: result.integrationCommitSha,
  });
  return result;
}

export function sliceCompletionReport(args: {
  readonly runId: string;
  readonly sliceId: string;
  readonly epicId?: string;
}): Record<string, unknown> {
  return {
    event: 'slice_completed',
    runId: args.runId,
    ...(args.epicId === undefined ? {} : { epicId: args.epicId }),
    sliceId: args.sliceId,
    status: 'slice_completed',
  };
}

export function sliceAttemptDisposition(attempt: number): 'retry' | 'exhausted' {
  return attempt < MAX_STAGE_ATTEMPTS ? 'retry' : 'exhausted';
}

function classifyIsolatedAttempt(args: {
  readonly stage: SliceRepairStage;
  readonly sliceId: string;
  readonly cycle: number;
  readonly attempt: number;
  readonly artifactAttempt: number;
  readonly result: AgentRunResult | TestRunResult;
}): IsolatedAttemptOutcome {
  if (args.result.status === 'failed') {
    const status = sliceAttemptDisposition(args.attempt);
    const reason = args.stage === 'agent' ? 'agent_run_failed' : 'test_run_failed';
    return {
      status,
      reason,
      message: args.result.message,
      transitionId:
        status === 'retry'
          ? sliceRepairTopology.attemptRetryTransitionId(args.stage, args.sliceId, args.cycle, args.attempt)
          : sliceRepairTopology.attemptExhaustedTransitionId(args.stage, args.sliceId, args.cycle),
      ...(status === 'exhausted'
        ? {
            historyDelta: attemptHistory({
              sliceId: args.sliceId,
              stage: args.stage,
              cycle: args.cycle,
              outcome: 'exhausted',
              attempts: args.attempt,
              artifactAttempt: args.artifactAttempt,
            }),
          }
        : {}),
      fact: {
        step: args.stage === 'agent' ? 'agent_result' : 'test_result',
        attempt: args.attempt,
        reason,
      },
    };
  }
  const transitionId = sliceRepairTopology.attemptSuccessTransitionId(
    args.stage,
    args.sliceId,
    args.cycle,
    args.attempt,
  );
  const verdict = args.stage === 'verify' && 'verdict' in args.result ? args.result.verdict : undefined;
  const historyDelta = attemptHistory({
    sliceId: args.sliceId,
    stage: args.stage,
    cycle: args.cycle,
    outcome: 'succeeded',
    attempts: args.attempt,
    artifactAttempt: args.artifactAttempt,
    ...(verdict === undefined ? {} : { verdict }),
  });
  if (args.stage === 'verify' && 'verdict' in args.result && args.result.verdict !== 'passed') {
    return {
      status: 'verification_failed',
      reason: 'slice_verification_not_passed',
      transitionId,
      verdictTransitionId: sliceRepairTopology.verifyVerdictTransitionId(
        'failed',
        args.sliceId,
        args.cycle,
        args.attempt,
      ),
      historyDelta,
    };
  }
  return {
    status: 'succeeded',
    transitionId,
    ...(verdict === undefined
      ? {}
      : {
          verdictTransitionId: sliceRepairTopology.verifyVerdictTransitionId(
            'passed',
            args.sliceId,
            args.cycle,
            args.attempt,
          ),
        }),
    historyDelta,
  };
}

function attemptHistory(args: {
  readonly sliceId: string;
  readonly stage: SliceRepairStage;
  readonly cycle: number;
  readonly outcome: 'succeeded' | 'exhausted';
  readonly attempts: number;
  readonly artifactAttempt: number;
  readonly verdict?: 'passed' | 'failed';
}): SliceRepairHistoryDelta {
  const start = args.artifactAttempt - args.attempts + 1;
  return {
    sliceId: args.sliceId,
    cycle: args.cycle,
    epoch: {
      stage: args.stage,
      outcome: args.outcome,
      attempts: args.attempts,
      artifactOrdinalStart: start,
      artifactOrdinalEnd: args.artifactAttempt,
      ...(args.verdict === undefined ? {} : { verdict: args.verdict }),
    },
  };
}

export function mergeAttemptHistory(
  left: SliceRepairHistory | undefined,
  delta: SliceRepairHistoryDelta | undefined,
): SliceRepairHistory {
  if (!delta) return left ?? {};
  return sliceRepairProtocol.appendEpoch({
    history: left,
    sliceId: delta.sliceId,
    cycle: delta.cycle,
    epoch: delta.epoch,
    policy: sliceRepairProtocol.policy,
  });
}

function appendBoundedDiagnostic(
  current: string,
  alreadyTruncated: boolean,
  addition: string,
): { readonly text: string; readonly truncated: boolean } {
  if (alreadyTruncated) return { text: current, truncated: true };
  const bounded = sliceRepairProtocol.boundedDiagnostic(current + addition);
  return { text: bounded.text, truncated: bounded.truncated };
}

export function thrownSliceEffectReason(kind: string, error: unknown): string {
  return `${kind}: ${error instanceof Error ? error.message : 'unknown error'}`;
}

export type IsolatedSliceFailureStep = Extract<
  ReadyStep['kind'],
  'slice_execute' | 'agent_result' | 'test_result'
>;
