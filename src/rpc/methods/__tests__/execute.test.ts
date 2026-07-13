import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { Value } from 'typebox/value';
import { describe, expect, it } from 'vitest';

import {
  createFakeGitHostPromotionPort,
  createFakeGitLandPort,
  createFakeGitSliceIntegrationPort,
  createFakeGitWorktreePort,
  createFakeTestRunnerPort,
} from '../../../executor/__tests__/fake-ports.js';
import type { ExecutionPorts } from '../../../executor/execution-ports.js';
import type { ExecutorNetEvent } from '../../../executor/orchestrate-topology.js';
import { drive, frontierFiringPolicy, petriScheduler } from '../../../executor/orchestrate.js';
import { planFilePath, planProvenancePath } from '../../../executor/plan-file.js';
import { PRODUCTION_EXECUTE_RPC_MUTATIONS } from '../../../executor/run-execution-authority.js';
import { createRun, runDirPath, runMetadataPath, type RunMetadata } from '../../../executor/run.js';
import type { GraphEdge } from '../../../graph/schema/edges.js';
import type { GraphNode } from '../../../graph/schema/nodes.js';
import { createProductUpdatePublisher, type ProductUpdate } from '../../product-updates.js';
import type { JsonRpcRequest } from '../../protocol.js';
import {
  ExecuteRunResultSchema,
  ExecuteRunsResultSchema,
  executeRpcMethods,
  UNKNOWN_RUN_ID_MESSAGE,
} from '../execute.js';
import type { RpcMethodContext } from '../registry.js';

function contextFor(cwd: string): RpcMethodContext {
  // execute.* handlers consume only cwd; the remaining context members are
  // coordinator/session machinery these read projections must never touch.
  return { cwd } as RpcMethodContext;
}

function contextForSpec(
  cwd: string,
  graph: { readonly nodes: readonly GraphNode[]; readonly edges: readonly GraphEdge[]; readonly lsn: number },
  updates?: ProductUpdate[],
): RpcMethodContext {
  const productUpdates = createProductUpdatePublisher();
  productUpdates.subscribe((published) => updates?.push(...published));
  return {
    cwd,
    productUpdates,
    getGraphRuntime: async () => ({
      commandExecutor: {} as never,
      forSpec: () => ({
        queryGraph: () => graph,
        getNodes: () => [],
        resolveNodeCode: () => undefined,
        resolveEdgeId: () => undefined,
        getOpenReconciliationNeeds: () => [],
        latestLsn: () => graph.lsn,
      }),
    }),
  } as unknown as RpcMethodContext;
}

function method(name: string) {
  const definition = executeRpcMethods.find((entry) => entry.method === name);
  if (!definition) throw new Error(`missing method ${name}`);
  return definition;
}

function request(name: string, params?: unknown): JsonRpcRequest {
  return {
    jsonrpc: '2.0',
    id: 7,
    method: name,
    ...(params === undefined ? {} : { params }),
  } as JsonRpcRequest;
}

function transitionEvent(
  overrides: Partial<Extract<ExecutorNetEvent, { readonly kind: 'transition_fired' }>> = {},
): Extract<ExecutorNetEvent, { readonly kind: 'transition_fired' }> {
  return {
    kind: 'transition_fired',
    ts: '2026-07-14T12:00:00.000Z',
    runId: 'run-1',
    runStatus: 'worktree_created',
    transitionId: 'worktree_create',
    subnetId: 'run',
    step: 'worktree_create',
    contract: { kind: 'mechanical', lane: 'run' },
    consumed: ['run:created'],
    produced: ['run:worktree_created'],
    fromStatus: 'created',
    toStatus: 'worktree_created',
    ...overrides,
  };
}

async function writeRun(
  cwd: string,
  runId: string,
  options: {
    readonly planPath?: string;
    readonly status?: RunMetadata['status'];
    readonly specId?: string;
    readonly activeSliceId?: string;
    readonly completedSliceIds?: readonly string[];
    readonly failedSliceIds?: readonly string[];
    readonly integratedEpicIds?: readonly string[];
    readonly epicTransitionHistory?: readonly string[];
  } = {},
): Promise<void> {
  await mkdir(runDirPath(cwd, runId), { recursive: true });
  await writeFile(
    runMetadataPath(cwd, runId),
    `${JSON.stringify({
      runId,
      specId: options.specId ?? '42',
      planPath: options.planPath ?? '/plan.yaml',
      status: options.status ?? 'created',
      ...(options.activeSliceId === undefined ? {} : { activeSliceId: options.activeSliceId }),
      ...(options.completedSliceIds === undefined ? {} : { completedSliceIds: options.completedSliceIds }),
      ...(options.failedSliceIds === undefined ? {} : { failedSliceIds: options.failedSliceIds }),
      ...(options.completedSliceIds === undefined
        ? {}
        : {
            sliceAttemptHistory: Object.fromEntries(
              options.completedSliceIds.map((sliceId) => [
                sliceId,
                {
                  agent: [{ outcome: 'succeeded', attempts: 1 }],
                  verify: [{ outcome: 'succeeded', attempts: 1, verdict: 'passed' }],
                },
              ]),
            ),
          }),
      ...(options.integratedEpicIds === undefined ? {} : { integratedEpicIds: options.integratedEpicIds }),
      ...(options.epicTransitionHistory === undefined
        ? {}
        : { epicTransitionHistory: options.epicTransitionHistory }),
    })}\n`,
    'utf8',
  );
}

async function writePlan(cwd: string, specId = '42', graphLsn = 11): Promise<void> {
  const path = planFilePath(cwd, specId);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(
    path,
    `${JSON.stringify({ mode: 'greenfield', spec: { spec_id: specId }, epics: [], slices: [] })}\n`,
    'utf8',
  );
  await writeFile(
    planProvenancePath(cwd, specId),
    `${JSON.stringify({ schemaVersion: 1, specId, mode: 'greenfield', source: { graphLsn, visibility: 'active' } })}\n`,
    'utf8',
  );
}

function executableGraph(lsn = 11): {
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
  readonly lsn: number;
} {
  const requirement: GraphNode = {
    id: 1,
    specId: 42,
    plane: 'intent',
    kind: 'requirement',
    kindOrdinal: 1,
    title: 'Build run observer actions',
    basis: 'explicit',
    settlement: 'settled',
    createdAtLsn: 1,
    updatedAtLsn: 1,
  };
  const criterion: GraphNode = {
    id: 2,
    specId: 42,
    plane: 'intent',
    kind: 'criterion',
    kindOrdinal: 1,
    title: 'Actions are safe',
    basis: 'explicit',
    settlement: 'settled',
    createdAtLsn: 1,
    updatedAtLsn: 1,
  };
  return {
    lsn,
    nodes: [requirement, criterion],
    edges: [
      {
        id: 1,
        specId: 42,
        category: 'witness',
        sourceId: criterion.id,
        targetId: requirement.id,
        stance: 'for',
        basis: 'explicit',
        settlement: 'settled',
        createdAtLsn: 1,
        updatedAtLsn: 1,
      },
    ],
  };
}

function executableScopeGraph(lsn = 11): {
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
  readonly lsn: number;
} {
  const nodeBase = {
    specId: 42,
    basis: 'explicit' as const,
    settlement: 'settled' as const,
    createdAtLsn: 1,
    updatedAtLsn: 1,
  };
  const edgeBase = {
    specId: 42,
    basis: 'explicit' as const,
    settlement: 'settled' as const,
    createdAtLsn: 1,
    updatedAtLsn: 1,
  };

  return {
    lsn,
    nodes: [
      { ...nodeBase, id: 1, plane: 'plan', kind: 'frontier', kindOrdinal: 1, title: 'Execution handoff' },
      {
        ...nodeBase,
        id: 2,
        plane: 'plan',
        kind: 'scope',
        kindOrdinal: 1,
        title: 'Feature delivery scope',
        body: 'Deliver the feature scope from committed design and verification anchors.',
      },
      { ...nodeBase, id: 10, plane: 'intent', kind: 'requirement', kindOrdinal: 1, title: 'Wire feature' },
      {
        ...nodeBase,
        id: 11,
        plane: 'intent',
        kind: 'requirement',
        kindOrdinal: 2,
        title: 'Ship keyboard shortcut',
      },
      {
        ...nodeBase,
        id: 12,
        plane: 'intent',
        kind: 'requirement',
        kindOrdinal: 3,
        title: 'Build foundation',
      },
      {
        ...nodeBase,
        id: 20,
        plane: 'intent',
        kind: 'criterion',
        kindOrdinal: 1,
        title: 'Feature is visible',
      },
      {
        ...nodeBase,
        id: 21,
        plane: 'intent',
        kind: 'criterion',
        kindOrdinal: 2,
        title: 'Shortcut opens feature',
      },
      { ...nodeBase, id: 30, plane: 'design', kind: 'module', kindOrdinal: 1, title: 'Feature module' },
      { ...nodeBase, id: 40, plane: 'oracle', kind: 'check', kindOrdinal: 1, title: 'Feature smoke test' },
    ],
    edges: [
      { ...edgeBase, id: 1, category: 'composition', sourceId: 1, targetId: 2 },
      { ...edgeBase, id: 2, category: 'realization', sourceId: 10, targetId: 2 },
      { ...edgeBase, id: 3, category: 'realization', sourceId: 11, targetId: 2 },
      { ...edgeBase, id: 4, category: 'realization', sourceId: 12, targetId: 2 },
      { ...edgeBase, id: 5, category: 'dependency', sourceId: 12, targetId: 10 },
      { ...edgeBase, id: 6, category: 'dependency', sourceId: 10, targetId: 11 },
      { ...edgeBase, id: 7, category: 'witness', sourceId: 20, targetId: 10, stance: 'for' },
      { ...edgeBase, id: 8, category: 'witness', sourceId: 21, targetId: 11, stance: 'for' },
      { ...edgeBase, id: 9, category: 'composition', sourceId: 2, targetId: 30 },
      { ...edgeBase, id: 10, category: 'dependency', sourceId: 40, targetId: 2 },
      { ...edgeBase, id: 11, category: 'dependency', sourceId: 20, targetId: 2 },
      { ...edgeBase, id: 12, category: 'dependency', sourceId: 21, targetId: 2 },
    ],
  };
}

describe('execute RPC mutation authority classification', () => {
  it('classifies every registered execute method and every write as a run mutation', () => {
    expect(Object.keys(PRODUCTION_EXECUTE_RPC_MUTATIONS).sort()).toEqual(
      executeRpcMethods.map((definition) => definition.method).sort(),
    );
    for (const definition of executeRpcMethods) {
      expect(PRODUCTION_EXECUTE_RPC_MUTATIONS[definition.method]).toEqual(
        definition.access === 'write' ? expect.any(String) : null,
      );
    }
  });
});

describe('execute.runs', () => {
  it('rejects params', async () => {
    const response = await method('execute.runs').handle(
      contextFor('/tmp/none'),
      request('execute.runs', {}),
    );
    expect(response).toMatchObject({ error: { code: -32602 } });
  });

  it('lists run summaries for the invocation cwd', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-execute-runs-'));
    await writeRun(cwd, 'run-1', { failedSliceIds: ['task-1'] });

    const definition = method('execute.runs');
    const response = await definition.handle(contextFor(cwd), request('execute.runs'));

    expect(response).toMatchObject({
      result: {
        runs: [
          {
            runId: 'run-1',
            specId: '42',
            status: 'created',
            failedSliceIds: ['task-1'],
            presence: { worktree: false, reports: false, petri: false, promotion: false },
          },
        ],
      },
    });
    expect(Value.Check(ExecuteRunsResultSchema, 'result' in response ? response.result : undefined)).toBe(
      true,
    );
  });
});

describe('execute.run', () => {
  it('returns failed slice ids in a schema-valid run detail response', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-execute-run-failed-slices-'));
    await writeRun(cwd, 'run-1', { failedSliceIds: ['task-1'] });

    const definition = method('execute.run');
    const response = await definition.handle(contextFor(cwd), request('execute.run', { runId: 'run-1' }));

    expect(response).toMatchObject({ result: { failedSliceIds: ['task-1'] } });
    expect(Value.Check(ExecuteRunResultSchema, 'result' in response ? response.result : undefined)).toBe(
      true,
    );
  });

  it('returns active parallel authority readiness and stream inventory over RPC', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-execute-run-parallel-authority-'));
    await mkdir(join(cwd, '.brunch', 'cook', 'specs', '42'), { recursive: true });
    await writeFile(
      planFilePath(cwd, '42'),
      JSON.stringify({
        mode: 'greenfield',
        spec: {
          requirements: [
            { item_id: 'REQ1', content: 'First parallel slice.' },
            { item_id: 'REQ2', content: 'Second parallel slice.' },
          ],
          criteria: [
            { item_id: 'AC1', verifies: ['REQ1'] },
            { item_id: 'AC2', verifies: ['REQ2'] },
          ],
        },
        epics: [{ id: 'epic-1', depends_on: [], verification: [] }],
        slices: ['task-1', 'task-2'].map((id, index) => ({
          id,
          epic_id: 'epic-1',
          depends_on: [],
          verification: [],
          derived_from: [index === 0 ? 'REQ1' : 'REQ2'],
        })),
      }),
      'utf8',
    );
    await createRun({ cwd, specId: '42', runId: 'run-1' });
    let entered = 0;
    let bothEntered!: () => void;
    const overlapping = new Promise<void>((resolve) => {
      bothEntered = resolve;
    });
    let release!: () => void;
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    let firstUpdateWritten!: () => void;
    const firstUpdate = new Promise<void>((resolve) => {
      firstUpdateWritten = resolve;
    });
    const ports: ExecutionPorts = {
      gitWorktree: createFakeGitWorktreePort(),
      gitSliceIntegration: createFakeGitSliceIntegrationPort(),
      agentRunner: {
        async run(args) {
          if (args.sliceId === 'task-2') await firstUpdate;
          await args.onUpdate?.({ kind: 'status', message: `rpc ${args.sliceId}` });
          if (args.sliceId === 'task-1') firstUpdateWritten();
          entered += 1;
          if (entered === 2) bothEntered();
          await released;
          return { status: 'completed' };
        },
      },
      testRunner: createFakeTestRunnerPort(),
      gitLand: createFakeGitLandPort(),
      gitHostPromotion: createFakeGitHostPromotionPort({}),
    };
    const driving = drive({ cwd, runId: 'run-1', ports }, petriScheduler, frontierFiringPolicy);
    await overlapping;

    const response = await method('execute.run').handle(
      contextFor(cwd),
      request('execute.run', { runId: 'run-1' }),
    );
    expect(response).toMatchObject({
      result: {
        petriReadySteps: [],
        petriBlockedSteps: [
          { sliceId: 'task-1', blockers: [{ kind: 'parallel_authority', state: 'running' }] },
          { sliceId: 'task-2', blockers: [{ kind: 'parallel_authority', state: 'running' }] },
        ],
        agentStreamTail: [
          { sliceId: 'task-1', message: 'rpc task-1' },
          { sliceId: 'task-2', message: 'rpc task-2' },
        ],
        sliceStreamInventory: [
          { sliceId: 'task-1', state: 'running', agentAttempts: [1], verifyAttempts: [] },
          { sliceId: 'task-2', state: 'running', agentAttempts: [1], verifyAttempts: [] },
        ],
        requirements: [
          expect.objectContaining({ requirementId: 'REQ1', status: 'running' }),
          expect.objectContaining({ requirementId: 'REQ2', status: 'running' }),
        ],
      },
    });
    expect('result' in response && Value.Check(ExecuteRunResultSchema, response.result)).toBe(true);
    release();
    await driving;
  });

  it('suppresses readiness when a nonterminal Petri journal is malformed', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-execute-run-malformed-authority-'));
    await writePlan(cwd);
    await writeRun(cwd, 'run-1', {
      status: 'created',
      planPath: planFilePath(cwd, '42'),
    });
    const petrinautDir = join(runDirPath(cwd, 'run-1'), 'petrinaut');
    await mkdir(petrinautDir, { recursive: true });
    await writeFile(join(petrinautDir, 'events.jsonl'), '{"kind":"transition_fired"', 'utf8');

    const response = await method('execute.run').handle(
      contextFor(cwd),
      request('execute.run', { runId: 'run-1' }),
    );

    expect(response).toMatchObject({
      result: {
        petriReadySteps: [],
        petriBlockedSteps: [
          { kind: 'authority_unreadable', blockers: [{ kind: 'parallel_authority_unreadable' }] },
        ],
      },
    });
    expect(Value.Check(ExecuteRunResultSchema, 'result' in response ? response.result : undefined)).toBe(
      true,
    );
  });

  it('recovers a journal-only epic verification claim over RPC', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-execute-run-epic-claim-crash-'));
    const planPath = planFilePath(cwd, '42');
    await mkdir(dirname(planPath), { recursive: true });
    await writeFile(
      planPath,
      JSON.stringify({
        epics: [
          {
            id: 'epic-1',
            depends_on: [],
            verification: [{ kind: 'criterion', target: 'npm test' }],
          },
        ],
        slices: [{ id: 'task-1', epic_id: 'epic-1' }],
      }),
      'utf8',
    );
    await writeRun(cwd, 'run-1', {
      planPath,
      status: 'slice_completed',
      completedSliceIds: ['task-1'],
      integratedEpicIds: ['epic-1'],
      epicTransitionHistory: ['epic_integrate:epic-1'],
    });
    const petrinautDir = join(runDirPath(cwd, 'run-1'), 'petrinaut');
    await mkdir(petrinautDir, { recursive: true });
    await writeFile(
      join(petrinautDir, 'events.jsonl'),
      `${JSON.stringify({
        kind: 'epic_verification_claimed',
        ts: '2026-07-14T12:00:00.000Z',
        runId: 'run-1',
        runStatus: 'slice_completed',
        epicId: 'epic-1',
        step: 'epic_verify',
      })}\n`,
      'utf8',
    );

    const response = await method('execute.run').handle(
      contextFor(cwd),
      request('execute.run', { runId: 'run-1' }),
    );

    expect(response).toMatchObject({
      result: {
        petriReadySteps: [],
        petriBlockedSteps: [
          {
            kind: 'epic_verify',
            epicId: 'epic-1',
            blockers: [{ kind: 'epic_verification_authority', phase: 'claimed' }],
          },
        ],
      },
    });
    expect(Value.Check(ExecuteRunResultSchema, 'result' in response ? response.result : undefined)).toBe(
      true,
    );
  });

  it('rejects malformed and traversal-shaped params', async () => {
    const definition = method('execute.run');
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-execute-run-params-'));
    for (const params of [undefined, {}, { runId: '' }, { runId: '../escape' }]) {
      const response = await definition.handle(contextFor(cwd), request('execute.run', params));
      expect(response).toMatchObject({ error: { code: -32602 } });
    }
  });

  it('fails with a named error for an unknown runId', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-execute-run-missing-'));
    const response = await method('execute.run').handle(
      contextFor(cwd),
      request('execute.run', { runId: 'run-x' }),
    );
    expect(response).toMatchObject({ error: { code: -32011, message: UNKNOWN_RUN_ID_MESSAGE } });
  });

  it('returns the run detail projection', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-execute-run-detail-'));
    await writeRun(cwd, 'run-1');
    await writeFile(join(runDirPath(cwd, 'run-1'), 'reports.jsonl'), '{"event":"run_ready"}\n', 'utf8');

    const response = await method('execute.run').handle(
      contextFor(cwd),
      request('execute.run', { runId: 'run-1' }),
    );

    expect(response).toMatchObject({
      result: {
        runId: 'run-1',
        planPath: '/plan.yaml',
        reportsTotal: 1,
        reportsTail: [{ event: 'run_ready' }],
        agentStreamTotal: 0,
        agentStreamTail: [],
        verifyStreamTotal: 0,
        verifyStreamTail: [],
        presence: { worktree: false, reports: true, petri: false, promotion: false },
      },
    });
  });

  it('returns the current Petri ready frontier when lifecycle facts admit multiple dependency-ready starts', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-execute-run-ready-frontier-'));
    const planPath = join(cwd, 'plan.yaml');
    await writeFile(
      planPath,
      `${JSON.stringify({
        mode: 'greenfield',
        epics: [{ id: 'frontier-1' }, { id: 'frontier-2' }],
        slices: [
          { id: 'task-1', epic_id: 'frontier-1', derived_from: ['REQ1'] },
          { id: 'task-2', epic_id: 'frontier-1', depends_on: ['task-1'], derived_from: ['REQ2'] },
          { id: 'task-3', epic_id: 'frontier-2', derived_from: ['REQ3'] },
        ],
      })}\n`,
      'utf8',
    );
    await writeRun(cwd, 'run-1', { planPath, status: 'reports_initialized' });

    const response = await method('execute.run').handle(
      contextFor(cwd),
      request('execute.run', { runId: 'run-1' }),
    );

    expect(response).toMatchObject({
      result: {
        petriReadySteps: [
          { kind: 'slice_start', sliceId: 'task-1', epicId: 'frontier-1', derivedFrom: ['REQ1'] },
          { kind: 'slice_start', sliceId: 'task-3', epicId: 'frontier-2', derivedFrom: ['REQ3'] },
        ],
        petriBlockedSteps: [
          {
            kind: 'slice_start',
            sliceId: 'task-2',
            epicId: 'frontier-1',
            derivedFrom: ['REQ2'],
            blockers: [{ kind: 'dependency', sliceId: 'task-1' }],
          },
        ],
      },
    });
  });

  it('returns active-slice blockers when another dependency-ready slice cannot start yet', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-execute-run-active-blocker-'));
    const planPath = join(cwd, 'plan.yaml');
    await writeFile(
      planPath,
      `${JSON.stringify({ mode: 'greenfield', slices: [{ id: 'task-1' }, { id: 'task-2' }] })}\n`,
      'utf8',
    );
    await writeRun(cwd, 'run-1', { planPath, status: 'slice_started', activeSliceId: 'task-1' });

    const response = await method('execute.run').handle(
      contextFor(cwd),
      request('execute.run', { runId: 'run-1' }),
    );

    expect(response).toMatchObject({
      result: {
        petriReadySteps: [{ kind: 'slice_execute', sliceId: 'task-1' }],
        petriBlockedSteps: [
          { kind: 'slice_start', sliceId: 'task-2', blockers: [{ kind: 'active_slice', sliceId: 'task-1' }] },
        ],
      },
    });
  });

  it('returns normalized worker stream events without exposing artifact paths', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-execute-run-agent-stream-'));
    await writeRun(cwd, 'run-1');
    await writeFile(
      runMetadataPath(cwd, 'run-1'),
      `${JSON.stringify({
        runId: 'run-1',
        specId: '42',
        planPath: '/plan.yaml',
        status: 'slice_execution_requested',
        activeSliceId: 'task-1',
        activeEpicId: 'frontier-1',
      })}\n`,
      'utf8',
    );
    await mkdir(join(runDirPath(cwd, 'run-1'), 'streams', 'task-1'), { recursive: true });
    await writeFile(
      join(runDirPath(cwd, 'run-1'), 'streams', 'task-1', 'agent-attempt-1.jsonl'),
      `${JSON.stringify({
        event: 'agent_stream',
        runId: 'run-1',
        epicId: 'frontier-1',
        sliceId: 'task-1',
        sequence: 0,
        kind: 'message',
        message: 'worker emitted text',
      })}\n`,
      'utf8',
    );

    const response = await method('execute.run').handle(
      contextFor(cwd),
      request('execute.run', { runId: 'run-1' }),
    );

    expect(response).toMatchObject({
      result: {
        agentStreamTotal: 1,
        agentStreamTail: [
          {
            event: 'agent_stream',
            runId: 'run-1',
            epicId: 'frontier-1',
            sliceId: 'task-1',
            sequence: 0,
            kind: 'message',
            message: 'worker emitted text',
          },
        ],
      },
    });
    expect(JSON.stringify(response)).not.toContain('agent.jsonl');
  });

  it('returns per-requirement status from plan mapping and run verification', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-execute-run-requirements-'));
    const planPath = join(cwd, 'plan.yaml');
    await writeFile(
      planPath,
      `${JSON.stringify({
        spec: {
          requirements: [
            { item_id: 'REQ1', content: 'Build type root.' },
            { item_id: 'REQ2', content: 'Build command surface.' },
            { item_id: 'REQ3', content: 'Unmapped requirement.' },
          ],
          criteria: [{ item_id: 'AC1', content: 'Type root works.', verifies: ['REQ1'] }],
        },
        slices: [
          { id: 'task-1', derived_from: ['REQ1'] },
          { id: 'task-2', derived_from: ['REQ2'] },
        ],
      })}\n`,
      'utf8',
    );
    await writeRun(cwd, 'run-1', { planPath });
    await writeFile(
      runMetadataPath(cwd, 'run-1'),
      `${JSON.stringify({
        runId: 'run-1',
        specId: '42',
        planPath,
        status: 'slice_completed',
        completedSliceIds: ['task-1', 'task-2'],
      })}\n`,
      'utf8',
    );
    await writeFile(
      join(runDirPath(cwd, 'run-1'), 'reports.jsonl'),
      [
        JSON.stringify({ event: 'slice_test_result', sliceId: 'task-1', status: 'passed' }),
        JSON.stringify({ event: 'slice_test_result', sliceId: 'task-2', status: 'passed' }),
        '',
      ].join('\n'),
      'utf8',
    );

    const response = await method('execute.run').handle(
      contextFor(cwd),
      request('execute.run', { runId: 'run-1' }),
    );

    expect(response).toMatchObject({
      result: {
        requirements: [
          {
            requirementId: 'REQ1',
            status: 'passed',
            sliceIds: ['task-1'],
            completedSliceIds: ['task-1'],
            criterionIds: ['AC1'],
          },
          {
            requirementId: 'REQ2',
            status: 'unverified',
            sliceIds: ['task-2'],
            completedSliceIds: ['task-2'],
            criterionIds: [],
          },
          {
            requirementId: 'REQ3',
            status: 'unmapped',
            sliceIds: [],
          },
        ],
      },
    });
  });

  it('returns normalized verify stream events without exposing artifact paths', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-execute-run-verify-stream-'));
    await writeRun(cwd, 'run-1');
    await writeFile(
      runMetadataPath(cwd, 'run-1'),
      `${JSON.stringify({
        runId: 'run-1',
        specId: '42',
        planPath: '/plan.yaml',
        status: 'agent_result_ingested',
        activeSliceId: 'task-1',
        activeEpicId: 'frontier-1',
      })}\n`,
      'utf8',
    );
    await mkdir(join(runDirPath(cwd, 'run-1'), 'streams', 'task-1'), { recursive: true });
    await writeFile(
      join(runDirPath(cwd, 'run-1'), 'streams', 'task-1', 'verify-attempt-1.jsonl'),
      `${JSON.stringify({
        event: 'verify_stream',
        runId: 'run-1',
        epicId: 'frontier-1',
        sliceId: 'task-1',
        sequence: 0,
        kind: 'stdout',
        message: 'tests passed',
      })}\n`,
      'utf8',
    );

    const response = await method('execute.run').handle(
      contextFor(cwd),
      request('execute.run', { runId: 'run-1' }),
    );

    expect(response).toMatchObject({
      result: {
        verifyStreamTotal: 1,
        verifyStreamTail: [
          {
            event: 'verify_stream',
            runId: 'run-1',
            epicId: 'frontier-1',
            sliceId: 'task-1',
            sequence: 0,
            kind: 'stdout',
            message: 'tests passed',
          },
        ],
      },
    });
    expect(JSON.stringify(response)).not.toContain('verify.jsonl');
  });

  it('returns the raw Petri event tail/count without exposing artifact paths', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-execute-run-petri-events-'));
    await writeRun(cwd, 'run-1', { status: 'agent_result_ingested' });
    await mkdir(join(runDirPath(cwd, 'run-1'), 'petrinaut'), { recursive: true });
    await writeFile(
      join(runDirPath(cwd, 'run-1'), 'petrinaut', 'events.jsonl'),
      `${JSON.stringify(
        transitionEvent({
          runId: 'run-1',
          runStatus: 'slice_started',
          transitionId: 'slice_start:task-1',
          subnetId: 'slice:task-1',
          step: 'slice_start',
          contract: { kind: 'structural', lane: 'slice' },
          consumed: ['run:slice_frontier'],
          produced: ['slice:task-1:started'],
          fromStatus: 'reports_initialized',
          toStatus: 'slice_started',
        }),
      )}\n`,
      'utf8',
    );

    const response = await method('execute.run').handle(
      contextFor(cwd),
      request('execute.run', { runId: 'run-1' }),
    );

    expect(response).toMatchObject({
      result: {
        petriEventsTotal: 1,
        petriEventsTail: [
          {
            kind: 'transition_fired',
            runId: 'run-1',
            transitionId: 'slice_start:task-1',
            subnetId: 'slice:task-1',
          },
        ],
      },
    });
    expect(JSON.stringify(response)).not.toContain('events.jsonl');
  });

  it('returns a derived Petri projection separately from the raw net payload', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-execute-run-petri-projection-'));
    await writeRun(cwd, 'run-1', { status: 'promotion_prepared' });
    await mkdir(join(runDirPath(cwd, 'run-1'), 'petrinaut'), { recursive: true });
    await writeFile(
      join(runDirPath(cwd, 'run-1'), 'petrinaut', 'net.json'),
      `${JSON.stringify({
        runId: 'run-1',
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
      join(runDirPath(cwd, 'run-1'), 'petrinaut', 'events.jsonl'),
      `${JSON.stringify(
        transitionEvent({
          runId: 'run-1',
          runStatus: 'promotion_prepared',
          produced: ['run:promotion_prepared'],
          toStatus: 'promotion_prepared',
        }),
      )}\n${JSON.stringify({ kind: 'net_completed', ts: '2026-07-14T12:00:01.000Z', runId: 'run-1', runStatus: 'promotion_prepared', failedSliceIds: [] })}\n`,
      'utf8',
    );

    const response = await method('execute.run').handle(
      contextFor(cwd),
      request('execute.run', { runId: 'run-1' }),
    );

    expect(response).toMatchObject({
      result: {
        petriProjection: {
          currentMarking: { 'run:promotion_prepared': 1 },
          firedTransitionCount: 1,
          terminalEventKind: 'net_completed',
        },
        petriProjectionSource: 'replay',
        petriProjectionReplayReason: 'snapshot_missing_or_unreadable',
        petriNet: {
          places: expect.arrayContaining([{ id: 'run:created', subnetId: 'run', name: 'Created' }]),
        },
      },
    });
  });

  it('returns the derived Petrinaut replay export without exposing SDCPN artifact paths', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-execute-run-petrinaut-live-'));
    await writeRun(cwd, 'run-1', { status: 'worktree_created' });
    await mkdir(join(runDirPath(cwd, 'run-1'), 'petrinaut'), { recursive: true });
    await writeFile(
      join(runDirPath(cwd, 'run-1'), 'petrinaut', 'net.json'),
      `${JSON.stringify({
        initialMarking: { 'run:created': 1 },
        transitions: [
          {
            id: 'worktree_create',
            inputArcs: [{ placeId: 'run:created', weight: 1 }],
            outputArcs: [{ placeId: 'run:worktree_created', weight: 1 }],
          },
        ],
      })}\n`,
      'utf8',
    );
    await writeFile(
      join(runDirPath(cwd, 'run-1'), 'petrinaut', 'net.sdcpn.json'),
      `${JSON.stringify({
        version: 1,
        meta: { generator: 'brunch', generatorVersion: 'executor-topology-v1' },
        title: 'Executor run run-1',
        places: [
          {
            id: 'run:created',
            name: 'RunCreated',
            colorId: null,
            dynamicsEnabled: false,
            differentialEquationId: null,
          },
          {
            id: 'run:worktree_created',
            name: 'RunWorktreeCreated',
            colorId: null,
            dynamicsEnabled: false,
            differentialEquationId: null,
          },
        ],
        transitions: [
          {
            id: 'worktree_create',
            name: 'worktree_create',
            inputArcs: [{ placeId: 'run:created', weight: 1, type: 'standard' }],
            outputArcs: [{ placeId: 'run:worktree_created', weight: 1 }],
            lambdaType: 'predicate',
            lambdaCode: 'export default Lambda(() => true)',
            transitionKernelCode: 'export default TransitionKernel(() => ({}))',
          },
        ],
        types: [],
        differentialEquations: [],
        parameters: [],
        scenarios: [
          {
            id: 'scenario__initial-marking',
            name: 'Initial marking',
            scenarioParameters: [],
            parameterOverrides: {},
            initialState: { type: 'per_place', content: { 'run:created': '1' } },
          },
        ],
        metrics: [],
      })}\n`,
      'utf8',
    );
    await writeFile(
      join(runDirPath(cwd, 'run-1'), 'petrinaut', 'events.jsonl'),
      `${JSON.stringify(
        transitionEvent({
          runId: 'run-1',
        }),
      )}\n`,
      'utf8',
    );

    const response = await method('execute.run').handle(
      contextFor(cwd),
      request('execute.run', { runId: 'run-1' }),
    );

    expect(response).toMatchObject({
      result: {
        petrinautReplayExport: {
          definition: {
            places: expect.arrayContaining([
              expect.objectContaining({ id: 'run:created', x: expect.any(Number), y: expect.any(Number) }),
            ]),
            transitions: expect.arrayContaining([
              expect.objectContaining({
                id: 'worktree_create',
                x: expect.any(Number),
                y: expect.any(Number),
              }),
            ]),
          },
          initialState: { 'run:created': 1 },
          transitionFirings: [
            {
              transitionId: 'worktree_create',
              input: { 'run:created': 1 },
              output: { 'run:worktree_created': 1 },
              ts: '2026-07-14T12:00:00.000Z',
            },
          ],
        },
        petrinautStreamPath: '/petrinaut/stream?runId=run-1',
      },
    });
    expect(JSON.stringify(response)).not.toContain('net.sdcpn.json');
  });
});

describe('execute.runTraceIndex', () => {
  it('rejects malformed params', async () => {
    const definition = method('execute.runTraceIndex');
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-execute-run-trace-params-'));
    for (const params of [undefined, {}, { specId: '' }]) {
      const response = await definition.handle(contextFor(cwd), request('execute.runTraceIndex', params));
      expect(response).toMatchObject({ error: { code: -32602 } });
    }
  });

  it('maps requirement and criterion graph codes to run slices without artifact paths', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-execute-run-trace-'));
    const planPath = join(cwd, 'plan.yaml');
    await writeFile(
      planPath,
      `${JSON.stringify({
        spec: {
          requirements: [
            { item_id: 'REQ1', content: 'Build type root.' },
            { item_id: 'REQ2', content: 'Build command surface.' },
          ],
          criteria: [{ item_id: 'AC1', content: 'Type root works.', verifies: ['REQ1'] }],
        },
        slices: [
          { id: 'task-1', derived_from: ['REQ1'] },
          { id: 'task-2', derived_from: ['REQ2'] },
        ],
      })}\n`,
      'utf8',
    );
    await writeRun(cwd, 'run-1', { planPath });
    await writeFile(
      runMetadataPath(cwd, 'run-1'),
      `${JSON.stringify({
        runId: 'run-1',
        specId: '42',
        planPath,
        status: 'slice_completed',
        completedSliceIds: ['task-1', 'task-2'],
      })}\n`,
      'utf8',
    );
    await writeFile(
      join(runDirPath(cwd, 'run-1'), 'reports.jsonl'),
      [
        JSON.stringify({ event: 'slice_test_result', sliceId: 'task-1', status: 'failed' }),
        JSON.stringify({ event: 'slice_test_result', sliceId: 'task-2', status: 'passed' }),
        '',
      ].join('\n'),
      'utf8',
    );

    const response = await method('execute.runTraceIndex').handle(
      contextFor(cwd),
      request('execute.runTraceIndex', { specId: 42 }),
    );

    expect(response).toMatchObject({
      result: {
        traces: [
          {
            nodeCode: 'REQ1',
            runId: 'run-1',
            runStatus: 'slice_completed',
            sliceIds: ['task-1'],
            failedSliceIds: ['task-1'],
            completedSliceIds: ['task-1'],
          },
          {
            nodeCode: 'REQ2',
            runId: 'run-1',
            runStatus: 'slice_completed',
            sliceIds: ['task-2'],
            failedSliceIds: [],
            completedSliceIds: ['task-2'],
          },
          {
            nodeCode: 'AC1',
            runId: 'run-1',
            runStatus: 'slice_completed',
            sliceIds: ['task-1'],
            failedSliceIds: ['task-1'],
            completedSliceIds: ['task-1'],
          },
        ],
      },
    });
    expect(JSON.stringify(response)).not.toContain(planPath);
  });
});

describe('execute replanning methods', () => {
  it('returns the same recommendation classes as executor core', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-execute-replan-recommend-'));
    await writePlan(cwd, '42', 10);
    await writeRun(cwd, 'run-1', { planPath: planFilePath(cwd, '42'), status: 'worktree_created' });

    const response = await method('execute.replanRecommendation').handle(
      contextForSpec(cwd, executableGraph(11)),
      request('execute.replanRecommendation', { runId: 'run-1', specId: 42 }),
    );

    expect(response).toMatchObject({
      result: {
        status: 'replan_before_retry',
        recommendedAction: 'regenerate_plan',
        allowedActions: ['regenerate_plan', 'start_new_run', 'abandon_run'],
      },
    });
  });

  it('rejects replanning reads when the requested spec does not own the run', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-execute-replan-spec-mismatch-'));
    await writeRun(cwd, 'run-1', { specId: '99', planPath: planFilePath(cwd, '99') });

    const response = await method('execute.replanRecommendation').handle(
      contextForSpec(cwd, executableGraph(11)),
      request('execute.replanRecommendation', { runId: 'run-1', specId: 42 }),
    );

    expect(response).toMatchObject({ error: { code: -32602, message: 'Invalid params' } });
  });

  it('regenerates a stale early-run plan and publishes run updates', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-execute-replan-regenerate-'));
    const updates: ProductUpdate[] = [];
    await writePlan(cwd, '42', 10);
    await writeRun(cwd, 'run-1', { planPath: planFilePath(cwd, '42'), status: 'worktree_created' });

    const response = await method('execute.replanRegeneratePlan').handle(
      contextForSpec(cwd, executableGraph(11), updates),
      request('execute.replanRegeneratePlan', { runId: 'run-1', specId: 42 }),
    );

    expect(response).toMatchObject({
      result: {
        status: 'regenerated_plan',
        eligibility: { status: 'replan_before_retry' },
        sideEffects: [{ kind: 'write_file' }, { kind: 'write_file' }],
      },
    });
    expect(updates).toEqual([
      { topic: 'execute.runs' },
      {
        topic: 'execute.run',
        runId: 'run-1',
        petriProjection: null,
        petriProjectionSource: null,
        petriProjectionReplayReason: null,
        petriReadySteps: [{ kind: 'populate' }],
        petriBlockedSteps: [],
      },
    ]);
  });

  it('writes multi-slice scope handoff data into the regenerated plan artifact', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-execute-replan-scope-handoff-'));
    await writePlan(cwd, '42', 10);
    await writeRun(cwd, 'run-1', { planPath: planFilePath(cwd, '42'), status: 'worktree_created' });

    const response = await method('execute.replanRegeneratePlan').handle(
      contextForSpec(cwd, executableScopeGraph(11)),
      request('execute.replanRegeneratePlan', { runId: 'run-1', specId: 42, mode: 'brownfield' }),
    );

    expect(response).toMatchObject({
      result: {
        status: 'regenerated_plan',
        eligibility: { status: 'replan_before_retry' },
      },
    });

    expect(JSON.parse(await readFile(planFilePath(cwd, '42'), 'utf8'))).toEqual({
      mode: 'brownfield',
      spec: {
        spec_id: '42',
        requirements: [
          { item_id: 'REQ3', content: 'Build foundation' },
          { item_id: 'REQ1', content: 'Wire feature' },
          { item_id: 'REQ2', content: 'Ship keyboard shortcut' },
        ],
        criteria: [
          { item_id: 'AC1', content: 'Feature is visible', verifies: ['REQ1'] },
          { item_id: 'AC2', content: 'Shortcut opens feature', verifies: ['REQ2'] },
        ],
      },
      epics: [{ id: 'F1', summary: 'Execution handoff', depends_on: [], verification: [] }],
      execution_contract: {
        schemaVersion: 1,
        requiredCapabilities: [{ id: 'node.npm-verify', source: { kind: 'default' } }],
        detectedCapabilities: [],
        resolvedActions: {
          setup: [],
          build: [],
          verify: [
            {
              capabilityId: 'node.npm-verify',
              providerId: 'node-npm',
              command: 'npm',
              args: ['run', 'verify'],
            },
          ],
        },
        blocked: [],
        conflicts: [],
      },
      scope_handoff_required: true,
      slices: [
        {
          id: 'task-3',
          epic_id: 'F1',
          scope_id: 'SCP1',
          definition: 'Build foundation',
          depends_on: [],
          verification: [
            { kind: 'criterion', criterionId: 'AC1', target: 'Feature is visible' },
            { kind: 'criterion', criterionId: 'AC2', target: 'Shortcut opens feature' },
          ],
          derived_from: ['REQ3'],
          design_context: [{ item_id: 'MOD1', content: 'Feature module' }],
          verification_context: [{ item_id: 'CH1', content: 'Feature smoke test' }],
        },
        {
          id: 'task-1',
          epic_id: 'F1',
          scope_id: 'SCP1',
          definition: 'Wire feature',
          depends_on: ['task-3'],
          verification: [
            { kind: 'criterion', criterionId: 'AC1', target: 'Feature is visible' },
            { kind: 'criterion', criterionId: 'AC2', target: 'Shortcut opens feature' },
          ],
          derived_from: ['REQ1'],
          design_context: [{ item_id: 'MOD1', content: 'Feature module' }],
          verification_context: [{ item_id: 'CH1', content: 'Feature smoke test' }],
        },
        {
          id: 'task-2',
          epic_id: 'F1',
          scope_id: 'SCP1',
          definition: 'Ship keyboard shortcut',
          depends_on: ['task-1'],
          verification: [
            { kind: 'criterion', criterionId: 'AC1', target: 'Feature is visible' },
            { kind: 'criterion', criterionId: 'AC2', target: 'Shortcut opens feature' },
          ],
          derived_from: ['REQ2'],
          design_context: [{ item_id: 'MOD1', content: 'Feature module' }],
          verification_context: [{ item_id: 'CH1', content: 'Feature smoke test' }],
        },
      ],
    });
  });

  it('refuses to expose retry-current-step through web RPC', () => {
    expect(
      executeRpcMethods.find((entry) => entry.method === 'execute.replanRetryCurrentStep'),
    ).toBeUndefined();
  });

  it('does not start a superseding run from a stale plan', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-execute-replan-new-run-'));
    const updates: ProductUpdate[] = [];
    await writePlan(cwd, '42', 10);
    await writeRun(cwd, 'run-old', { planPath: planFilePath(cwd, '42'), status: 'worktree_populated' });

    const response = await method('execute.replanStartNewRun').handle(
      contextForSpec(cwd, executableGraph(11), updates),
      request('execute.replanStartNewRun', { previousRunId: 'run-old', runId: 'run-new', specId: 42 }),
    );

    expect(response).toMatchObject({
      result: {
        status: 'launch_not_ready',
        previousRunId: 'run-old',
        sideEffects: [],
      },
    });
    expect(updates).toEqual([]);
  });

  it('does not start a superseding run when current run retry is allowed', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-execute-replan-new-run-fresh-'));
    await writePlan(cwd, '42', 11);
    await writeRun(cwd, 'run-old', { planPath: planFilePath(cwd, '42'), status: 'worktree_created' });

    const response = await method('execute.replanStartNewRun').handle(
      contextForSpec(cwd, executableGraph(11)),
      request('execute.replanStartNewRun', { previousRunId: 'run-old', runId: 'run-new', specId: 42 }),
    );

    expect(response).toMatchObject({
      result: {
        status: 'start_new_run_not_allowed',
        eligibility: { status: 'retry_current_run' },
        sideEffects: [],
      },
    });
  });

  it('marks a run abandoned and publishes exact run updates', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-execute-replan-abandon-'));
    const updates: ProductUpdate[] = [];
    await writeRun(cwd, 'run-1', { status: 'agent_result_ingested' });

    const response = await method('execute.replanAbandonRun').handle(
      contextForSpec(cwd, executableGraph(), updates),
      request('execute.replanAbandonRun', { runId: 'run-1', reason: 'User chose to replan' }),
    );

    expect(response).toMatchObject({
      result: {
        status: 'abandoned',
        runStatus: 'abandoned',
        sideEffects: [{ kind: 'write_file' }],
      },
    });
    expect(updates).toEqual([
      { topic: 'execute.runs' },
      {
        topic: 'execute.run',
        runId: 'run-1',
        petriProjection: null,
        petriProjectionSource: null,
        petriProjectionReplayReason: null,
        petriReadySteps: null,
        petriBlockedSteps: null,
      },
    ]);
  });

  it('publishes replay stale-snapshot hints when abandon invalidates the persisted marking snapshot', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-execute-replan-abandon-petri-'));
    const updates: ProductUpdate[] = [];
    await writeRun(cwd, 'run-1', { status: 'agent_result_ingested' });
    await mkdir(join(runDirPath(cwd, 'run-1'), 'petrinaut'), { recursive: true });
    await writeFile(
      join(runDirPath(cwd, 'run-1'), 'petrinaut', 'net.json'),
      `${JSON.stringify({
        runId: 'run-1',
        subnets: [{ id: 'run', kind: 'run_control', transitionIds: ['worktree_create'] }],
        places: [
          { id: 'run:created', subnetId: 'run', name: 'Created' },
          { id: 'run:agent_result_ingested', subnetId: 'run', name: 'Agent result ingested' },
        ],
        transitions: [
          {
            id: 'worktree_create',
            subnetId: 'run',
            step: { kind: 'worktree_create' },
            contract: { kind: 'mechanical', lane: 'run' },
            inputArcs: [{ placeId: 'run:created', weight: 1 }],
            outputArcs: [{ placeId: 'run:agent_result_ingested', weight: 1 }],
          },
        ],
        initialMarking: { 'run:created': 1 },
      })}\n`,
      'utf8',
    );
    await writeFile(
      join(runDirPath(cwd, 'run-1'), 'petrinaut', 'events.jsonl'),
      `${JSON.stringify(
        transitionEvent({
          runId: 'run-1',
          runStatus: 'agent_result_ingested',
          produced: ['run:agent_result_ingested'],
          toStatus: 'agent_result_ingested',
        }),
      )}\n`,
      'utf8',
    );
    await writeFile(
      join(runDirPath(cwd, 'run-1'), 'petrinaut', 'marking.json'),
      `${JSON.stringify(
        {
          currentMarking: { 'run:agent_result_ingested': 2 },
          firedTransitionCount: 99,
          lifecycleProvenance: {
            runStatus: 'agent_result_ingested',
          },
        },
        null,
        2,
      )}\n`,
      'utf8',
    );

    const response = await method('execute.replanAbandonRun').handle(
      contextForSpec(cwd, executableGraph(), updates),
      request('execute.replanAbandonRun', { runId: 'run-1', reason: 'User chose to replan' }),
    );

    expect(response).toMatchObject({
      result: {
        status: 'abandoned',
        runStatus: 'abandoned',
      },
    });
    expect(updates).toEqual([
      { topic: 'execute.runs' },
      {
        topic: 'execute.run',
        runId: 'run-1',
        petriProjection: {
          currentMarking: { 'run:agent_result_ingested': 1 },
          firedTransitionCount: 1,
        },
        petriProjectionSource: 'replay',
        petriProjectionReplayReason: 'snapshot_stale',
        petriReadySteps: null,
        petriBlockedSteps: null,
      },
    ]);
  });
});
