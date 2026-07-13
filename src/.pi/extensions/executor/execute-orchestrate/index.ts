import type { ExtensionAPI, ToolDefinition } from '@earendil-works/pi-coding-agent';
import { Type, type Static } from 'typebox';

import type { AgentStreamEvent } from '../../../../executor/agent-result.js';
import type { ExecutionPorts } from '../../../../executor/execution-ports.js';
import { readRunDetail } from '../../../../executor/observer-read.js';
import {
  drive,
  frontierFiringPolicy,
  petriScheduler,
  type DriveOutcome,
  type DriveStepProgress,
} from '../../../../executor/orchestrate.js';
import type { VerifyStreamEvent } from '../../../../executor/test-result.js';
import {
  executeRunProductUpdateHintsFromDetail,
  executeRunProductUpdates,
  type ProductUpdatePublisher,
} from '../../../../rpc/product-updates.js';
import { BRUNCH_EXECUTE_ORCHESTRATE_TOOL } from '../../../../session/schema/tool-names.js';
import { toolParameters } from '../../shared/tool-schema.js';
import { renderExecuteOrchestrateResult } from '../rendering.js';

export { BRUNCH_EXECUTE_ORCHESTRATE_TOOL } from '../../../../session/schema/tool-names.js';

const ExecuteOrchestrateParams = Type.Object({
  runId: Type.String({ description: 'Run id to drive to completion.' }),
});

type ExecuteOrchestrateParams = Static<typeof ExecuteOrchestrateParams>;

interface ExecuteOrchestrateDetails {
  readonly outcome?: DriveOutcome;
  readonly progress?: {
    readonly runId: string;
    readonly step: string;
    readonly phase: 'started' | 'completed';
    readonly fromStatus: string;
    readonly runStatus: string;
    readonly activeEpicId?: string;
    readonly activeSliceId?: string;
    readonly completedSliceIds?: readonly string[];
  };
  readonly agentStream?: AgentStreamEvent;
  readonly verifyStream?: VerifyStreamEvent;
}

export interface ExecuteOrchestrateDeps {
  /** When present, each intra-drive step advance publishes run-scoped brunch.updated hints. */
  readonly productUpdates?: ProductUpdatePublisher;
}

export function createExecuteOrchestrateTool(
  ports: ExecutionPorts,
  deps?: ExecuteOrchestrateDeps,
): ToolDefinition<typeof ExecuteOrchestrateParams, ExecuteOrchestrateDetails> {
  return {
    name: BRUNCH_EXECUTE_ORCHESTRATE_TOOL,
    label: 'execute_orchestrate',
    description:
      'Drive an executor run end-to-end to promotion_prepared (run-local land) by advancing each lifecycle step the scheduler reports ready. Halts without advancing if a step cannot execute. Does not perform host promotion/land.',
    parameters: toolParameters(ExecuteOrchestrateParams),
    renderResult(result, options, theme, context) {
      return renderExecuteOrchestrateResult(result, options, theme as never, context);
    },
    async execute(_toolCallId, params, _signal, onUpdate, ctx) {
      const cwd = ctx?.cwd;
      if (typeof cwd !== 'string' || cwd.trim().length === 0) {
        throw new Error('execute_orchestrate requires an active cwd');
      }
      const publisher = deps?.productUpdates;
      const publishRunUpdate = async (): Promise<void> => {
        if (!publisher) return;
        const detail = await readRunDetail(cwd, params.runId).catch(() => undefined);
        const readableDetail = detail && !('unreadable' in detail) ? detail : undefined;
        const hints = readableDetail ? executeRunProductUpdateHintsFromDetail(readableDetail) : undefined;
        publisher.publish(executeRunProductUpdates(params.runId, hints));
      };
      let pendingRunUpdate = Promise.resolve();
      const queueRunUpdate = (): void => {
        if (!publisher) return;
        pendingRunUpdate = pendingRunUpdate.then(async () => {
          await publishRunUpdate();
        });
      };
      let latestProgress: ExecuteOrchestrateDetails['progress'];
      let latestAgentStream: ExecuteOrchestrateDetails['agentStream'];
      let latestVerifyStream: ExecuteOrchestrateDetails['verifyStream'];
      const progressBySlice = new Map<string, NonNullable<ExecuteOrchestrateDetails['progress']>>();
      const agentStreamBySlice = new Map<string, AgentStreamEvent>();
      const verifyStreamBySlice = new Map<string, VerifyStreamEvent>();
      const progressStepStreams = (
        stepKind: string,
        sliceId?: string,
      ): Pick<ExecuteOrchestrateDetails, 'agentStream' | 'verifyStream'> => {
        if (stepKind === 'agent_result') {
          const stream = sliceId ? agentStreamBySlice.get(sliceId) : latestAgentStream;
          return stream ? { agentStream: stream } : {};
        }
        if (stepKind === 'test_result') {
          const stream = sliceId ? verifyStreamBySlice.get(sliceId) : latestVerifyStream;
          return stream ? { verifyStream: stream } : {};
        }
        return {};
      };
      const emitProgress = (progress: DriveStepProgress): void => {
        latestProgress = {
          runId: params.runId,
          step: progress.step.kind,
          phase: progress.phase,
          fromStatus: progress.fromStatus,
          runStatus: progress.runStatus,
          ...(progress.activeEpicId ? { activeEpicId: progress.activeEpicId } : {}),
          ...(progress.activeSliceId ? { activeSliceId: progress.activeSliceId } : {}),
          completedSliceIds: progress.completedSliceIds,
        };
        if (progress.activeSliceId) progressBySlice.set(progress.activeSliceId, latestProgress);
        const sliceLine = progress.activeSliceId
          ? [
              `slice: ${progress.activeSliceId}`,
              ...(progress.activeEpicId ? [`epic: ${progress.activeEpicId}`] : []),
            ]
          : [];
        const stepLine =
          progress.phase === 'started'
            ? `execute_orchestrate: ${progress.step.kind} started from ${progress.fromStatus}`
            : `execute_orchestrate: ${progress.step.kind} -> ${progress.runStatus}`;
        onUpdate?.({
          content: [
            {
              type: 'text' as const,
              text: [
                stepLine,
                `run id: ${params.runId}`,
                `phase: ${progress.phase}`,
                `from status: ${progress.fromStatus}`,
                `run status: ${progress.runStatus}`,
                ...sliceLine,
                `completed slices: ${progress.completedSliceIds.length}`,
              ].join('\n'),
            },
          ],
          details: {
            progress: latestProgress,
            ...progressStepStreams(progress.step.kind, progress.activeSliceId),
          },
        });
      };
      const emitAgentUpdate = (event: AgentStreamEvent): void => {
        queueRunUpdate();
        latestAgentStream = event;
        agentStreamBySlice.set(event.sliceId, event);
        const progress = progressBySlice.get(event.sliceId) ?? latestProgress;
        onUpdate?.({
          content: [
            {
              type: 'text' as const,
              text: [
                `execute_orchestrate: worker ${event.kind}`,
                `run id: ${event.runId}`,
                `slice: ${event.sliceId}`,
                ...(event.epicId === undefined ? [] : [`epic: ${event.epicId}`]),
                `sequence: ${event.sequence}`,
                event.message,
              ].join('\n'),
            },
          ],
          details: {
            ...(progress ? { progress } : {}),
            agentStream: event,
          },
        });
      };
      const emitVerifyUpdate = (event: VerifyStreamEvent): void => {
        queueRunUpdate();
        latestVerifyStream = event;
        verifyStreamBySlice.set(event.sliceId, event);
        const progress = progressBySlice.get(event.sliceId) ?? latestProgress;
        onUpdate?.({
          content: [
            {
              type: 'text' as const,
              text: [
                `execute_orchestrate: verify ${event.kind}`,
                `run id: ${event.runId}`,
                `slice: ${event.sliceId}`,
                ...(event.epicId === undefined ? [] : [`epic: ${event.epicId}`]),
                `sequence: ${event.sequence}`,
                event.message,
              ].join('\n'),
            },
          ],
          details: {
            ...(progress ? { progress } : {}),
            verifyStream: event,
          },
        });
      };
      const outcome = await drive(
        {
          cwd,
          runId: params.runId,
          ports,
          onStepStart: (_step, _runStatus, progress) => {
            queueRunUpdate();
            emitProgress(progress);
          },
          onStepComplete: (_step, _runStatus, progress) => {
            queueRunUpdate();
            emitProgress(progress);
          },
          onAgentUpdate: emitAgentUpdate,
          onVerifyUpdate: emitVerifyUpdate,
          runtime: {
            ...(ctx.modelRegistry ? { modelRegistry: ctx.modelRegistry } : {}),
            ...(ctx.model ? { model: ctx.model } : {}),
            ...(_signal ? { signal: _signal } : {}),
          },
          ...(_signal ? { signal: _signal } : {}),
        },
        petriScheduler,
        frontierFiringPolicy,
      );
      await pendingRunUpdate;
      await publishRunUpdate();
      return {
        content: [
          {
            type: 'text' as const,
            text: [
              `execute_orchestrate: ${outcome.status}`,
              `run status: ${'runStatus' in outcome ? outcome.runStatus : 'not_started'}`,
              `run id: ${params.runId}`,
              ...(outcome.status === 'halted' ? [`halted at: ${outcome.step} (${outcome.reason})`] : []),
            ].join('\n'),
          },
        ],
        details: {
          outcome,
          ...(latestProgress ? { progress: latestProgress } : {}),
          ...(latestAgentStream ? { agentStream: latestAgentStream } : {}),
          ...(latestVerifyStream ? { verifyStream: latestVerifyStream } : {}),
        },
      };
    },
  };
}

export function registerBrunchExecuteOrchestrate(
  pi: ExtensionAPI,
  ports: ExecutionPorts,
  deps?: ExecuteOrchestrateDeps,
): void {
  pi.registerTool(createExecuteOrchestrateTool(ports, deps) as never);
}

export default registerBrunchExecuteOrchestrate;
