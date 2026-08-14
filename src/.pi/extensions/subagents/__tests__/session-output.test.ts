import type { AgentSessionEvent } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { describe, expect, it } from 'vitest';

import { createSubagentOutputContract, runSubagent } from '../session.js';

const definition = {
  name: 'planner',
  description: 'planner',
  tools: ['read'],
  skills: [],
  model: 'default',
  thinking: 'high',
  systemPrompt: 'submit output',
} as const;

const deps = {
  agentDir: '.',
  createSettingsManager: () => ({}),
  resourceLoaderOptions: {},
} as never;

const ctx = { cwd: '.', modelRegistry: { getAvailable: () => [{}] }, model: {} } as never;

function outputContract() {
  return createSubagentOutputContract({
    name: 'submit_candidate_plan',
    description: 'submit',
    parameters: Type.Object({ schemaVersion: Type.Integer() }),
  });
}

describe('runSubagent structured output', () => {
  it('returns exactly one captured output from a terminating tool-only turn', async () => {
    const candidate = { schemaVersion: 1 };
    let sessionOptions: { tools?: readonly string[]; customTools?: readonly { name: string }[] } | undefined;
    const terminations: unknown[] = [];

    const result = await runSubagent({
      definition: definition as never,
      task: 'plan',
      ctx,
      deps,
      outputContract: outputContract(),
      createServices: async () => ({}) as never,
      createSession: async (options) => {
        sessionOptions = options as never;
        const submit = options.customTools?.find((tool) => tool.name === 'submit_candidate_plan');
        return {
          session: {
            prompt: async () => {
              const submission = await submit?.execute(
                'candidate-1',
                candidate as never,
                undefined,
                undefined,
                {
                  cwd: '.',
                } as never,
              );
              terminations.push(submission?.terminate);
            },
            getLastAssistantText: () => undefined,
            dispose: () => undefined,
          },
        } as never;
      },
    });

    expect(sessionOptions?.tools).toContain('submit_candidate_plan');
    expect(sessionOptions?.customTools?.map(({ name }) => name)).toContain('submit_candidate_plan');
    expect(terminations).toEqual([true]);
    expect(result).toEqual({ agent: 'planner', status: 'ok', text: '', output: candidate });
  });

  it('produces stream previews from typed assistant text deltas and rejects rivals', async () => {
    const updates: Array<{ kind: string; message: string }> = [];

    const result = await runSubagent({
      definition: definition as never,
      task: 'plan',
      ctx,
      deps,
      onUpdate: (update) => updates.push(update),
      createServices: async () => ({}) as never,
      createSession: async () => {
        let listener: ((event: AgentSessionEvent) => void) | undefined;
        return {
          session: {
            subscribe: (nextListener: (event: AgentSessionEvent) => void) => {
              listener = nextListener;
              return () => undefined;
            },
            prompt: async () => {
              listener?.({
                type: 'message_update',
                message: {} as never,
                assistantMessageEvent: {
                  type: 'text_delta',
                  contentIndex: 0,
                  delta: 'Preview from the child',
                  partial: {} as never,
                },
              });
              listener?.({
                type: 'message_update',
                message: {} as never,
                assistantMessageEvent: { type: 'thinking_delta', delta: 'private' } as never,
              });
              listener?.({ type: 'message_update', message: {} } as never);
              listener?.({
                type: 'message_update',
                message: {} as never,
                assistantMessageEvent: { type: 'text_delta', delta: 42 } as never,
              });
            },
            getLastAssistantText: () => 'final response',
            dispose: () => undefined,
          },
        } as never;
      },
    });

    expect(result).toMatchObject({ status: 'ok', text: 'final response' });
    expect(updates.filter(({ kind }) => kind === 'message')).toEqual([
      { kind: 'message', message: 'Preview from the child' },
    ]);
  });

  it('fails closed when the planner submits zero or multiple outputs', async () => {
    const run = (outputs: readonly unknown[]) =>
      runSubagent({
        definition: definition as never,
        task: 'plan',
        ctx,
        deps,
        outputContract: outputContract(),
        createServices: async () => ({}) as never,
        createSession: async (options) => {
          const submit = options.customTools?.find((tool) => tool.name === 'submit_candidate_plan');
          return {
            session: {
              prompt: async () => {
                for (const [index, output] of outputs.entries()) {
                  await submit?.execute(`candidate-${index}`, output as never, undefined, undefined, {
                    cwd: '.',
                  } as never);
                }
              },
              getLastAssistantText: () => 'prose is not structured output',
              dispose: () => undefined,
            },
          } as never;
        },
      });

    await expect(run([])).resolves.toMatchObject({
      status: 'error',
      text: expect.stringContaining('submit_candidate_plan'),
    });
    await expect(run([{}, {}])).resolves.toMatchObject({
      status: 'error',
      text: expect.stringContaining('exactly once'),
    });
  });

  it('rejects output contracts not created by the sealed factory', async () => {
    const result = await runSubagent({
      definition: definition as never,
      task: 'plan',
      ctx,
      deps,
      outputContract: { name: 'arbitrary_tool' } as never,
      createServices: async () => ({}) as never,
    });

    expect(result).toMatchObject({
      status: 'error',
      text: expect.stringContaining('createSubagentOutputContract'),
    });
  });
});
