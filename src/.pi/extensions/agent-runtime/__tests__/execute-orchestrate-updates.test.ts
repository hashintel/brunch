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
import type { AgentRunnerPort, ExecutionPorts, TestRunnerPort } from '../../../../executor/execution-ports.js';
import { planFilePath } from '../../../../executor/plan-file.js';
import { createRun } from '../../../../executor/run.js';
import { createProductUpdatePublisher, type ProductUpdate } from '../../../../rpc/product-updates.js';
import { createExecuteOrchestrateTool } from '../execute-orchestrate/index.js';

const completedAgentRunner: AgentRunnerPort = {
  async run() {
    return { status: 'completed' };
  },
};

const streamingAgentRunner: AgentRunnerPort = {
  async run(args) {
    await args.onUpdate?.({ kind: 'status', message: 'worker started' });
    await args.onUpdate?.({ kind: 'message', message: 'edited src/types.ts' });
    return { status: 'completed' };
  },
};

const streamingTestRunner: TestRunnerPort = {
  async run(args) {
    await args.onUpdate?.({ kind: 'status', message: 'npm run verify started' });
    await args.onUpdate?.({ kind: 'stdout', message: 'tests passed' });
    return { status: 'completed', verdict: 'passed', exitCode: 0, target: 'npm run verify' };
  },
};

function fakePorts(options: { readonly agentRunner?: AgentRunnerPort; readonly testRunner?: TestRunnerPort } = {}): ExecutionPorts {
  return {
    gitWorktree: createFakeGitWorktreePort(),
    agentRunner: options.agentRunner ?? completedAgentRunner,
    testRunner: options.testRunner ?? createFakeTestRunnerPort(),
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

  it('emits tool updates before and after every step during a drive', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-orchestrate-tool-updates-'));
    await createDrivableRun(cwd);
    const updates: string[] = [];

    const tool = createExecuteOrchestrateTool(fakePorts());
    const result = await tool.execute(
      't1',
      { runId: 'run-1' },
      undefined as never,
      ((update: { readonly content: readonly { readonly type: string; readonly text?: string }[] }) => {
        const item = update.content[0];
        if (item?.type === 'text' && typeof item.text === 'string') updates.push(item.text);
      }) as never,
      { cwd } as never,
    );

    expect(result.details?.outcome.status).toBe('completed');
    expect(updates.map((update) => update.split('\n')[0])).toEqual([
      'execute_orchestrate: worktree_create started from created',
      'execute_orchestrate: worktree_create -> worktree_created',
      'execute_orchestrate: populate started from worktree_created',
      'execute_orchestrate: populate -> worktree_populated',
      'execute_orchestrate: source_policy started from worktree_populated',
      'execute_orchestrate: source_policy -> source_policy_selected',
      'execute_orchestrate: source_copy started from source_policy_selected',
      'execute_orchestrate: source_copy -> source_copied',
      'execute_orchestrate: report_init started from source_copied',
      'execute_orchestrate: report_init -> reports_initialized',
      'execute_orchestrate: slice_start started from reports_initialized',
      'execute_orchestrate: slice_start -> slice_started',
      'execute_orchestrate: slice_execute started from slice_started',
      'execute_orchestrate: slice_execute -> slice_execution_requested',
      'execute_orchestrate: agent_result started from slice_execution_requested',
      'execute_orchestrate: agent_result -> agent_result_ingested',
      'execute_orchestrate: test_result started from agent_result_ingested',
      'execute_orchestrate: test_result -> test_result_ingested',
      'execute_orchestrate: slice_complete started from test_result_ingested',
      'execute_orchestrate: slice_complete -> slice_completed',
      'execute_orchestrate: run_complete started from slice_completed',
      'execute_orchestrate: run_complete -> run_completed',
      'execute_orchestrate: petri_export started from run_completed',
      'execute_orchestrate: petri_export -> petri_exported',
      'execute_orchestrate: promotion started from petri_exported',
      'execute_orchestrate: promotion -> promotion_prepared',
    ]);
    expect(updates.find((update) => update.startsWith('execute_orchestrate: agent_result started'))).toContain(
      'slice: t1',
    );
  });

  it('emits worker stream updates between agent_result start and completion', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-orchestrate-worker-stream-'));
    await createDrivableRun(cwd);
    const updates: string[] = [];

    const tool = createExecuteOrchestrateTool(fakePorts({ agentRunner: streamingAgentRunner }));
    const result = await tool.execute(
      't1',
      { runId: 'run-1' },
      undefined as never,
      ((update: { readonly content: readonly { readonly type: string; readonly text?: string }[] }) => {
        const item = update.content[0];
        if (item?.type === 'text' && typeof item.text === 'string') updates.push(item.text);
      }) as never,
      { cwd } as never,
    );

    expect(result.details?.outcome.status).toBe('completed');
    const agentStart = updates.findIndex((update) =>
      update.startsWith('execute_orchestrate: agent_result started'),
    );
    const workerUpdate = updates.findIndex((update) => update.includes('edited src/types.ts'));
    const agentComplete = updates.findIndex((update) =>
      update.startsWith('execute_orchestrate: agent_result ->'),
    );
    expect(agentStart).toBeGreaterThanOrEqual(0);
    expect(workerUpdate).toBeGreaterThan(agentStart);
    expect(agentComplete).toBeGreaterThan(workerUpdate);
  });

  it('emits verify stream updates between test_result start and completion', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-orchestrate-verify-stream-'));
    await createDrivableRun(cwd);
    const updates: string[] = [];

    const tool = createExecuteOrchestrateTool(fakePorts({ testRunner: streamingTestRunner }));
    const result = await tool.execute(
      't1',
      { runId: 'run-1' },
      undefined as never,
      ((update: { readonly content: readonly { readonly type: string; readonly text?: string }[] }) => {
        const item = update.content[0];
        if (item?.type === 'text' && typeof item.text === 'string') updates.push(item.text);
      }) as never,
      { cwd } as never,
    );

    expect(result.details?.outcome.status).toBe('completed');
    const testStart = updates.findIndex((update) =>
      update.startsWith('execute_orchestrate: test_result started'),
    );
    const verifyUpdate = updates.findIndex((update) => update.includes('tests passed'));
    const testComplete = updates.findIndex((update) =>
      update.startsWith('execute_orchestrate: test_result ->'),
    );
    expect(testStart).toBeGreaterThanOrEqual(0);
    expect(verifyUpdate).toBeGreaterThan(testStart);
    expect(testComplete).toBeGreaterThan(verifyUpdate);
  });
});
