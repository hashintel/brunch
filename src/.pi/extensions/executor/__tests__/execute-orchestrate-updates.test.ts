import { chmod, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  createFakeGitHostLandPort,
  createFakeGitRunPromotionPort,
  createFakeGitSliceIntegrationPort,
  createFakeGitWorktreePort,
  createFakeTestRunnerPort,
} from '../../../../executor/__tests__/fake-ports.js';
import type {
  AgentRunnerPort,
  ExecutionPorts,
  TestRunnerPort,
} from '../../../../executor/execution-ports.js';
import { readRunDetail } from '../../../../executor/observer-read.js';
import { drive, petriScheduler, serialFiringPolicy } from '../../../../executor/orchestrate.js';
import { petriEventsPath } from '../../../../executor/petri-events.js';
import { petriMarkingPath, writePetriMarkingSnapshot } from '../../../../executor/petri-marking.js';
import { petriNetPath } from '../../../../executor/petri.js';
import { planFilePath } from '../../../../executor/plan-file.js';
import { createRun, runMetadataPath } from '../../../../executor/run.js';
import { createProductUpdatePublisher, type ProductUpdate } from '../../../../rpc/product-updates.js';
import {
  createExecuteOrchestrateTool,
  registerBrunchExecuteOrchestrate,
} from '../execute-orchestrate/index.js';

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
    gitSliceIntegration: createFakeGitSliceIntegrationPort(),
    agentRunner: options.agentRunner ?? completedAgentRunner,
    testRunner: options.testRunner ?? createFakeTestRunnerPort(),
    gitRunPromotion: createFakeGitRunPromotionPort(),
    gitHostLand: createFakeGitHostLandPort(),
  };
}

async function createDrivableRun(cwd: string, sliceIds: readonly string[] = ['t1']): Promise<void> {
  await mkdir(join(cwd, 'src'), { recursive: true });
  await writeFile(join(cwd, 'src', 'app.ts'), 'export const app = true;\n', 'utf8');
  await mkdir(join(cwd, '.brunch', 'cook', 'specs', '42'), { recursive: true });
  await writeFile(
    planFilePath(cwd, '42'),
    JSON.stringify({
      mode: 'greenfield',
      scope_handoff_required: false,
      epics: [{ id: 'e1', summary: 'E', depends_on: [], verification: [] }],
      slices: sliceIds.map((sliceId) => ({
        id: sliceId,
        epic_id: 'e1',
        definition: `${sliceId}.`,
        depends_on: [],
        verification: [],
      })),
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
      ts: '2026-07-14T12:00:00.000Z',
      runId,
      runStatus: 'promotion_prepared',
      transitionId: 'worktree_create',
      subnetId: 'run',
      step: 'worktree_create',
      contract: { kind: 'mechanical', lane: 'run' },
      consumed: ['run:created'],
      produced: ['run:promotion_prepared'],
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
  it('shares one same-run production execution across concurrent tool calls', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-orchestrate-single-owner-'));
    await createDrivableRun(cwd, ['t1']);
    let calls = 0;
    let entered!: () => void;
    const ownerEntered = new Promise<void>((resolve) => {
      entered = resolve;
    });
    let release!: () => void;
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tool = createExecuteOrchestrateTool(
      fakePorts({
        agentRunner: {
          async run() {
            calls += 1;
            entered();
            await released;
            return { status: 'completed' };
          },
        },
      }),
    );

    const owner = tool.execute(
      'owner',
      { runId: 'run-1' },
      undefined as never,
      undefined as never,
      {
        cwd,
      } as never,
    );
    const waiter = tool.execute(
      'waiter',
      { runId: 'run-1' },
      undefined as never,
      undefined as never,
      {
        cwd: join(cwd, '.'),
      } as never,
    );
    await ownerEntered;
    release();

    const [ownerResult, waiterResult] = await Promise.all([owner, waiter]);
    expect(ownerResult.details?.outcome).toEqual({ status: 'completed', runStatus: 'promotion_prepared' });
    expect(waiterResult.details?.outcome).toEqual(ownerResult.details?.outcome);
    expect(calls).toBe(1);
  });

  it('overlaps independent slices through the registered production tool with slice-coherent updates', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-orchestrate-production-parallel-'));
    await createDrivableRun(cwd, ['t1', 't2']);
    const entered: string[] = [];
    let release!: () => void;
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    let bothEntered!: () => void;
    const overlap = new Promise<void>((resolve) => {
      bothEntered = resolve;
    });
    const agentRunner: AgentRunnerPort = {
      async run(args) {
        entered.push(args.sliceId);
        await args.onUpdate?.({ kind: 'status', message: `working ${args.sliceId}` });
        if (entered.length === 2) bothEntered();
        await released;
        return { status: 'completed' };
      },
    };
    let registered: ReturnType<typeof createExecuteOrchestrateTool> | undefined;
    registerBrunchExecuteOrchestrate(
      {
        registerTool: (tool: ReturnType<typeof createExecuteOrchestrateTool>) => {
          registered = tool;
        },
      } as never,
      fakePorts({ agentRunner }),
    );
    const details: unknown[] = [];
    const execution = registered!.execute(
      'call-1',
      { runId: 'run-1' },
      undefined as never,
      ((update: { readonly details?: unknown }) => details.push(update.details)) as never,
      { cwd } as never,
    );

    await overlap;
    release();
    const result = await execution;

    expect(new Set(entered)).toEqual(new Set(['t1', 't2']));
    expect(result.details?.outcome).toEqual({ status: 'completed', runStatus: 'promotion_prepared' });
    const workerDetails = details.filter(
      (
        detail,
      ): detail is {
        readonly progress: { readonly activeSliceId?: string; readonly step: string };
        readonly agentStream: { readonly sliceId: string };
      } => detail !== null && typeof detail === 'object' && 'progress' in detail && 'agentStream' in detail,
    );
    expect(new Set(workerDetails.map((detail) => detail.agentStream.sliceId))).toEqual(new Set(['t1', 't2']));
    for (const detail of workerDetails) {
      expect(detail.progress).toMatchObject({
        step: 'agent_result',
        activeSliceId: detail.agentStream.sliceId,
      });
    }
  });

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
      expect(updates[1]?.petriProjectionReplayReason).toBeNull();
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

  it('ignores a stale serial claim and uses the complete production Petri frontier', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-orchestrate-resumed-claim-order-'));
    await createDrivableRun(cwd, ['t1', 't2']);
    await drive(
      { cwd, runId: 'run-1', ports: fakePorts(), sourcePolicy: 'host_source_deferred' },
      petriScheduler,
      serialFiringPolicy,
      { maxFirings: 5 },
    );
    await writePetriMarkingSnapshot({
      cwd,
      runId: 'run-1',
      snapshot: {
        claimedTransitionIds: ['slice_start:t2'],
        currentMarking: { 'run:slice_frontier': 1 },
        firedTransitionCount: 5,
        lifecycleProvenance: { runStatus: 'reports_initialized' },
      },
    });

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
    const parallelStarts = updates.filter((update) =>
      update.startsWith('execute_orchestrate: slice_execute started from reports_initialized'),
    );
    expect(parallelStarts.some((update) => update.includes('slice: t1'))).toBe(true);
    expect(parallelStarts.some((update) => update.includes('slice: t2'))).toBe(true);
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
        terminalTs: '2026-07-14T12:00:01.000Z',
        failedSliceIds: [],
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
    expect(result.details?.progress).toMatchObject({
      runId: 'run-1',
      step: 'promotion',
      phase: 'completed',
      fromStatus: 'petri_exported',
      runStatus: 'promotion_prepared',
      completedSliceIds: ['t1'],
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
      'execute_orchestrate: slice_integrate started from test_result_ingested',
      'execute_orchestrate: slice_integrate -> slice_integrated',
      'execute_orchestrate: slice_complete started from slice_integrated',
      'execute_orchestrate: slice_complete -> slice_completed',
      'execute_orchestrate: epic_integrate started from slice_completed',
      'execute_orchestrate: epic_integrate -> slice_completed',
      'execute_orchestrate: epic_complete started from slice_completed',
      'execute_orchestrate: epic_complete -> slice_completed',
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
    const detailUpdates: unknown[] = [];

    const tool = createExecuteOrchestrateTool(fakePorts({ agentRunner: streamingAgentRunner }));
    const result = await tool.execute(
      't1',
      { runId: 'run-1' },
      undefined as never,
      ((update: {
        readonly content: readonly { readonly type: string; readonly text?: string }[];
        readonly details?: unknown;
      }) => {
        const item = update.content[0];
        if (item?.type === 'text' && typeof item.text === 'string') updates.push(item.text);
        detailUpdates.push(update.details);
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
    const workerDetail = detailUpdates.find(
      (detail) => detail && typeof detail === 'object' && 'agentStream' in detail,
    ) as { readonly progress?: { readonly step?: string; readonly runStatus?: string } } | undefined;
    expect(workerDetail?.progress).toMatchObject({
      step: 'agent_result',
      runStatus: 'slice_execution_requested',
    });
  });

  it('emits verify stream updates between test_result start and completion', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-orchestrate-verify-stream-'));
    await createDrivableRun(cwd);
    const updates: string[] = [];
    const detailUpdates: unknown[] = [];

    const tool = createExecuteOrchestrateTool(fakePorts({ testRunner: streamingTestRunner }));
    const result = await tool.execute(
      't1',
      { runId: 'run-1' },
      undefined as never,
      ((update: {
        readonly content: readonly { readonly type: string; readonly text?: string }[];
        readonly details?: unknown;
      }) => {
        const item = update.content[0];
        if (item?.type === 'text' && typeof item.text === 'string') updates.push(item.text);
        detailUpdates.push(update.details);
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
    const completedProgressDetail = detailUpdates.find(
      (detail) =>
        detail &&
        typeof detail === 'object' &&
        'progress' in detail &&
        (detail as { readonly progress?: { readonly step?: string; readonly phase?: string } }).progress
          ?.step === 'test_result' &&
        (detail as { readonly progress?: { readonly step?: string; readonly phase?: string } }).progress
          ?.phase === 'completed',
    ) as { readonly verifyStream?: { readonly message?: string } } | undefined;
    expect(completedProgressDetail?.verifyStream?.message).toBe('tests passed');
    expect(result.details?.verifyStream?.message).toBe('tests passed');
  });

  it('does not carry stale worker streams into later verify progress updates', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-orchestrate-step-scoped-streams-'));
    await createDrivableRun(cwd);
    const detailUpdates: unknown[] = [];

    const tool = createExecuteOrchestrateTool(
      fakePorts({ agentRunner: streamingAgentRunner, testRunner: streamingTestRunner }),
    );
    const result = await tool.execute(
      't1',
      { runId: 'run-1' },
      undefined as never,
      ((update: {
        readonly content: readonly { readonly type: string; readonly text?: string }[];
        readonly details?: unknown;
      }) => {
        detailUpdates.push(update.details);
      }) as never,
      { cwd } as never,
    );

    const verifyStartedProgressDetail = detailUpdates.find(
      (detail) =>
        detail &&
        typeof detail === 'object' &&
        'progress' in detail &&
        (detail as { readonly progress?: { readonly step?: string; readonly phase?: string } }).progress
          ?.step === 'test_result' &&
        (detail as { readonly progress?: { readonly step?: string; readonly phase?: string } }).progress
          ?.phase === 'started',
    ) as
      | { readonly agentStream?: unknown; readonly verifyStream?: { readonly message?: string } }
      | undefined;

    const verifyCompletedProgressDetail = detailUpdates.find(
      (detail) =>
        detail &&
        typeof detail === 'object' &&
        'progress' in detail &&
        (detail as { readonly progress?: { readonly step?: string; readonly phase?: string } }).progress
          ?.step === 'test_result' &&
        (detail as { readonly progress?: { readonly step?: string; readonly phase?: string } }).progress
          ?.phase === 'completed',
    ) as
      | { readonly agentStream?: unknown; readonly verifyStream?: { readonly message?: string } }
      | undefined;

    expect(verifyStartedProgressDetail?.agentStream).toBeUndefined();
    expect(verifyStartedProgressDetail?.verifyStream).toBeUndefined();
    expect(verifyCompletedProgressDetail?.agentStream).toBeUndefined();
    expect(verifyCompletedProgressDetail?.verifyStream?.message).toBe('tests passed');
    expect(result.details?.agentStream?.message).toBe('edited src/types.ts');
    expect(result.details?.verifyStream?.message).toBe('tests passed');
  });
});
