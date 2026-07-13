import { describe, expect, it } from 'vitest';

import type { BrunchSubagentsDeps } from '../../.pi/extensions/subagents/index.js';
import { createPlannerPort } from '../planner-port.js';

const plannerDefinition = { name: 'planner', description: 'planner', tools: ['read'] };

function fakeSubagents(args: {
  readonly text?: string;
  readonly status?: 'ok' | 'error';
  readonly capture?: { task?: string };
  readonly withDefinition?: boolean;
}): BrunchSubagentsDeps {
  return {
    definitions: new Map(args.withDefinition === false ? [] : [['planner', plannerDefinition]]) as never,
    runSubagent: async (runArgs: { task: string }) => {
      if (args.capture) args.capture.task = runArgs.task;
      return { status: args.status ?? 'ok', text: args.text ?? '{}' };
    },
  } as unknown as BrunchSubagentsDeps;
}

const runtime = { modelRegistry: {}, model: {} };

describe('createPlannerPort', () => {
  it('renders the projection and repair findings into the sealed planner task', async () => {
    const capture: { task?: string } = {};
    const port = createPlannerPort({ subagents: fakeSubagents({ text: '{"a":1}', capture }) });

    const result = await port.synthesize({
      projection: { specId: '7' },
      findings: [{ code: 'dependency_cycle', message: 'Slice task-1 participates in a dependency cycle.' }],
      priorCandidate: { schemaVersion: 1 },
      runtime,
    });

    expect(result).toEqual({ status: 'synthesized', candidate: '{"a":1}' });
    expect(capture.task).toContain('"specId": "7"');
    expect(capture.task).toContain('dependency_cycle: Slice task-1 participates in a dependency cycle.');
    expect(capture.task).toContain('Prior candidate:');
  });

  it('recovers the outermost JSON object from fenced or prose-wrapped replies', async () => {
    const port = createPlannerPort({
      subagents: fakeSubagents({ text: 'Here is the plan:\n```json\n{"schemaVersion":1}\n```\n' }),
    });

    const result = await port.synthesize({ projection: {}, runtime });

    expect(result).toEqual({ status: 'synthesized', candidate: '{"schemaVersion":1}' });
  });

  it('fails closed without subagent deps, planner definition, or model context', async () => {
    await expect(createPlannerPort().synthesize({ projection: {}, runtime })).resolves.toMatchObject({
      status: 'failed',
    });
    await expect(
      createPlannerPort({ subagents: fakeSubagents({ withDefinition: false }) }).synthesize({
        projection: {},
        runtime,
      }),
    ).resolves.toMatchObject({ status: 'failed', message: expect.stringContaining('definition') });
    await expect(
      createPlannerPort({ subagents: fakeSubagents({}) }).synthesize({ projection: {} }),
    ).resolves.toMatchObject({ status: 'failed', message: expect.stringContaining('model context') });
  });

  it('surfaces subagent errors as typed failures', async () => {
    const port = createPlannerPort({ subagents: fakeSubagents({ status: 'error', text: 'boom' }) });

    await expect(port.synthesize({ projection: {}, runtime })).resolves.toEqual({
      status: 'failed',
      message: 'boom',
    });
  });
});
