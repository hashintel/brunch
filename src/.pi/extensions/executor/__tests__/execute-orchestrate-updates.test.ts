import { chmod, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  createFakeGitHostPromotionPort,
  createFakeGitLandPort,
  createFakeGitWorktreePort,
  createFakeTestRunnerPort,
} from '../../../../executor/__tests__/fake-ports.js';
import type {
  AgentRunnerPort,
  ExecutionPorts,
  TestRunnerPort,
} from '../../../../executor/execution-ports.js';
import { readRunDetail } from '../../../../executor/observer-read.js';
import { petriEventsPath } from '../../../../executor/petri-events.js';
import { petriMarkingPath } from '../../../../executor/petri-marking.js';
import { petriNetPath } from '../../../../executor/petri.js';
import { planFilePath } from '../../../../executor/plan-file.js';
import { createRun, runMetadataPath } from '../../../../executor/run.js';
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

function fakePorts(
  options: { readonly agentRunner?: AgentRunnerPort; readonly testRunner?: TestRunnerPort } = {},
): ExecutionPorts {
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

async function writeReplayablePetriArtifacts(cwd: string, runId: string): Promise<void> {
  await mkdir(join(cwd, '.brunch', 'cook', 'runs', runId, 'petrinaut'), { recursive: true });
  await writeFile(
    petriNetPath(cwd, runId),
    `${JSON.stringify({
      runId,
      subnets: [{ id: 'run', kind: 'run_control', transitionIds: ['worktree_create'] }],
      places: [
        { id: 'run:created', subnetId: 'run', name: 'Created' },
        { id: 'run:promotion_prepared', subnetId: 'run', name: 'Promotion prepared' },
      ],
      transitions: [
        {
          id: 'worktree_create',
          subnetId: 'run',
          step: { kind: 'worktree_create' },
          contract: { kind: 'mechanical', lane: 'run' },
          inputArcs: [{ placeId: 'run:created', weight: 1 }],
          outputArcs: [{ placeId: 'run:promotion_prepared', weight: 1 }],
        },
      ],
      initialMarking: { 'run:created': 1 },
    })}\n`,
    'utf8',
  );
  await writeFile(
    petriEventsPath(cwd, runId),
    `${JSON.stringify({
      kind: 'transition_fired',
      runId,
      runStatus: 'promotion_prepared',
      transitionId: 'worktree_create',
      subnetId: 'run',
      step: 'worktree_create',
      fromStatus: 'created',
      toStatus: 'promotion_prepared',
    })}\n`,
    'utf8',
  );
}

async function overwriteRunMetadata(
  cwd: string,
  runId: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  await writeFile(runMetadataPath(cwd, runId), `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
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

    expect(result.details?.outcome?.status).toBe('completed');
    expect(published.length).toBeGreaterThanOrEqual(14);
    const runScopedBatches = published.filter(
      (updates) => updates[0]?.topic === 'execute.runs' && updates[1]?.topic === 'execute.run',
    );
    expect(runScopedBatches.length).toBeGreaterThanOrEqual(14);
    for (const updates of runScopedBatches) {
      expect(updates).toMatchObject([
        { topic: 'execute.runs' },
        {
          runId: 'run-1',
          topic: 'execute.run',
        },
      ]);
    }
    const snapshotBatches = runScopedBatches.filter(
      (updates) => updates[1]?.petriProjectionSource === 'snapshot',
    );
    expect(snapshotBatches.length).toBeGreaterThan(0);
    for (const updates of snapshotBatches) {
      expect(updates[1]).toHaveProperty('petriReadySteps');
      expect(updates[1]).toHaveProperty('petriBlockedSteps');
    }
    const detail = await readRunDetail(cwd, 'run-1');
    expect(detail && !('unreadable' in detail) ? detail.petriProjectionSource : undefined).toBe('snapshot');
  });

  it('publishes current Petri frontier hints on run updates during orchestration', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-orchestrate-frontier-hints-'));
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

    expect(result.details?.outcome?.status).toBe('completed');
    expect(
      published.some((updates) =>
        updates.some(
          (update) =>
            update.topic === 'execute.run' &&
            update.runId === 'run-1' &&
            JSON.stringify(update).includes('"kind":"slice_start","sliceId":"t1"'),
        ),
      ),
    ).toBe(true);
    expect(
      published.some((updates) =>
        updates.some(
          (update) =>
            update.topic === 'execute.run' &&
            update.runId === 'run-1' &&
            JSON.stringify(update).includes('"kind":"slice_execute","sliceId":"t1"'),
        ),
      ),
    ).toBe(true);
  });

  it('publishes the claimed Petri firing set before the reserved transition completes', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-orchestrate-claimed-frontier-'));
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

    expect(result.details?.outcome?.status).toBe('completed');
    expect(
      published.some((updates) =>
        updates.some(
          (update) =>
            update.topic === 'execute.run' &&
            update.runId === 'run-1' &&
            JSON.stringify(update).includes('"claimedTransitionIds":["slice_start:t1"]'),
        ),
      ),
    ).toBe(true);
  });

  it('publishes replay stale-snapshot hints after a halted drive when the persisted marking snapshot cannot be refreshed', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-orchestrate-stale-marking-'));
    await createDrivableRun(cwd);
    await writeReplayablePetriArtifacts(cwd, 'run-1');
    await overwriteRunMetadata(cwd, 'run-1', {
      runId: 'run-1',
      specId: '42',
      planPath: planFilePath(cwd, '42'),
      status: 'abandoned',
      abandonedAt: '2026-07-09T00:00:00.000Z',
    });
    await writeFile(
      petriMarkingPath(cwd, 'run-1'),
      `${JSON.stringify({
        currentMarking: { 'run:promotion_prepared': 2 },
        firedTransitionCount: 99,
        lifecycleProvenance: { runStatus: 'run_completed' },
        terminalEventKind: 'net_completed',
      })}\n`,
      'utf8',
    );
    await chmod(petriMarkingPath(cwd, 'run-1'), 0o444);

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

    expect(result.details?.outcome).toEqual({
      status: 'halted',
      step: 'abandoned',
      runStatus: 'abandoned',
      reason: 'abandoned',
    });
    expect(published.at(-1)).toMatchObject([
      { topic: 'execute.runs' },
      {
        topic: 'execute.run',
        runId: 'run-1',
        petriProjectionSource: 'replay',
        petriProjectionReplayReason: 'snapshot_stale',
        petriReadySteps: [],
        petriBlockedSteps: [],
      },
    ]);
  });

  it('publishes replay missing-snapshot hints after a halted drive when the persisted marking snapshot is unreadable', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-orchestrate-missing-marking-'));
    await createDrivableRun(cwd);
    await writeReplayablePetriArtifacts(cwd, 'run-1');
    await overwriteRunMetadata(cwd, 'run-1', {
      runId: 'run-1',
      specId: '42',
      planPath: planFilePath(cwd, '42'),
      status: 'abandoned',
      abandonedAt: '2026-07-09T00:00:00.000Z',
    });
    await mkdir(petriMarkingPath(cwd, 'run-1'), { recursive: true });

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

    expect(result.details?.outcome).toEqual({
      status: 'halted',
      step: 'abandoned',
      runStatus: 'abandoned',
      reason: 'abandoned',
    });
    expect(published.at(-1)).toMatchObject([
      { topic: 'execute.runs' },
      {
        topic: 'execute.run',
        runId: 'run-1',
        petriProjectionSource: 'replay',
        petriProjectionReplayReason: 'snapshot_missing_or_unreadable',
        petriReadySteps: [],
        petriBlockedSteps: [],
      },
    ]);
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

    expect(result.details?.outcome?.status).toBe('completed');
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
    expect(
      updates.find((update) => update.startsWith('execute_orchestrate: agent_result started')),
    ).toContain('slice: t1');
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

    expect(result.details?.outcome?.status).toBe('completed');
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

    expect(result.details?.outcome?.status).toBe('completed');
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
