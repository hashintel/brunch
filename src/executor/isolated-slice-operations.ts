import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import type {
  AgentRunnerPort,
  AgentRunnerRuntime,
  AgentRunResult,
  GitSliceIntegrationPort,
  TestRunnerPort,
  TestRunResult,
  VerifyTarget,
} from './execution-ports.js';
import {
  attemptExhaustedTransitionId,
  attemptRetryTransitionId,
  attemptSuccessTransitionId,
  SLICE_ATTEMPT_LIMIT,
  type ReadyStep,
} from './orchestrate-topology.js';
import { populatedPlanPath } from './populate.js';
import { appendSliceAttemptCycle, type SliceAttemptHistory } from './run.js';
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
      readonly history: SliceAttemptHistory;
    }
  | {
      readonly status: 'verification_failed';
      readonly reason: 'slice_verification_not_passed';
      readonly transitionId: string;
      readonly history: SliceAttemptHistory;
    }
  | {
      readonly status: 'retry' | 'exhausted';
      readonly reason: 'agent_run_failed' | 'test_run_failed';
      readonly message: string;
      readonly transitionId: string;
      readonly history: SliceAttemptHistory;
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
  readonly scopeId?: string;
  readonly definition?: string;
  readonly criteria?: readonly { readonly kind: string; readonly target: string }[];
  readonly derivedFrom?: readonly string[];
  readonly designContext?: readonly { readonly itemId: string; readonly content: string }[];
  readonly verificationContext?: readonly { readonly itemId: string; readonly content: string }[];
  readonly instruction?: string;
}

interface PlanSliceRequestShape {
  readonly scope_id?: string;
  readonly definition?: string;
  readonly verification?: readonly { readonly kind?: string; readonly target?: string }[];
  readonly derived_from?: readonly string[];
  readonly design_context?: readonly { readonly item_id?: string; readonly content?: string }[];
  readonly verification_context?: readonly { readonly item_id?: string; readonly content?: string }[];
}

export async function readSliceRequestContext(args: {
  readonly cwd: string;
  readonly runId: string;
  readonly populatedPlanPath?: string;
  readonly sliceId: string;
}): Promise<
  | { readonly status: 'ok'; readonly requestContext: SliceRequestContext }
  | { readonly status: 'invalid'; readonly message: string }
> {
  const planPath = args.populatedPlanPath ?? populatedPlanPath(args.cwd, args.runId);
  let payload: {
    readonly scope_handoff_required?: boolean;
    readonly slices?: readonly ({ readonly id?: string } & PlanSliceRequestShape)[];
  };
  try {
    payload = JSON.parse(await readFile(planPath, 'utf8')) as typeof payload;
  } catch (error) {
    return {
      status: 'invalid',
      message: `Could not read populated plan for ${args.sliceId}: ${error instanceof Error ? error.message : String(error)}`,
    };
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
  if (payload.scope_handoff_required === true || typeof slice.scope_id === 'string') {
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
  return {
    status: 'ok',
    requestContext: {
      ...(typeof slice.scope_id === 'string' ? { scopeId: slice.scope_id } : {}),
      ...(isNonBlank(slice.definition) ? { definition: slice.definition } : {}),
      ...(Array.isArray(slice.verification) ? { criteria } : {}),
      ...(Array.isArray(slice.derived_from) ? { derivedFrom } : {}),
      ...(Array.isArray(slice.design_context) ? { designContext } : {}),
      ...(Array.isArray(slice.verification_context) ? { verificationContext } : {}),
      ...(criteria.length > 0
        ? { instruction: 'Make the minimum change that satisfies every criterion.' }
        : {}),
    },
  };
}

function isNonBlank(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export async function prepareIsolatedSlice(args: {
  readonly runId: string;
  readonly sliceId: string;
  readonly epicId?: string;
  readonly runWorktreeDir: string;
  readonly sliceWorktreeDir: string;
  readonly requestPath: string;
  readonly requestContext?: SliceRequestContext;
  readonly gitSliceIntegration: GitSliceIntegrationPort;
  readonly recordReport: SliceReportRecorder;
}) {
  const workspace = await args.gitSliceIntegration.prepare({
    runWorktreeDir: args.runWorktreeDir,
    sliceWorktreeDir: args.sliceWorktreeDir,
    sliceId: args.sliceId,
  });
  if (workspace.status === 'failed') return workspace;
  try {
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
  return workspace;
}

export async function runIsolatedAgentAttempt(args: {
  readonly runId: string;
  readonly sliceId: string;
  readonly epicId?: string;
  readonly worktreeDir: string;
  readonly requestPath: string;
  readonly resultPath: string;
  readonly streamPath: string;
  readonly attempt: number;
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
      status: 'completed',
      ...(result.summary ? { summary: result.summary } : {}),
    });
  }
  return {
    result,
    outcome: classifyIsolatedAttempt({
      stage: 'agent',
      sliceId: args.sliceId,
      attempt: args.attempt,
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
  readonly attempt: number;
  readonly testRunner: TestRunnerPort;
  readonly verifyTarget?: VerifyTarget;
  readonly signal?: AbortSignal;
  readonly recordReport: SliceReportRecorder;
  readonly onUpdate?: (event: VerifyStreamEvent) => void;
}): Promise<{
  readonly result: TestRunResult;
  readonly outcome: IsolatedAttemptOutcome;
  readonly wroteStream: boolean;
}> {
  let sequence = 0;
  let wroteStream = false;
  const result = await args.testRunner.run({
    worktreeDir: args.worktreeDir,
    ...(args.verifyTarget ? { verifyTarget: args.verifyTarget } : {}),
    ...(args.signal ? { signal: args.signal } : {}),
    onUpdate: async (update) => {
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
      status: result.verdict,
      exitCode: result.exitCode,
      ...(result.target ? { target: result.target } : {}),
    });
  }
  return {
    result,
    outcome: classifyIsolatedAttempt({
      stage: 'verify',
      sliceId: args.sliceId,
      attempt: args.attempt,
      result,
    }),
    wroteStream,
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
  return attempt < SLICE_ATTEMPT_LIMIT ? 'retry' : 'exhausted';
}

function classifyIsolatedAttempt(args: {
  readonly stage: 'agent' | 'verify';
  readonly sliceId: string;
  readonly attempt: number;
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
          ? attemptRetryTransitionId(args.stage, args.sliceId, args.attempt)
          : attemptExhaustedTransitionId(args.stage, args.sliceId),
      history:
        status === 'exhausted' ? attemptHistory(args.sliceId, args.stage, 'exhausted', args.attempt) : {},
      fact: {
        step: args.stage === 'agent' ? 'agent_result' : 'test_result',
        attempt: args.attempt,
        reason,
      },
    };
  }
  const transitionId = attemptSuccessTransitionId(args.stage, args.sliceId, args.attempt);
  const history = attemptHistory(args.sliceId, args.stage, 'succeeded', args.attempt);
  if (args.stage === 'verify' && 'verdict' in args.result && args.result.verdict !== 'passed') {
    return { status: 'verification_failed', reason: 'slice_verification_not_passed', transitionId, history };
  }
  return { status: 'succeeded', transitionId, history };
}

function attemptHistory(
  sliceId: string,
  stage: 'agent' | 'verify',
  outcome: 'succeeded' | 'exhausted',
  attempts: number,
): SliceAttemptHistory {
  return appendSliceAttemptCycle(
    { runId: '', specId: '', planPath: '', status: 'reports_initialized' },
    sliceId,
    stage,
    { outcome, attempts },
  );
}

export function mergeAttemptHistory(
  left: SliceAttemptHistory | undefined,
  right: SliceAttemptHistory,
): SliceAttemptHistory {
  const merged: Record<string, Record<string, readonly unknown[]>> = {};
  for (const history of [left ?? {}, right]) {
    for (const [sliceId, stages] of Object.entries(history)) {
      const target = merged[sliceId] ?? {};
      for (const [stage, cycles] of Object.entries(stages)) {
        target[stage] = [...(target[stage] ?? []), ...(cycles ?? [])];
      }
      merged[sliceId] = target;
    }
  }
  return merged as SliceAttemptHistory;
}

export function thrownSliceEffectReason(kind: string, error: unknown): string {
  return `${kind}: ${error instanceof Error ? error.message : 'unknown error'}`;
}

export type IsolatedSliceFailureStep = Extract<
  ReadyStep['kind'],
  'slice_execute' | 'agent_result' | 'test_result'
>;
