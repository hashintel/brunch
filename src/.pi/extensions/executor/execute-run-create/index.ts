import type { ExtensionAPI, ToolDefinition } from '@earendil-works/pi-coding-agent';
import { Type, type Static } from 'typebox';

import { createRun, type RunCreateResult } from '../../../../executor/run.js';
import { BRUNCH_EXECUTE_RUN_CREATE_TOOL } from '../../../../session/schema/tool-names.js';
import type { GraphReaders } from '../../brunch-data/graph/index.js';
import { toolParameters } from '../../shared/tool-schema.js';
import { buildCurrentProjectionForSpec } from '../current-projection.js';

export { BRUNCH_EXECUTE_RUN_CREATE_TOOL } from '../../../../session/schema/tool-names.js';

const ExecuteRunCreateParams = Type.Object({
  runId: Type.Optional(
    Type.String({ description: 'Optional deterministic run id. Defaults to a generated id.' }),
  ),
  substrate: Type.Optional(
    Type.Union([Type.Literal('git_worktree'), Type.Literal('empty_dir')], {
      description: 'Run workspace substrate. Defaults to git_worktree for current compatibility.',
    }),
  ),
  verifyProfile: Type.Optional(
    Type.Union([Type.Literal('default'), Type.Literal('npm_test')], {
      description: 'Product-owned verify target profile. Defaults to default (npm run verify).',
    }),
  ),
  mode: Type.Optional(
    Type.Union([Type.Literal('greenfield'), Type.Literal('brownfield')], {
      description: 'Execution mode expected for the selected plan file. Defaults to greenfield.',
    }),
  ),
});

type ExecuteRunCreateParams = Static<typeof ExecuteRunCreateParams>;

interface ExecuteRunCreateDetails {
  readonly result: RunCreateResult;
  readonly sideEffects: RunCreateResult['sideEffects'];
}

export interface ExecuteRunCreateDeps {
  readonly specId: number;
  readonly reads: Pick<GraphReaders, 'queryGraph'>;
}

export function createExecuteRunCreateTool(
  deps: ExecuteRunCreateDeps,
): ToolDefinition<typeof ExecuteRunCreateParams, ExecuteRunCreateDetails> {
  return {
    name: BRUNCH_EXECUTE_RUN_CREATE_TOOL,
    label: 'execute_run_create',
    description:
      'Create metadata for a cook run from the selected spec plan. Does not create worktrees, Petri artifacts, or execute slices.',
    parameters: toolParameters(ExecuteRunCreateParams),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const cwd = ctx?.cwd;
      if (typeof cwd !== 'string' || cwd.trim().length === 0) {
        throw new Error('execute_run_create requires an active cwd');
      }
      const { current } = await buildCurrentProjectionForSpec({
        cwd,
        specId: deps.specId,
        reads: deps.reads,
        mode: params.mode,
      });
      const result = await createRun({
        cwd,
        specId: String(deps.specId),
        current,
        ...(params.runId ? { runId: params.runId } : {}),
        ...(params.substrate ? { substrate: params.substrate } : {}),
        ...verifyTargetForProfile(params.verifyProfile),
      });
      return {
        content: [
          {
            type: 'text' as const,
            text: [
              `execute_run_create: ${result.status}`,
              `run status: ${result.runStatus}`,
              'planPath' in result ? `plan path: ${result.planPath}` : undefined,
              `graph lsn: ${current.source.graphLsn}`,
              `side effects: ${result.sideEffects.map((effect) => effect.kind).join(', ') || 'none'}`,
            ]
              .filter((line): line is string => typeof line === 'string')
              .join('\n'),
          },
        ],
        details: { result, sideEffects: result.sideEffects },
      };
    },
  };
}

function verifyTargetForProfile(
  profile: ExecuteRunCreateParams['verifyProfile'],
): { readonly verifyTarget: { readonly command: string; readonly args: readonly string[] } } | {} {
  switch (profile) {
    case undefined:
    case 'default':
      return {};
    case 'npm_test':
      return { verifyTarget: { command: 'npm', args: ['test'] } };
  }
}

export function registerBrunchExecuteRunCreate(pi: ExtensionAPI, deps: ExecuteRunCreateDeps): void {
  pi.registerTool(createExecuteRunCreateTool(deps) as never);
}

export default registerBrunchExecuteRunCreate;
