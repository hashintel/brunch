import { Type, type Static } from 'typebox';

import type { ExecutionSpecSnapshot } from '../../../../executor/execution-spec-snapshot.js';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import type { GraphReaders } from '../../brunch-data/graph/index.js';
import { BRUNCH_EXECUTE_SNAPSHOT_TOOL } from '../../../../session/schema/tool-names.js';
import { defineBrunchTool } from '../../shared/define-brunch-tool.js';
import { projectExecuteGraph } from '../../../../executor/execute-projection.js';
import { renderExecuteSnapshotResult } from '../rendering.js';
import { toolParameters } from '../../shared/tool-schema.js';

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

export function createExecuteSnapshotTool(deps: ExecuteSnapshotDeps) {
  return defineBrunchTool<typeof ExecuteSnapshotParams, ExecuteSnapshotDetails>({
    name: BRUNCH_EXECUTE_SNAPSHOT_TOOL,
    label: 'execute_snapshot',
    description:
      'Project the selected specification graph into ExecutionSpecSnapshot v1. Side-effect free: reads graph truth only.',
    parameters: toolParameters(ExecuteSnapshotParams),
    renderResult(result, options, theme, context) {
      return renderExecuteSnapshotResult(result, options, theme as never, context);
    },
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      const graph = deps.reads.queryGraph(undefined, { visibility: 'active' });
      const projection = projectExecuteGraph({
        specId: deps.specId,
        mode: params.mode ?? 'greenfield',
        graphLsn: graph.lsn,
        nodes: graph.nodes,
        edges: graph.edges,
      });
      const snapshot = projection.snapshot;
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
          source: projection.source,
          sideEffects: [],
        },
      };
    },
  });
}

export function registerBrunchExecuteSnapshot(pi: ExtensionAPI, deps: ExecuteSnapshotDeps): void {
  pi.registerTool(createExecuteSnapshotTool(deps) as never);
}

export default registerBrunchExecuteSnapshot;
