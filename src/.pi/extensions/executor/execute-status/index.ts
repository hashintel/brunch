import { Type, type Static } from 'typebox';

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { BRUNCH_EXECUTE_STATUS_TOOL } from '../../../../session/schema/tool-names.js';
import { EXECUTOR_ALLOWED_TOOL_NAMES } from '../../../../agents/runtime/executor/active-tools.js';
import { defineBrunchTool } from '../../shared/define-brunch-tool.js';
import { renderExecuteStatusResult } from '../rendering.js';
import { toolParameters } from '../../shared/tool-schema.js';

export { BRUNCH_EXECUTE_STATUS_TOOL } from '../../../../session/schema/tool-names.js';
// The ported-tool narrative is the execute-mode foothold subset of the executor
// admission policy — the single source of truth. Deriving it here keeps the
// human-readable line and the structured `details.portedTools` from drifting
// against each other or against EXECUTOR_ALLOWED_TOOL_NAMES.
const PORTED_TOOL_NAMES: readonly string[] = EXECUTOR_ALLOWED_TOOL_NAMES.filter((name) =>
  name.startsWith('execute_'),
);

const ExecuteStatusParams = Type.Object({
  discipline: Type.Optional(
    Type.Union([Type.Literal('strict'), Type.Literal('interpretive')], {
      description: 'Execution posture to inspect. Defaults to strict.',
    }),
  ),
});

type ExecuteStatusParams = Static<typeof ExecuteStatusParams>;

interface ExecuteStatusDetails {
  readonly discipline: 'strict' | 'interpretive';
  readonly availableDisciplines: readonly ['strict', 'interpretive'];
  readonly portedTools: readonly string[];
  readonly pendingTools: readonly [];
  readonly sideEffects: readonly [];
}

export function createExecuteStatusTool() {
  return defineBrunchTool<typeof ExecuteStatusParams, ExecuteStatusDetails>({
    name: BRUNCH_EXECUTE_STATUS_TOOL,
    label: 'execute_status',
    description:
      'Report the current native execute-mode orchestration foothold. Side-effect free: creates no plans, runs, worktrees, or graph mutations.',
    parameters: toolParameters(ExecuteStatusParams),
    renderResult(result, options, theme, context) {
      return renderExecuteStatusResult(result, options, theme as never, context);
    },
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      const discipline = params.discipline ?? 'strict';
      return {
        content: [
          {
            type: 'text' as const,
            text: [
              `execute_status: ${discipline}`,
              'available disciplines: strict, interpretive',
              `ported tools: ${PORTED_TOOL_NAMES.join(', ')}`,
              'pending tools: none',
              'executor promotion: run-local git promotion ported; host preflight/apply ported with explicit acceptance',
              'side effects: none',
            ].join('\n'),
          },
        ],
        details: {
          discipline,
          availableDisciplines: ['strict', 'interpretive'],
          portedTools: PORTED_TOOL_NAMES,
          pendingTools: [],
          sideEffects: [],
        },
      };
    },
  });
}

export function registerBrunchExecuteStatus(pi: ExtensionAPI): void {
  pi.registerTool(createExecuteStatusTool() as never);
}

export default registerBrunchExecuteStatus;
