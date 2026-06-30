import type { ExtensionAPI, ToolDefinition } from '@earendil-works/pi-coding-agent';
import { Type, type Static } from 'typebox';

import {
  projectExecutionSpecSnapshot,
  type ExecutionSpecSnapshot,
} from '../../../../orchestration/execution-spec-snapshot.js';
import { BRUNCH_EXECUTE_SNAPSHOT_TOOL } from '../../../../session/schema/tool-names.js';
import type { GraphReaders } from '../../brunch-data/graph/index.js';

export { BRUNCH_EXECUTE_SNAPSHOT_TOOL } from '../../../../session/schema/tool-names.js';

const ExecuteSnapshotParams = Type.Object({
  mode: Type.Optional(
    Type.Union([Type.Literal('greenfield'), Type.Literal('brownfield')], {
      description:
        'Execution mode carried onto the snapshot. Defaults to greenfield until spec mode is modeled on alpha.',
    }),
  ),
});

type ExecuteSnapshotParams = Static<typeof ExecuteSnapshotParams>;

interface ExecuteSnapshotDetails {
  readonly snapshot: ExecutionSpecSnapshot;
  readonly source: {
    readonly graphLsn: number;
    readonly visibility: 'active';
  };
  readonly sideEffects: readonly [];
}

export interface ExecuteSnapshotDeps {
  readonly specId: number;
  readonly reads: Pick<GraphReaders, 'queryGraph'>;
}

export function createExecuteSnapshotTool(
  deps: ExecuteSnapshotDeps,
): ToolDefinition<typeof ExecuteSnapshotParams, ExecuteSnapshotDetails> {
  return {
    name: BRUNCH_EXECUTE_SNAPSHOT_TOOL,
    label: 'execute_snapshot',
    description:
      'Project the selected specification graph into ExecutionSpecSnapshot v1. Side-effect free: reads graph truth only.',
    parameters: ExecuteSnapshotParams,
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      const graph = deps.reads.queryGraph(undefined, { visibility: 'active' });
      const snapshot = projectExecutionSpecSnapshot({
        specId: deps.specId,
        mode: params.mode ?? 'greenfield',
        nodes: graph.nodes,
        edges: graph.edges,
      });
      return {
        content: [
          {
            type: 'text' as const,
            text: [
              `execute_snapshot: spec ${snapshot.specId} (${snapshot.mode})`,
              `requirements: ${snapshot.requirements.length}`,
              `criteria: ${snapshot.criteria.length}`,
              `graph lsn: ${graph.lsn}`,
              'side effects: none',
            ].join('\n'),
          },
        ],
        details: {
          snapshot,
          source: { graphLsn: graph.lsn, visibility: 'active' },
          sideEffects: [],
        },
      };
    },
  };
}

export function registerBrunchExecuteSnapshot(pi: ExtensionAPI, deps: ExecuteSnapshotDeps): void {
  pi.registerTool(createExecuteSnapshotTool(deps) as never);
}

export default registerBrunchExecuteSnapshot;
