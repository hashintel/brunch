import { describe, expect, it } from 'vitest';

import { createSessionBindingData } from '../../session/session-binding.js';
import { registerBrunchContext } from '../extensions/context/index.js';

describe('context tools', () => {
  it('read_session_context returns runtime-frame markdown plus typed details', async () => {
    const tools = new Map<string, { execute: (...args: any[]) => Promise<unknown> }>();

    registerBrunchContext({
      registerTool(tool: { name: string; execute: (...args: any[]) => Promise<unknown> }) {
        tools.set(tool.name, tool);
      },
    } as never);

    const result = (await tools.get('read_session_context')!.execute('context-1', {}, undefined, undefined, {
      sessionManager: {
        getEntries: () => [
          { type: 'session', id: 'session-1', cwd: '/tmp/brunch' },
          {
            id: 'binding-1',
            type: 'custom',
            parentId: null,
            customType: 'brunch.session_binding',
            data: createSessionBindingData({ specId: 1 }),
          },
          {
            id: 'runtime-1',
            type: 'custom',
            parentId: 'binding-1',
            customType: 'brunch.agent_runtime_state',
            data: {
              schemaVersion: 1,
              reason: 'switch',
              source: 'user',
              state: {
                schemaVersion: 1,
                operationalMode: 'elicit',
                agentStrategy: 'project-graph',
                agentLens: 'oracle',
                agentGoal: 'commit-converge',
              },
            },
          },
          {
            id: 'mention-1',
            type: 'custom',
            parentId: 'runtime-1',
            customType: 'brunch.mention',
            data: { entityId: 'node-1', handle: 'D12', title: 'Decision seam', snapshottedLsn: 7 },
          },
        ],
      },
    })) as {
      content: Array<{ type: 'text'; text: string }>;
      details: unknown;
    };

    expect(result.content[0]?.text).toContain('[Selected session runtime frame]');
    expect(result.content[0]?.text).toContain('#D12');
    expect(result.content[0]?.text).not.toContain('node-1');
    expect(result.details).toMatchObject({
      status: 'ready',
      specId: 1,
      sessionId: 'session-1',
      agent: {
        strategy: 'project-graph',
        lens: 'oracle',
        goal: 'commit-converge',
      },
    });
  });

  it('read_session_context reports missing binding as not_ready instead of throwing', async () => {
    const tools = new Map<string, { execute: (...args: any[]) => Promise<unknown> }>();

    registerBrunchContext({
      registerTool(tool: { name: string; execute: (...args: any[]) => Promise<unknown> }) {
        tools.set(tool.name, tool);
      },
    } as never);

    const result = (await tools.get('read_session_context')!.execute('context-2', {}, undefined, undefined, {
      sessionManager: {
        getEntries: () => [{ type: 'session', id: 'session-1', cwd: '/tmp/brunch' }],
      },
    })) as {
      content: Array<{ type: 'text'; text: string }>;
      details: unknown;
    };

    expect(result.content[0]?.text).toContain('status: not_ready');
    expect(result.details).toEqual({
      status: 'not_ready',
      reason: 'missing_binding',
      sessionId: 'session-1',
    });
  });
});
