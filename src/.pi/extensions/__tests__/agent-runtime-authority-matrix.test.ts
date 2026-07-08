import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { describe, expect, it } from 'vitest';

import { LIVE_ELICITOR_ALLOWED_TOOL_NAMES } from '../../../agents/runtime/elicitor/active-tools.js';
import { composeLiveElicitorPrompt } from '../../../agents/runtime/elicitor/compose-live-prompt.js';
import { EXECUTOR_ALLOWED_TOOL_NAMES } from '../../../agents/runtime/executor/active-tools.js';
import { composeExecutorPrompt } from '../../../agents/runtime/executor/compose-prompt.js';
import type { CommandResult } from '../../../graph/command-executor.js';
import { DEFAULT_BRUNCH_AGENT_STATE } from '../../../session/runtime-state.js';
import {
  BRUNCH_AGENT_RUNTIME_STATE_CUSTOM_TYPE,
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
  'read_workspace_context',
  'read_specification_context',
  'read_session_context',
  'read_graph',
  'mutate_graph',
  'read_elicitation_scratchpad',
  'update_elicitation_scratchpad',
  'read_reconciliation_needs',
  'update_reconciliation_needs',
  'ask',
  'present_candidates',
  'present_review_set',

  'subagent',
  'execute_status',
] as const;

function piWithRegisteredTools(toolNames: readonly string[]): ExtensionAPI {
  return {
    getAllTools: () => toolNames.map((name) => ({ name })),
  } as ExtensionAPI;
}

function runtimeStateEntry(state: {
  readonly schemaVersion: 1;
  readonly operationalMode: 'specify' | 'execute';
}) {
  return {
    type: 'custom',
    customType: BRUNCH_AGENT_RUNTIME_STATE_CUSTOM_TYPE,
    data: {
      schemaVersion: 1,
      reason: 'switch',
      state,
      source: 'user',
    },
  };
}

function commandResultStatus(result: CommandResult): CommandResult['status'] {
  return result.status;
}

function skillNamesFrom(prompt: string): string[] {
  return [...prompt.matchAll(/<name>([^<]+)<\/name>/g)].map((match) => match[1] ?? '');
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

  it('derives Specify tool authority from the shared runtime policy and blocks side-effecting POC tools', () => {
    const state = projectBrunchAgentState([runtimeStateEntry(DEFAULT_BRUNCH_AGENT_STATE)]);

    expect(state).toMatchObject({ operationalMode: 'specify', agentRole: 'elicitor' });

    expect(activeToolNamesForBrunchAgentState(piWithRegisteredTools(REGISTERED_POC_TOOLS), state)).toEqual([
      'read',
      'grep',
      'find',
      'ls',
      'web_fetch',
      'web_search',
      'read_workspace_context',
      'read_specification_context',
      'read_session_context',
      'read_graph',
      'mutate_graph',
      'read_elicitation_scratchpad',
      'update_elicitation_scratchpad',
      'read_reconciliation_needs',
      'update_reconciliation_needs',
      'ask',
      'present_candidates',
      'present_review_set',

      'subagent',
    ]);
    expect(
      activeToolNamesForBrunchAgentState(piWithRegisteredTools(REGISTERED_POC_TOOLS), state),
    ).not.toEqual(expect.arrayContaining([...SIDE_EFFECTING_POC_TOOLS]));
  });

  it('keeps execute tool authority concentric over live elicitor authority', () => {
    const elicitorSet = new Set<string>(LIVE_ELICITOR_ALLOWED_TOOL_NAMES);
    const executorSet = new Set<string>(EXECUTOR_ALLOWED_TOOL_NAMES);

    for (const toolName of elicitorSet) {
      expect(executorSet.has(toolName), `executor should include elicitor tool ${toolName}`).toBe(true);
    }
    expect(executorSet.has('execute_status')).toBe(true);
    expect(elicitorSet.has('execute_status')).toBe(false);
  });

  it('derives execute tool authority as the elicitor superset plus executor-only orchestration', () => {
    const state = projectBrunchAgentState([
      runtimeStateEntry({ schemaVersion: 1, operationalMode: 'execute' }),
    ]);

    expect(state).toMatchObject({ operationalMode: 'execute', agentRole: 'executor' });
    expect(activeToolNamesForBrunchAgentState(piWithRegisteredTools(REGISTERED_POC_TOOLS), state)).toEqual([
      'read',
      'grep',
      'find',
      'ls',
      'web_fetch',
      'web_search',
      'read_workspace_context',
      'read_specification_context',
      'read_session_context',
      'read_graph',
      'mutate_graph',
      'read_elicitation_scratchpad',
      'update_elicitation_scratchpad',
      'read_reconciliation_needs',
      'update_reconciliation_needs',
      'ask',
      'present_candidates',
      'present_review_set',

      'subagent',
      'execute_status',
    ]);
    expect(
      activeToolNamesForBrunchAgentState(piWithRegisteredTools(REGISTERED_POC_TOOLS), state),
    ).not.toEqual(expect.arrayContaining([...SIDE_EFFECTING_POC_TOOLS]));
  });

  it('keeps the executor live skill manifest concentric with the elicitor manifest', () => {
    const elicitorPrompt = composeLiveElicitorPrompt({
      agentBody: '# Elicitor',
      sessionState: { operationalMode: 'specify', agentRole: 'elicitor' },
      spec: { id: 1, name: 'Spec' },
      workspace: { cwd: '/tmp/brunch' },
    }).prompt;
    const executorPrompt = composeExecutorPrompt({
      agentBody: '# Executor',
      sessionState: { schemaVersion: 1, operationalMode: 'execute', agentRole: 'executor' },
      spec: { id: 1, name: 'Spec' },
      workspace: { cwd: '/tmp/brunch' },
    }).prompt;

    expect(new Set(skillNamesFrom(executorPrompt))).toEqual(new Set(skillNamesFrom(elicitorPrompt)));
  });

  it('represents needs_human as structured data instead of a TUI-only dialog', () => {
    const result = { status: 'needs_human' } satisfies CommandResult;

    expect(commandResultStatus(result)).toBe('needs_human');
    expect(JSON.parse(JSON.stringify(result))).toEqual({ status: 'needs_human' });
  });
});
