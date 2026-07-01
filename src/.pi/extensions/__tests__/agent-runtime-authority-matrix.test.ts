import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { describe, expect, it } from 'vitest';

import type { CommandResult } from '../../../graph/command-executor.js';
import { DEFAULT_BRUNCH_AGENT_STATE } from '../../../session/runtime-state.js';
import {
  activeToolNamesForBrunchAgentState,
  projectBrunchAgentState,
} from '../agent-runtime/runtime/index.js';

const SIDE_EFFECTING_POC_TOOLS = ['bash', 'edit', 'write'] as const;
const REGISTERED_POC_TOOLS = [
  'read',
  'grep',
  'find',
  'ls',
  'web_fetch',
  'web_search',
  ...SIDE_EFFECTING_POC_TOOLS,
  'present_question',
  'request_response',
  'mutate_graph',
] as const;

function piWithRegisteredTools(toolNames: readonly string[]): ExtensionAPI {
  return {
    getAllTools: () => toolNames.map((name) => ({ name })),
  } as ExtensionAPI;
}

function commandResultStatus(result: CommandResult): CommandResult['status'] {
  return result.status;
}

describe('minimal authority matrix', () => {
  it('keeps the CommandExecutor discriminant vocabulary as the graph mutation outcome surface', () => {
    const statuses = [
      commandResultStatus({ status: 'success', nodeId: 1, lsn: 1 }),
      commandResultStatus({
        status: 'success',
        lsn: 1,
        createdNodes: {},
        createdEdges: [],
        updatedNodes: [],
        updatedEdges: [],
        deletedNodes: [],
        deletedEdges: [],
      }),
      commandResultStatus({
        status: 'structural_illegal',
        diagnostics: [{ field: 'nodes', message: 'invalid graph mutation' }],
      }),
      commandResultStatus({ status: 'needs_human' }),
      commandResultStatus({ status: 'policy_blocked' }),
      commandResultStatus({ status: 'version_conflict' }),
    ];

    expect(statuses).toEqual([
      'success',
      'success',
      'structural_illegal',
      'needs_human',
      'policy_blocked',
      'version_conflict',
    ]);
  });

  it('derives elicit tool authority from the shared runtime policy and blocks side-effecting POC tools', () => {
    const state = projectBrunchAgentState([{ data: { state: DEFAULT_BRUNCH_AGENT_STATE } }]);

    expect(state).toMatchObject({ operationalMode: 'elicit', agentRole: 'elicitor' });

    expect(activeToolNamesForBrunchAgentState(piWithRegisteredTools(REGISTERED_POC_TOOLS), state)).toEqual([
      'read',
      'grep',
      'find',
      'ls',
      'web_fetch',
      'web_search',
      'present_question',
      'request_response',
      'mutate_graph',
    ]);
    expect(
      activeToolNamesForBrunchAgentState(piWithRegisteredTools(REGISTERED_POC_TOOLS), state),
    ).not.toEqual(expect.arrayContaining([...SIDE_EFFECTING_POC_TOOLS]));
  });

  it('represents needs_human as structured data instead of a TUI-only dialog', () => {
    const result = { status: 'needs_human' } satisfies CommandResult;

    expect(commandResultStatus(result)).toBe('needs_human');
    expect(JSON.parse(JSON.stringify(result))).toEqual({ status: 'needs_human' });
  });
});
