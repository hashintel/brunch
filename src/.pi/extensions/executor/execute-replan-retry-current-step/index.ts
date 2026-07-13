import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type, type Static } from 'typebox';

import type { ExecutionPorts } from '../../../../executor/execution-ports.js';
import {
  drive,
  linearScheduler,
  serialFiringPolicy,
  type DriveOutcome,
} from '../../../../executor/orchestrate.js';
import {
  assessRunRetryEligibility,
  type RunRetryEligibilityResult,
} from '../../../../executor/run-retry-eligibility.js';
import { resetActiveSliceAttempts, type RunMetadataWriteEffect } from '../../../../executor/run.js';
import { BRUNCH_EXECUTE_REPLAN_RETRY_CURRENT_STEP_TOOL } from '../../../../session/schema/tool-names.js';
import type { GraphReaders } from '../../brunch-data/graph/index.js';
import { defineBrunchTool } from '../../shared/define-brunch-tool.js';
import { toolParameters } from '../../shared/tool-schema.js';
import { buildCurrentProjectionForRun } from '../current-projection.js';

export { BRUNCH_EXECUTE_REPLAN_RETRY_CURRENT_STEP_TOOL } from '../../../../session/schema/tool-names.js';

const ExecuteReplanRetryCurrentStepParams = Type.Object({
  runId: Type.String({ description: 'Executor run id whose current ready step should be retried.' }),
  mode: Type.Optional(
    Type.Union([Type.Literal('greenfield'), Type.Literal('brownfield')], {
      description: 'Execution mode expected for the selected plan file. Defaults to greenfield.',
    }),
  ),
});

type ExecuteReplanRetryCurrentStepParams = Static<typeof ExecuteReplanRetryCurrentStepParams>;

type ExecuteReplanRetryCurrentStepResult =
  | {
      readonly status: 'retry_not_allowed';
      readonly eligibility: RunRetryEligibilityResult;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'retried_current_step';
      readonly eligibility: RunRetryEligibilityResult;
      readonly outcome: DriveOutcome;
      readonly sideEffects: readonly RunMetadataWriteEffect[];
    };

interface ExecuteReplanRetryCurrentStepDetails {
  readonly result: ExecuteReplanRetryCurrentStepResult;
  readonly sideEffects: readonly RunMetadataWriteEffect[];
}

export interface ExecuteReplanRetryCurrentStepDeps {
  readonly specId: number;
  readonly reads: Pick<GraphReaders, 'queryGraph'>;
}

export function createExecuteReplanRetryCurrentStepTool(
  ports: ExecutionPorts,
  deps: ExecuteReplanRetryCurrentStepDeps,
) {
  return defineBrunchTool<typeof ExecuteReplanRetryCurrentStepParams, ExecuteReplanRetryCurrentStepDetails>({
    name: BRUNCH_EXECUTE_REPLAN_RETRY_CURRENT_STEP_TOOL,
    label: 'execute_replan_retry_current_step',
    description:
      'Retry exactly one ready executor lifecycle step when the run is fresh and retry-eligible. Does not regenerate plans or drive the run to completion.',
    parameters: toolParameters(ExecuteReplanRetryCurrentStepParams),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const cwd = ctx?.cwd;
      if (typeof cwd !== 'string' || cwd.trim().length === 0) {
        throw new Error('execute_replan_retry_current_step requires an active cwd');
      }

      const { current } = await buildCurrentProjectionForRun({
        cwd,
        runId: params.runId,
        fallbackSpecId: deps.specId,
        reads: deps.reads,
        mode: params.mode,
      });
      const eligibility = await assessRunRetryEligibility({
        cwd,
        runId: params.runId,
        current,
      });

      let result: ExecuteReplanRetryCurrentStepResult;
      if (eligibility.status === 'retry_current_run') {
        const attemptResetEffect = await resetActiveSliceAttempts({ cwd, runId: params.runId });
        result = {
          status: 'retried_current_step',
          eligibility,
          outcome: await drive(
            {
              cwd,
              runId: params.runId,
              ports,
              runtime: {
                ...(ctx.modelRegistry ? { modelRegistry: ctx.modelRegistry } : {}),
                ...(ctx.model ? { model: ctx.model } : {}),
                ...(_signal ? { signal: _signal } : {}),
              },
              ...(_signal ? { signal: _signal } : {}),
            },
            linearScheduler,
            serialFiringPolicy,
            { maxFirings: 1 },
          ),
          sideEffects: attemptResetEffect === undefined ? [] : [attemptResetEffect],
        };
      } else {
        result = { status: 'retry_not_allowed', eligibility, sideEffects: [] };
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: [
              `execute_replan_retry_current_step: ${result.status}`,
              `eligibility: ${eligibility.status}`,
              `run status: ${eligibility.runStatus}`,
              'outcome' in result ? `drive outcome: ${result.outcome.status}` : undefined,
              'outcome' in result && 'runStatus' in result.outcome
                ? `outcome run status: ${result.outcome.runStatus}`
                : undefined,
              `graph lsn: ${current.source.graphLsn}`,
              'side effects: delegated to lifecycle step',
            ]
              .filter((line): line is string => typeof line === 'string')
              .join('\n'),
          },
        ],
        details: { result, sideEffects: result.sideEffects },
      };
    },
  });
}

export function registerBrunchExecuteReplanRetryCurrentStep(
  pi: ExtensionAPI,
  ports: ExecutionPorts,
  deps: ExecuteReplanRetryCurrentStepDeps,
): void {
  pi.registerTool(createExecuteReplanRetryCurrentStepTool(ports, deps) as never);
}

export default registerBrunchExecuteReplanRetryCurrentStep;
