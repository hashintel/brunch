import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  createFakeGitHostPromotionPort,
  createFakeGitLandPort,
  createFakeGitWorktreePort,
  createFakeTestRunnerPort,
} from '../../../../executor/__tests__/fake-ports.js';
import type { AgentRunnerPort, ExecutionPorts } from '../../../../executor/execution-ports.js';
import { planFilePath } from '../../../../executor/plan-file.js';
import { createRun } from '../../../../executor/run.js';
import { createProductUpdatePublisher, type ProductUpdate } from '../../../../rpc/product-updates.js';
import { createExecuteOrchestrateTool } from '../execute-orchestrate/index.js';

const completedAgentRunner: AgentRunnerPort = {
  async run() {
    return { status: 'completed' };
  },
};

function fakePorts(): ExecutionPorts {
  return {
    gitWorktree: createFakeGitWorktreePort(),
    agentRunner: completedAgentRunner,
    testRunner: createFakeTestRunnerPort(),
    gitLand: createFakeGitLandPort(),
    gitHostPromotion: createFakeGitHostPromotionPort({}),
  };
}

async function createDrivableRun(cwd: string): Promise<void> {
  await mkdir(join(cwd, 'src'), { recursive: true });
  await writeFile(join(cwd, 'src', 'app.ts'), 'export const app = true;\n', 'utf8');
  await mkdir(join(cwd, '.brunch', 'cook', 'specs', '42'), { recursive: true });
  await writeFile(
    planFilePath(cwd, '42'),
    JSON.stringify({
      mode: 'greenfield',
      epics: [{ id: 'e1', summary: 'E', depends_on: [], verification: [] }],
      slices: [{ id: 't1', epic_id: 'e1', definition: 't1.', depends_on: [], verification: [] }],
    }),
    'utf8',
  );
  await createRun({ cwd, specId: '42', runId: 'run-1' });
}

describe('execute_orchestrate intra-drive updates', () => {
  it('publishes run-scoped updates for every step advance during a drive', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-orchestrate-updates-'));
    await createDrivableRun(cwd);
    const publisher = createProductUpdatePublisher();
    const published: ProductUpdate[][] = [];
    publisher.subscribe((updates) => published.push([...updates]));

    const tool = createExecuteOrchestrateTool(fakePorts(), { productUpdates: publisher });
    const result = await tool.execute(
      't1',
      { runId: 'run-1' },
      undefined as never,
      undefined as never,
      { cwd } as never,
    );

    expect(result.details?.outcome.status).toBe('completed');
    // One publish per advanced step: created -> ... -> promotion_prepared for one slice = 13 steps.
    expect(published).toHaveLength(13);
    for (const updates of published) {
      expect(updates).toEqual([{ topic: 'execute.runs' }, { topic: 'execute.run', runId: 'run-1' }]);
    }
  });

  it('publishes nothing intra-drive when no publisher is injected', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-orchestrate-no-publisher-'));
    await createDrivableRun(cwd);

    const tool = createExecuteOrchestrateTool(fakePorts());
    const result = await tool.execute(
      't1',
      { runId: 'run-1' },
      undefined as never,
      undefined as never,
      { cwd } as never,
    );

    expect(result.details?.outcome).toEqual({
      status: 'completed',
      runStatus: 'promotion_prepared',
    });
  });
});
