import type { ExtensionAPI, ToolDefinition } from '@earendil-works/pi-coding-agent';
import { Type, type Static } from 'typebox';

import { BRUNCH_ORCHESTRATOR_STUB_TOOL } from '../../../session/schema/tool-names.js';

export { BRUNCH_ORCHESTRATOR_STUB_TOOL } from '../../../session/schema/tool-names.js';

const OrchestratorStubParams = Type.Object({
  message: Type.String({
    minLength: 1,
    description: 'Short message for the execute-mode orchestrator standup proof.',
  }),
});

type OrchestratorStubParams = Static<typeof OrchestratorStubParams>;

interface OrchestratorStubDetails {
  readonly message: string;
}

export function createOrchestratorStubTool(): ToolDefinition<
  typeof OrchestratorStubParams,
  OrchestratorStubDetails
> {
  return {
    name: BRUNCH_ORCHESTRATOR_STUB_TOOL,
    label: 'orchestrator_stub',
    description:
      'Run the trivial execute-mode orchestrator standup proof. Pass a short message; the tool echoes deterministic output.',
    parameters: OrchestratorStubParams,
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      return {
        content: [{ type: 'text' as const, text: `orchestrator stub ran: ${params.message}` }],
        details: { message: params.message },
      };
    },
  };
}

export function registerBrunchOrchestratorStub(pi: ExtensionAPI): void {
  pi.registerTool(createOrchestratorStubTool() as never);
}
