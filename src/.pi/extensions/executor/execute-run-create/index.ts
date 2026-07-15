import { dirname } from 'node:path';

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type, type Static } from 'typebox';

import { isExecutionContract } from '../../../../executor/execution-contract.js';
import { petriEventsPath } from '../../../../executor/petri-events.js';
import { petriPlanSnapshotPath } from '../../../../executor/petri-plan-snapshot.js';
import { petriNetPath, petriSdcpnPath, preparePetriObservation } from '../../../../executor/petri.js';
import { planFilePath, readPlanFilePayload } from '../../../../executor/plan-file.js';
import {
  runExecutionActive,
  withRunExecutionAuthority,
} from '../../../../executor/run-execution-authority.js';
import {
  createRun,
  readRunMetadata,
  runMetadataPath,
  type RunCreateResult,
} from '../../../../executor/run.js';
import { BRUNCH_EXECUTE_RUN_CREATE_TOOL } from '../../../../session/schema/tool-names.js';
import type { GraphReaders } from '../../brunch-data/graph/index.js';
import { defineBrunchTool } from '../../shared/define-brunch-tool.js';
import { toolParameters } from '../../shared/tool-schema.js';
import { buildCurrentProjectionForSpec } from '../current-projection.js';

export { BRUNCH_EXECUTE_RUN_CREATE_TOOL } from '../../../../session/schema/tool-names.js';

const ExecuteRunCreateParams = Type.Object({
  runId: Type.Optional(
    Type.String({ description: 'Optional deterministic run id. Defaults to a generated id.' }),
  ),
});

type ExecuteRunCreateParams = Static<typeof ExecuteRunCreateParams>;

interface ExecuteRunCreateDetails {
  readonly result:
    | RunCreateResult
    | { readonly status: 'execution_contract_blocked'; readonly reasons: readonly string[] };
  readonly sideEffects: readonly { readonly kind: string; readonly path?: string }[];
}

export interface ExecuteRunCreateDeps {
  readonly specId: number;
  readonly reads: Pick<GraphReaders, 'queryGraph'>;
}

export function createExecuteRunCreateTool(deps: ExecuteRunCreateDeps) {
  return defineBrunchTool<typeof ExecuteRunCreateParams, ExecuteRunCreateDetails>({
    name: BRUNCH_EXECUTE_RUN_CREATE_TOOL,
    label: 'execute_run_create',
    description:
      'Create a cook run plus its immutable plan/Petrinaut observer snapshot. Does not create a worktree or execute slices.',
    parameters: toolParameters(ExecuteRunCreateParams),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const cwd = ctx?.cwd;
      if (typeof cwd !== 'string' || cwd.trim().length === 0) {
        throw new Error('execute_run_create requires an active cwd');
      }
      // The persisted plan is the sole mode authority (D130-L); the workspace
      // substrate derives from it, so contradictory combinations are unrepresentable.
      const plan = await readPlanFilePayload({ cwd, specId: String(deps.specId) });
      const mode = plan?.mode;
      const { current } = await buildCurrentProjectionForSpec({
        cwd,
        specId: deps.specId,
        reads: deps.reads,
        mode,
      });
      if (plan === undefined) {
        return toolResult(
          {
            status: 'missing_plan',
            runStatus: 'not_started',
            planPath: planFilePath(cwd, String(deps.specId)),
            sideEffects: [],
          },
          current.source.graphLsn,
          [],
        );
      }
      const admission = admitExecutionContract(plan?.execution_contract);
      if (admission.status === 'rejected') {
        return {
          content: [
            {
              type: 'text' as const,
              text: [
                'execute_run_create: execution_contract_blocked',
                ...admission.reasons.map((reason) => `- ${reason}`),
                'No run artifacts were created. Resolve the contract before creating a run.',
              ].join('\n'),
            },
          ],
          details: {
            result: { status: 'execution_contract_blocked', reasons: admission.reasons },
            sideEffects: [],
          },
        };
      }
      const runId = params.runId ?? `run-${Date.now().toString(36)}`;
      return withRunExecutionAuthority({
        cwd,
        runId,
        onContended: async () => {
          const metadata = await readRunMetadata(runMetadataPath(cwd, runId));
          return toolResult(
            runExecutionActive(runId, metadata?.status ?? 'not_started'),
            current.source.graphLsn,
            [],
          );
        },
        execute: async () => {
          const result = await createRun({
            cwd,
            specId: String(deps.specId),
            current,
            runId,
            ...(mode ? { mode } : {}),
            substrate: mode === 'greenfield' ? 'empty_dir' : 'git_worktree',
            verifyTarget: admission.verifyTarget,
          });
          const observerSideEffects =
            result.status === 'created'
              ? await preparePetriObservation({ cwd, runId: result.runId }).then(() => [
                  { kind: 'mkdir', path: dirname(petriNetPath(cwd, result.runId)) },
                  { kind: 'write_file', path: petriPlanSnapshotPath(cwd, result.runId) },
                  { kind: 'write_file', path: petriNetPath(cwd, result.runId) },
                  { kind: 'write_file', path: petriSdcpnPath(cwd, result.runId) },
                  { kind: 'write_file', path: petriEventsPath(cwd, result.runId) },
                ])
              : [];
          return toolResult(result, current.source.graphLsn, [...result.sideEffects, ...observerSideEffects]);
        },
      });
    },
  });
}

function toolResult(result: RunCreateResult, graphLsn: number, sideEffects: readonly { kind: string }[]) {
  return {
    content: [
      {
        type: 'text' as const,
        text: [
          `execute_run_create: ${result.status}`,
          `run status: ${result.runStatus}`,
          'planPath' in result ? `plan path: ${result.planPath}` : undefined,
          `graph lsn: ${graphLsn}`,
          `side effects: ${sideEffects.map((effect) => effect.kind).join(', ') || 'none'}`,
        ]
          .filter((line): line is string => typeof line === 'string')
          .join('\n'),
      },
    ],
    details: { result, sideEffects },
  };
}

function admitExecutionContract(
  contract: unknown,
):
  | { readonly status: 'admitted'; readonly verifyTarget: { command: string; args: readonly string[] } }
  | { readonly status: 'rejected'; readonly reasons: readonly string[] } {
  if (contract === undefined) {
    return {
      status: 'rejected',
      reasons: ['the persisted plan contains no execution contract'],
    };
  }
  if (!isExecutionContract(contract)) {
    return {
      status: 'rejected',
      reasons: ['the persisted plan execution contract is malformed'],
    };
  }
  const reasons = [
    ...contract.blocked.map(
      (entry) => `blocked capability ${entry.id} (${entry.reason}); no execution path exists for it`,
    ),
    ...contract.conflicts.map((conflict) => conflict.message),
    ...(contract.resolvedActions.verify.length === 0 && contract.blocked.length === 0
      ? ['the admitted plan resolves no verification action']
      : []),
  ];
  if (reasons.length > 0) return { status: 'rejected', reasons };
  // ceiling: one run-wide verify target; per-scope/per-epic verify sequences arrive with
  // the FE-1197 slice B/C polyglot boundary work.
  const action = contract.resolvedActions.verify[0]!;
  return { status: 'admitted', verifyTarget: { command: action.command, args: action.args } };
}

export function registerBrunchExecuteRunCreate(pi: ExtensionAPI, deps: ExecuteRunCreateDeps): void {
  pi.registerTool(createExecuteRunCreateTool(deps) as never);
}

export default registerBrunchExecuteRunCreate;
