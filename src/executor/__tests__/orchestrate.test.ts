import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ingestAgentResult } from '../agent-result.js';
import type { AgentRunnerPort, ExecutionPorts, TestRunnerPort } from '../execution-ports.js';
import { drive, linearScheduler, type ReadyStep } from '../orchestrate.js';
import { exportPetri } from '../petri.js';
import { planFilePath } from '../plan-file.js';
import { populateWorktree } from '../populate.js';
import { preparePromotion } from '../promotion.js';
import { initializeReports, reportsPath } from '../report.js';
import { completeRun } from '../run-complete.js';
import { createRun, readRunMetadata, runMetadataPath, type RunMetadata } from '../run.js';
import { completeSlice } from '../slice-complete.js';
import { requestSliceExecution } from '../slice-execute.js';
import { startSlice } from '../slice-start.js';
import { copyHostSource } from '../source-copy.js';
import { selectSourcePolicy } from '../source-policy.js';
import { ingestTestResult } from '../test-result.js';
import { createWorktree } from '../worktree.js';
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

async function readReportEvents(cwd: string): Promise<unknown[]> {
  const raw = await readFile(reportsPath(cwd, 'run-1'), 'utf8');
  return raw
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as unknown);
}

// The differential baseline for the parity oracle: crank the same lifecycle steps
// by hand, exactly as drive() composes them.
async function crankManually(cwd: string, ports: ExecutionPorts): Promise<void> {
  await createWorktree({ cwd, runId: 'run-1', gitWorktree: ports.gitWorktree });
  await populateWorktree({ cwd, runId: 'run-1' });
  await selectSourcePolicy({ cwd, runId: 'run-1', policy: 'host_source_deferred' });
  await copyHostSource({ cwd, runId: 'run-1' });
  await initializeReports({ cwd, runId: 'run-1' });
  for (;;) {
    const started = await startSlice({ cwd, runId: 'run-1' });
    if (started.status !== 'slice_started') break;
    await requestSliceExecution({ cwd, runId: 'run-1' });
    await ingestAgentResult({ cwd, runId: 'run-1', agentRunner: ports.agentRunner });
    await ingestTestResult({ cwd, runId: 'run-1', testRunner: ports.testRunner });
    await completeSlice({ cwd, runId: 'run-1' });
  }
  await completeRun({ cwd, runId: 'run-1' });
  await exportPetri({ cwd, runId: 'run-1' });
  await preparePromotion({ cwd, runId: 'run-1', gitLand: ports.gitLand });
}

describe('drive', () => {
  it('drives a created run through to run-local promotion', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-drive-complete-'));
    await createRunAtCreated(cwd, ['task-1', 'task-2']);

    const outcome = await drive({ cwd, runId: 'run-1', ports: fakePorts() });

    expect(outcome).toEqual({ status: 'completed', runStatus: 'promotion_prepared' });
    const meta = await readRunMetadata(runMetadataPath(cwd, 'run-1'));
    expect(meta?.status).toBe('promotion_prepared');
    expect(meta?.completedSliceIds).toEqual(['task-1', 'task-2']);
    expect(meta?.promotionCommitSha).toBe('abc123');
  });

  it('defaults greenfield runs to plan-only source policy without copying host source', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-drive-greenfield-plan-only-'));
    await createRunAtCreated(cwd, ['task-1']);

    await drive({ cwd, runId: 'run-1', ports: fakePorts() });

    const meta = await readRunMetadata(runMetadataPath(cwd, 'run-1'));
    expect(meta).toMatchObject({ sourcePolicy: 'plan_only', sourceCopied: false, copiedEntries: [] });
    expect(await readFile(join(cwd, 'src', 'app.ts'), 'utf8')).toBe('export const app = true;\n');
    await expect(readFile(join(meta!.worktreeDir!, 'src', 'app.ts'), 'utf8')).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('still copies host source for an explicit host-source policy', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-drive-explicit-host-source-'));
    await createRunAtCreated(cwd, ['task-1']);

    await drive({ cwd, runId: 'run-1', ports: fakePorts(), sourcePolicy: 'host_source_deferred' });

    const meta = await readRunMetadata(runMetadataPath(cwd, 'run-1'));
    expect(meta).toMatchObject({ sourcePolicy: 'host_source_deferred', sourceCopied: true });
    await expect(readFile(join(meta!.worktreeDir!, 'src', 'app.ts'), 'utf8')).resolves.toBe(
      'export const app = true;\n',
    );
  });

  it('produces the same reports and terminal metadata as hand-cranking the steps', async () => {
    const driven = await mkdtemp(join(tmpdir(), 'brunch-drive-parity-driven-'));
    await createRunAtCreated(driven, ['task-1', 'task-2']);
    await drive({ cwd: driven, runId: 'run-1', ports: fakePorts() });

    const cranked = await mkdtemp(join(tmpdir(), 'brunch-drive-parity-cranked-'));
    await createRunAtCreated(cranked, ['task-1', 'task-2']);
    await crankManually(cranked, fakePorts());

    expect(await readReportEvents(driven)).toEqual(await readReportEvents(cranked));

    const drivenMeta = await readRunMetadata(runMetadataPath(driven, 'run-1'));
    const crankedMeta = await readRunMetadata(runMetadataPath(cranked, 'run-1'));
    expect(drivenMeta?.status).toBe(crankedMeta?.status);
    expect(drivenMeta?.completedSliceIds).toEqual(crankedMeta?.completedSliceIds);
    expect(drivenMeta?.promotionCommitSha).toBe(crankedMeta?.promotionCommitSha);
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

  it('reports each advanced step through onStepComplete and skips the halted step', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-drive-step-hook-'));
    await createRunAtCreated(cwd, ['task-1']);
    const seen: string[] = [];

    const outcome = await drive({
      cwd,
      runId: 'run-1',
      ports: fakePorts({
        testRunner: createFakeTestRunnerPort({ status: 'failed', message: 'runner exploded' }),
      }),
      onStepComplete: (step, runStatus) => {
        seen.push(`${step}:${runStatus}`);
      },
    });

    expect(outcome.status).toBe('halted');
    expect(seen).toEqual([
      'worktree_create:worktree_created',
      'populate:worktree_populated',
      'source_policy:source_policy_selected',
      'source_copy:source_copied',
      'report_init:reports_initialized',
      'slice_start:slice_started',
      'slice_execute:slice_execution_requested',
      'agent_result:agent_result_ingested',
    ]);
  });

  it('a throwing onStepComplete never halts the drive', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-drive-step-hook-throw-'));
    await createRunAtCreated(cwd, ['task-1']);

    const outcome = await drive({
      cwd,
      runId: 'run-1',
      ports: fakePorts(),
      onStepComplete: () => {
        throw new Error('observer bug');
      },
    });

    expect(outcome).toEqual({ status: 'completed', runStatus: 'promotion_prepared' });
  });

  it('halts before Petri export when slice verification fails', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-drive-verification-failed-'));
    await createRunAtCreated(cwd, ['task-1']);

    const outcome = await drive({
      cwd,
      runId: 'run-1',
      ports: fakePorts({
        testRunner: createFakeTestRunnerPort({
          status: 'completed',
          verdict: 'failed',
          exitCode: 1,
          target: 'npm run verify',
        }),
      }),
    });

    expect(outcome).toEqual({
      status: 'halted',
      step: 'run_complete',
      runStatus: 'slice_completed',
      reason: 'verification_failed',
    });
    const meta = await readRunMetadata(runMetadataPath(cwd, 'run-1'));
    expect(meta?.status).toBe('slice_completed');
    expect((await readReportEvents(cwd)).map((event) => (event as { event?: string }).event)).not.toContain(
      'run_completed',
    );
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

  it('halts at promotion when the run-local land fails', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-drive-land-fail-'));
    await createRunAtCreated(cwd, ['task-1']);

    const outcome = await drive({
      cwd,
      runId: 'run-1',
      ports: fakePorts({
        gitLand: createFakeGitLandPort({ status: 'failed', message: 'land boom', sideEffects: [] }),
      }),
    });

    expect(outcome).toEqual({
      status: 'halted',
      step: 'promotion',
      runStatus: 'petri_exported',
      reason: 'promotion_failed',
    });
    const meta = await readRunMetadata(runMetadataPath(cwd, 'run-1'));
    expect(meta?.status).toBe('petri_exported');
  });

  it('halts at promotion when the land reports no changes', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-drive-land-none-'));
    await createRunAtCreated(cwd, ['task-1']);

    const outcome = await drive({
      cwd,
      runId: 'run-1',
      ports: fakePorts({
        gitLand: createFakeGitLandPort({ status: 'no_changes', message: 'nothing to land', sideEffects: [] }),
      }),
    });

    expect(outcome).toEqual({
      status: 'halted',
      step: 'promotion',
      runStatus: 'petri_exported',
      reason: 'promotion_no_changes',
    });
    const meta = await readRunMetadata(runMetadataPath(cwd, 'run-1'));
    expect(meta?.status).toBe('petri_exported');
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
      { status: 'run_completed', expected: [{ kind: 'petri_export' }] },
      { status: 'petri_exported', expected: [{ kind: 'promotion' }] },
      { status: 'promotion_prepared', expected: [] },
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
