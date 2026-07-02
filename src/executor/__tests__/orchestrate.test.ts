import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { AgentRunnerPort, ExecutionPorts, TestRunnerPort } from '../execution-ports.js';
import { drive, linearScheduler, type ReadyStep } from '../orchestrate.js';
import { planFilePath } from '../plan-file.js';
import { createRun, readRunMetadata, runMetadataPath, type RunMetadata } from '../run.js';
import {
  createFakeGitHostPromotionPort,
  createFakeGitLandPort,
  createFakeGitWorktreePort,
  createFakeTestRunnerPort,
} from './fake-ports.js';

const completedAgentRunner: AgentRunnerPort = {
  async run() {
    return { status: 'completed' };
  },
};

function fakePorts(overrides: Partial<ExecutionPorts> = {}): ExecutionPorts {
  return {
    gitWorktree: createFakeGitWorktreePort(),
    agentRunner: completedAgentRunner,
    testRunner: createFakeTestRunnerPort(),
    gitLand: createFakeGitLandPort(),
    gitHostPromotion: createFakeGitHostPromotionPort({}),
    ...overrides,
  };
}

function planJson(sliceIds: readonly string[]): string {
  return JSON.stringify({
    mode: 'greenfield',
    epics: [{ id: 'frontier-1', summary: 'Build feature', depends_on: [], verification: [] }],
    slices: sliceIds.map((id) => ({
      id,
      epic_id: 'frontier-1',
      definition: `${id}.`,
      depends_on: [],
      verification: [],
    })),
  });
}

async function createRunAtCreated(
  cwd: string,
  sliceIds: readonly string[] = ['task-1', 'task-2'],
): Promise<void> {
  await mkdir(join(cwd, 'src'), { recursive: true });
  await writeFile(join(cwd, 'src', 'app.ts'), 'export const app = true;\n', 'utf8');
  await mkdir(join(cwd, '.brunch', 'cook', 'specs', '42'), { recursive: true });
  await writeFile(planFilePath(cwd, '42'), planJson(sliceIds), 'utf8');
  await createRun({ cwd, specId: '42', runId: 'run-1' });
}

function metadata(status: RunMetadata['status'], extra: Partial<RunMetadata> = {}): RunMetadata {
  return { runId: 'run-1', specId: '42', planPath: 'plan.yaml', status, ...extra };
}

describe('drive', () => {
  it('drives a created run to run_completed through the full lifecycle', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-drive-complete-'));
    await createRunAtCreated(cwd, ['task-1', 'task-2']);

    const outcome = await drive({ cwd, runId: 'run-1', ports: fakePorts() });

    expect(outcome).toEqual({ status: 'completed', runStatus: 'run_completed' });
    const meta = await readRunMetadata(runMetadataPath(cwd, 'run-1'));
    expect(meta?.status).toBe('run_completed');
    expect(meta?.completedSliceIds).toEqual(['task-1', 'task-2']);
  });

  it('halts without advancing when a step cannot execute', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-drive-halt-'));
    await createRunAtCreated(cwd, ['task-1']);

    const outcome = await drive({
      cwd,
      runId: 'run-1',
      ports: fakePorts({
        testRunner: createFakeTestRunnerPort({ status: 'failed', message: 'runner exploded' }),
      }),
    });

    expect(outcome).toEqual({
      status: 'halted',
      step: 'test_result',
      runStatus: 'agent_result_ingested',
      reason: 'test_run_failed',
    });
    const meta = await readRunMetadata(runMetadataPath(cwd, 'run-1'));
    expect(meta?.status).toBe('agent_result_ingested');
  });

  it('invokes the agent and test runner exactly once per slice', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-drive-once-'));
    await createRunAtCreated(cwd, ['task-1', 'task-2']);

    let agentRuns = 0;
    let testRuns = 0;
    const agentRunner: AgentRunnerPort = {
      async run() {
        agentRuns += 1;
        return { status: 'completed' };
      },
    };
    const testRunner: TestRunnerPort = {
      async run() {
        testRuns += 1;
        return { status: 'completed', verdict: 'passed', exitCode: 0, target: 'npm run verify' };
      },
    };

    await drive({ cwd, runId: 'run-1', ports: fakePorts({ agentRunner, testRunner }) });

    expect(agentRuns).toBe(2);
    expect(testRuns).toBe(2);
  });
});

describe('linearScheduler', () => {
  it('returns exactly one ready step per turn and none once completed', () => {
    const cases: { readonly status: RunMetadata['status']; readonly expected: readonly ReadyStep[] }[] = [
      { status: 'created', expected: [{ kind: 'worktree_create' }] },
      { status: 'worktree_created', expected: [{ kind: 'populate' }] },
      { status: 'worktree_populated', expected: [{ kind: 'source_policy' }] },
      { status: 'source_policy_selected', expected: [{ kind: 'source_copy' }] },
      { status: 'source_copied', expected: [{ kind: 'report_init' }] },
      { status: 'slice_started', expected: [{ kind: 'slice_execute' }] },
      { status: 'slice_execution_requested', expected: [{ kind: 'agent_result' }] },
      { status: 'agent_result_ingested', expected: [{ kind: 'test_result' }] },
      { status: 'test_result_ingested', expected: [{ kind: 'slice_complete' }] },
      { status: 'run_completed', expected: [] },
    ];
    for (const { status, expected } of cases) {
      expect(linearScheduler.ready(metadata(status), undefined)).toEqual(expected);
    }
  });

  it('selects the next incomplete slice from completion facts, not the status', () => {
    const plan = { slices: [{ id: 'task-1' }, { id: 'task-2' }] };

    expect(
      linearScheduler.ready(metadata('slice_completed', { completedSliceIds: ['task-1'] }), plan),
    ).toEqual([{ kind: 'slice_start', sliceId: 'task-2' }]);

    expect(linearScheduler.ready(metadata('reports_initialized'), plan)).toEqual([
      { kind: 'slice_start', sliceId: 'task-1' },
    ]);

    expect(
      linearScheduler.ready(metadata('slice_completed', { completedSliceIds: ['task-1', 'task-2'] }), plan),
    ).toEqual([{ kind: 'run_complete' }]);
  });
});
