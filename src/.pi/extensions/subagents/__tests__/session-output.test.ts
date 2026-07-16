import { describe, expect, it } from 'vitest';

import { runSubagent, type SubagentOutputContract } from '../session.js';

const definition = {
  name: 'planner',
  description: 'planner',
  tools: ['read'],
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

function outputContract(outputs: readonly unknown[]): SubagentOutputContract {
  return {
    tool: {
      name: 'submit_candidate_plan',
      label: 'submit_candidate_plan',
      description: 'submit',
      parameters: { type: 'object', properties: {} },
      execute: async () => ({ content: [], details: {}, terminate: true }),
    } as never,
    read: () => outputs,
  };
}

describe('runSubagent structured output', () => {
  it('returns exactly one captured output from a terminating tool-only turn', async () => {
    const candidate = { schemaVersion: 1 };
    let sessionOptions: { tools?: readonly string[]; customTools?: readonly { name: string }[] } | undefined;

    const result = await runSubagent({
      definition: definition as never,
      task: 'plan',
      ctx,
      deps,
      outputContract: outputContract([candidate]),
      createServices: async () => ({}) as never,
      createSession: async (options) => {
        sessionOptions = options as never;
        return {
          session: {
            prompt: async () => undefined,
            getLastAssistantText: () => undefined,
            dispose: () => undefined,
          },
        } as never;
      },
    });

    expect(sessionOptions?.tools).toContain('submit_candidate_plan');
    expect(sessionOptions?.customTools?.map(({ name }) => name)).toContain('submit_candidate_plan');
    expect(result).toEqual({ agent: 'planner', status: 'ok', text: '', output: candidate });
  });

  it('fails closed when the planner submits zero or multiple outputs', async () => {
    const run = (outputs: readonly unknown[]) =>
      runSubagent({
        definition: definition as never,
        task: 'plan',
        ctx,
        deps,
        outputContract: outputContract(outputs),
        createServices: async () => ({}) as never,
        createSession: async () =>
          ({
            session: {
              prompt: async () => undefined,
              getLastAssistantText: () => 'prose is not structured output',
              dispose: () => undefined,
            },
          }) as never,
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
});
