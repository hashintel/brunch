import { mkdirSync, rmSync } from 'node:fs';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ingestAgentResult } from '../agent-result.js';
import type { AgentRunnerPort, ExecutionPorts, TestRunnerPort } from '../execution-ports.js';
import {
  compileExecutorTopology,
  drive,
  frontierFiringPolicy,
  linearScheduler,
  type ExecutorNetEvent,
  petriScheduler,
  type ReadyStep,
  serialFiringPolicy,
} from '../orchestrate.js';
import { petriEventsPath, subscribePetriJournalFailures } from '../petri-events.js';
import { petriMarkingPath, readPetriMarkingSnapshot, writePetriMarkingSnapshot } from '../petri-marking.js';
import { petriPlanSnapshotPath } from '../petri-plan-snapshot.js';
import { petriRuntimePlanPathCandidates } from '../petri-runtime-plan.js';
import {
  bindExecutorPetriRuntime,
  enabledPetriTransitionIds,
  impliedPetriTransitionHistory,
  materializeExecutorPetriRuntime,
  projectExecutorPetriTransitionHistory,
  resolvePetriTransitionIdForReadyStep,
} from '../petri-runtime.js';
import { classifyDriveTerminal } from '../petri-terminal.js';
import { exportPetri, petriNetPath, petriSdcpnPath } from '../petri.js';
import { planFilePath } from '../plan-file.js';
import { populatedPlanPath as runPopulatedPlanPath, populateWorktree } from '../populate.js';
import { preparePromotion } from '../promotion.js';
import { initializeReports, reportsPath } from '../report.js';
import { completeRun } from '../run-complete.js';
import {
  createRun,
  readRunMetadata,
  resetActiveSliceAttempts,
  runDirPath,
  runMetadataPath,
  type RunMetadata,
} from '../run.js';
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

function flakyAgentRunner(failures: number): AgentRunnerPort & { readonly calls: () => number } {
  let calls = 0;
  return {
    calls: () => calls,
    async run() {
      calls += 1;
      return calls <= failures ? { status: 'failed', message: 'flaky agent' } : { status: 'completed' };
    },
  };
}

function flakyTestRunner(failures: number): TestRunnerPort & { readonly calls: () => number } {
  let calls = 0;
  return {
    calls: () => calls,
    async run() {
      calls += 1;
      return calls <= failures
        ? { status: 'failed', message: 'flaky verify' }
        : { status: 'completed', verdict: 'passed', exitCode: 0 };
    },
  };
}

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

function planJson(
  slices: readonly (string | { readonly id: string; readonly dependsOn?: readonly string[] })[],
  options: { readonly includeMode?: boolean } = {},
): string {
  return JSON.stringify({
    ...(options.includeMode === false ? {} : { mode: 'greenfield' }),
    epics: [{ id: 'frontier-1', summary: 'Build feature', depends_on: [], verification: [] }],
    slices: slices.map((slice, index) => {
      const sliceId = typeof slice === 'string' ? slice : slice.id;
      return {
        id: sliceId,
        epic_id: 'frontier-1',
        definition: `${sliceId}.`,
        depends_on: typeof slice === 'string' ? [] : (slice.dependsOn ?? []),
        verification: [{ kind: 'criterion', criterionId: `AC${index + 1}`, target: `${sliceId} works.` }],
        derived_from: [`REQ${index + 1}`],
      };
    }),
  });
}

async function createRunAtCreated(
  cwd: string,
  sliceIds: readonly (string | { readonly id: string; readonly dependsOn?: readonly string[] })[] = [
    'task-1',
    'task-2',
  ],
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

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function readReportEvents(cwd: string): Promise<unknown[]> {
  const raw = await readFile(reportsPath(cwd, 'run-1'), 'utf8');
  return raw
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as unknown);
}

async function readPetriEvents(cwd: string): Promise<readonly ExecutorNetEvent[]> {
  const raw = await readFile(
    join(cwd, '.brunch', 'cook', 'runs', 'run-1', 'petrinaut', 'events.jsonl'),
    'utf8',
  );
  return raw
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as ExecutorNetEvent);
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
  it('prepares Petrinaut observation before invoking the first lifecycle effect', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-drive-petrinaut-before-effect-'));
    await createRunAtCreated(cwd, ['task-1']);
    let releaseWorktree!: () => void;
    const worktreeReleased = new Promise<void>((resolve) => {
      releaseWorktree = resolve;
    });
    let worktreeStarted!: () => void;
    const worktreeStart = new Promise<void>((resolve) => {
      worktreeStarted = resolve;
    });
    const underlying = createFakeGitWorktreePort();
    const gitWorktree = createFakeGitWorktreePort(async (args) => {
      worktreeStarted();
      await worktreeReleased;
      return underlying.create(args);
    });

    const driven = drive({ cwd, runId: 'run-1', ports: fakePorts({ gitWorktree }) });
    await worktreeStart;

    expect(await pathExists(petriNetPath(cwd, 'run-1'))).toBe(true);
    expect(await pathExists(petriSdcpnPath(cwd, 'run-1'))).toBe(true);
    expect(await readFile(petriEventsPath(cwd, 'run-1'), 'utf8')).toBe('');
    expect((await readRunMetadata(runMetadataPath(cwd, 'run-1')))?.status).toBe('created');

    await writeFile(planFilePath(cwd, '42'), planJson(['changed-after-publication']), 'utf8');
    releaseWorktree();
    await expect(driven).resolves.toEqual({ status: 'completed', runStatus: 'promotion_prepared' });
    const populatedPlan = JSON.parse(await readFile(runPopulatedPlanPath(cwd, 'run-1'), 'utf8'));
    expect(populatedPlan.slices.map((slice: { readonly id: string }) => slice.id)).toEqual(['task-1']);
  });

  it('halts before the first lifecycle effect when Petrinaut observation cannot be prepared', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-drive-petrinaut-prepare-failure-'));
    await createRunAtCreated(cwd, ['task-1']);
    await writeFile(join(runDirPath(cwd, 'run-1'), 'petrinaut'), 'not-a-directory', 'utf8');
    let worktreeCalls = 0;
    const gitWorktree = createFakeGitWorktreePort(async (args) => {
      worktreeCalls += 1;
      return createFakeGitWorktreePort().create(args);
    });

    const outcome = await drive({ cwd, runId: 'run-1', ports: fakePorts({ gitWorktree }) });

    expect(outcome).toEqual({
      status: 'halted',
      step: 'worktree_create',
      runStatus: 'created',
      reason: 'petrinaut_observation_unavailable',
    });
    expect(worktreeCalls).toBe(0);
  });

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

  it('retries a failed agent attempt in-run and journals every attempt', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-drive-attempt-retry-'));
    await createRunAtCreated(cwd, ['task-1']);
    const agentRunner = flakyAgentRunner(2);

    const outcome = await drive({ cwd, runId: 'run-1', ports: fakePorts({ agentRunner }) });

    expect(outcome).toEqual({ status: 'completed', runStatus: 'promotion_prepared' });
    expect(agentRunner.calls()).toBe(3);
    const events = await readPetriEvents(cwd);
    const attempts = events.filter((event) => event.kind === 'attempt_failed');
    expect(attempts).toEqual([
      expect.objectContaining({
        sliceId: 'task-1',
        epicId: 'frontier-1',
        step: 'agent_result',
        attempt: 1,
        reason: 'agent_run_failed',
        runStatus: 'slice_execution_requested',
      }),
      expect.objectContaining({ sliceId: 'task-1', attempt: 2 }),
    ]);
    const agentFiring = events.find(
      (event) => event.kind === 'transition_fired' && event.step === 'agent_result',
    );
    expect(agentFiring).toMatchObject({ attempt: 3 });
    expect((await readRunMetadata(runMetadataPath(cwd, 'run-1')))?.activeSliceAttempts).toBeUndefined();
  });

  it('halts through the existing replan flow when agent attempts exhaust', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-drive-attempt-exhaust-'));
    await createRunAtCreated(cwd, ['task-1']);
    const agentRunner = flakyAgentRunner(Number.POSITIVE_INFINITY);

    const outcome = await drive({ cwd, runId: 'run-1', ports: fakePorts({ agentRunner }) });

    expect(outcome).toEqual({
      status: 'halted',
      step: 'agent_result',
      runStatus: 'slice_execution_requested',
      reason: 'agent_run_failed',
    });
    expect(agentRunner.calls()).toBe(3);
    const events = await readPetriEvents(cwd);
    expect(events.filter((event) => event.kind === 'attempt_failed').map((event) => event.attempt)).toEqual([
      1, 2, 3,
    ]);
    expect(events.at(-1)).toMatchObject({
      kind: 'net_halted',
      step: 'agent_result',
      reason: 'agent_run_failed',
    });
    expect((await readRunMetadata(runMetadataPath(cwd, 'run-1')))?.activeSliceAttempts).toBe(3);
  });

  it('retries a crashed verify attempt in-run and journals every attempt', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-drive-verify-attempt-retry-'));
    await createRunAtCreated(cwd, ['task-1']);
    const testRunner = flakyTestRunner(2);

    const outcome = await drive({ cwd, runId: 'run-1', ports: fakePorts({ testRunner }) });

    expect(outcome).toEqual({ status: 'completed', runStatus: 'promotion_prepared' });
    expect(testRunner.calls()).toBe(3);
    const events = await readPetriEvents(cwd);
    expect(
      events
        .filter((event) => event.kind === 'attempt_failed')
        .map((event) => ({ step: event.step, attempt: event.attempt, reason: event.reason })),
    ).toEqual([
      { step: 'test_result', attempt: 1, reason: 'test_run_failed' },
      { step: 'test_result', attempt: 2, reason: 'test_run_failed' },
    ]);
    const verifyFiring = events.find(
      (event) => event.kind === 'transition_fired' && event.step === 'test_result',
    );
    expect(verifyFiring).toMatchObject({ attempt: 3 });
    expect((await readRunMetadata(runMetadataPath(cwd, 'run-1')))?.activeSliceAttempts).toBeUndefined();
  });

  it('gives verify crashes a fresh bound after agent attempts succeeded', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-drive-per-stage-bound-'));
    await createRunAtCreated(cwd, ['task-1']);
    const agentRunner = flakyAgentRunner(2);
    const testRunner = flakyTestRunner(Number.POSITIVE_INFINITY);

    const outcome = await drive({ cwd, runId: 'run-1', ports: fakePorts({ agentRunner, testRunner }) });

    expect(outcome).toEqual({
      status: 'halted',
      step: 'test_result',
      runStatus: 'agent_result_ingested',
      reason: 'test_run_failed',
    });
    expect(agentRunner.calls()).toBe(3);
    expect(testRunner.calls()).toBe(3);
    expect(
      (await readPetriEvents(cwd))
        .filter((event) => event.kind === 'attempt_failed')
        .map((event) => ({ step: event.step, attempt: event.attempt })),
    ).toEqual([
      { step: 'agent_result', attempt: 1 },
      { step: 'agent_result', attempt: 2 },
      { step: 'test_result', attempt: 1 },
      { step: 'test_result', attempt: 2 },
      { step: 'test_result', attempt: 3 },
    ]);
  });

  it('resets the attempt bound on explicit retry so a retried drive gets fresh attempts', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-drive-attempt-reset-'));
    await createRunAtCreated(cwd, ['task-1']);
    const agentRunner = flakyAgentRunner(Number.POSITIVE_INFINITY);
    await drive({ cwd, runId: 'run-1', ports: fakePorts({ agentRunner }) });
    expect(agentRunner.calls()).toBe(3);

    await resetActiveSliceAttempts({ cwd, runId: 'run-1' });

    expect((await readRunMetadata(runMetadataPath(cwd, 'run-1')))?.activeSliceAttempts).toBeUndefined();
    const retried = await drive({ cwd, runId: 'run-1', ports: fakePorts({ agentRunner }) });
    expect(retried).toMatchObject({ status: 'halted', reason: 'agent_run_failed' });
    expect(agentRunner.calls()).toBe(6);
    expect(
      (await readPetriEvents(cwd))
        .filter((event) => event.kind === 'attempt_failed')
        .map((event) => event.attempt),
    ).toEqual([1, 2, 3, 1, 2, 3]);
  });

  it('halts without further lifecycle steps when a transition journal append fails', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-drive-journal-append-failure-'));
    await createRunAtCreated(cwd, ['task-1']);
    const ports = fakePorts();
    await expect(
      drive({ cwd, runId: 'run-1', ports }, linearScheduler, serialFiringPolicy, { maxFirings: 2 }),
    ).resolves.toEqual({ status: 'completed', runStatus: 'worktree_populated' });

    // Replace the journal file with a directory so every later appendFile fails (EISDIR).
    const journalPath = petriEventsPath(cwd, 'run-1');
    await rm(journalPath);
    await mkdir(journalPath);
    let failureWakeUps = 0;
    const unsubscribe = subscribePetriJournalFailures({
      cwd,
      runId: 'run-1',
      listener: () => {
        failureWakeUps += 1;
      },
    });

    try {
      await expect(drive({ cwd, runId: 'run-1', ports })).resolves.toEqual({
        status: 'halted',
        step: 'source_policy',
        runStatus: 'source_policy_selected',
        reason: 'petri_journal_append_failed',
      });
    } finally {
      unsubscribe();
    }
    expect((await readRunMetadata(runMetadataPath(cwd, 'run-1')))?.status).toBe('source_policy_selected');
    expect(failureWakeUps).toBe(1);
    const snapshot = await readPetriMarkingSnapshot({ cwd, runId: 'run-1' });
    expect(snapshot?.terminalEventKind).toBeUndefined();
  });

  it('halts scheduler exhaustion without persisting a terminal snapshot when the terminal append fails', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-drive-terminal-journal-failure-'));
    await createRunAtCreated(cwd, ['task-1']);
    const ports = fakePorts();
    await expect(drive({ cwd, runId: 'run-1', ports })).resolves.toEqual({
      status: 'completed',
      runStatus: 'promotion_prepared',
    });

    await rm(petriMarkingPath(cwd, 'run-1'));
    const journalPath = petriEventsPath(cwd, 'run-1');
    await rm(journalPath);
    await mkdir(journalPath);

    await expect(drive({ cwd, runId: 'run-1', ports })).resolves.toEqual({
      status: 'halted',
      step: 'terminal',
      runStatus: 'promotion_prepared',
      reason: 'petri_journal_append_failed',
    });
    expect(await pathExists(petriMarkingPath(cwd, 'run-1'))).toBe(false);
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

  it('treats omitted plan mode as greenfield when selecting source policy', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-drive-omitted-mode-plan-only-'));
    await mkdir(join(cwd, 'src'), { recursive: true });
    await writeFile(join(cwd, 'src', 'app.ts'), 'export const app = true;\n', 'utf8');
    await mkdir(join(cwd, '.brunch', 'cook', 'specs', '42'), { recursive: true });
    await writeFile(planFilePath(cwd, '42'), planJson(['task-1'], { includeMode: false }), 'utf8');
    await createRun({ cwd, specId: '42', runId: 'run-1' });

    await drive({ cwd, runId: 'run-1', ports: fakePorts() });

    const meta = await readRunMetadata(runMetadataPath(cwd, 'run-1'));
    expect(meta).toMatchObject({ sourcePolicy: 'plan_only', sourceCopied: false, copiedEntries: [] });
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

  it('reports started and completed steps, and skips completion for the halted step', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-drive-step-hook-'));
    await createRunAtCreated(cwd, ['task-1']);
    const seen: string[] = [];

    const outcome = await drive({
      cwd,
      runId: 'run-1',
      ports: fakePorts({
        testRunner: createFakeTestRunnerPort({ status: 'failed', message: 'runner exploded' }),
      }),
      onStepStart: (step, runStatus) => {
        seen.push(`start:${step}:${runStatus}`);
      },
      onStepComplete: (step, runStatus) => {
        seen.push(`complete:${step}:${runStatus}`);
      },
    });

    expect(outcome.status).toBe('halted');
    expect(seen).toEqual([
      'start:worktree_create:created',
      'complete:worktree_create:worktree_created',
      'start:populate:worktree_created',
      'complete:populate:worktree_populated',
      'start:source_policy:worktree_populated',
      'complete:source_policy:source_policy_selected',
      'start:source_copy:source_policy_selected',
      'complete:source_copy:source_copied',
      'start:report_init:source_copied',
      'complete:report_init:reports_initialized',
      'start:slice_start:reports_initialized',
      'complete:slice_start:slice_started',
      'start:slice_execute:slice_started',
      'complete:slice_execute:slice_execution_requested',
      'start:agent_result:slice_execution_requested',
      'complete:agent_result:agent_result_ingested',
      'start:test_result:agent_result_ingested',
      'start:test_result:agent_result_ingested',
      'start:test_result:agent_result_ingested',
    ]);
  });

  it('throwing step observers never halt the drive', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-drive-step-hook-throw-'));
    await createRunAtCreated(cwd, ['task-1']);

    const outcome = await drive({
      cwd,
      runId: 'run-1',
      ports: fakePorts(),
      onStepStart: () => {
        throw new Error('observer bug');
      },
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

describe('classifyDriveTerminal', () => {
  it('classifies only terminal runs as completed and nonterminal exhaustion as deadlocked', () => {
    expect(
      classifyDriveTerminal({ kind: 'scheduler_exhausted', runId: 'run-1', runStatus: 'promotion_prepared' }),
    ).toEqual({
      event: { kind: 'net_completed', runId: 'run-1', runStatus: 'promotion_prepared' },
      outcome: { status: 'completed', runStatus: 'promotion_prepared' },
    });

    expect(
      classifyDriveTerminal({ kind: 'scheduler_exhausted', runId: 'run-1', runStatus: 'abandoned' }),
    ).toEqual({
      event: { kind: 'net_halted', runId: 'run-1', runStatus: 'abandoned', reason: 'abandoned' },
      outcome: { status: 'halted', step: 'abandoned', runStatus: 'abandoned', reason: 'abandoned' },
    });

    expect(
      classifyDriveTerminal({
        kind: 'scheduler_exhausted',
        runId: 'run-1',
        runStatus: 'reports_initialized',
      }),
    ).toEqual({
      event: { kind: 'net_deadlocked', runId: 'run-1', runStatus: 'reports_initialized' },
      outcome: {
        status: 'halted',
        step: 'deadlocked',
        runStatus: 'reports_initialized',
        reason: 'petri_deadlocked',
      },
    });
  });

  it('classifies a non-advancing step as a halted terminal with the same reason in the event and outcome', () => {
    expect(
      classifyDriveTerminal({
        kind: 'step_halted',
        runId: 'run-1',
        runStatus: 'agent_result_ingested',
        step: 'test_result',
        reason: 'test_run_failed',
      }),
    ).toEqual({
      event: {
        kind: 'net_halted',
        runId: 'run-1',
        runStatus: 'agent_result_ingested',
        step: 'test_result',
        reason: 'test_run_failed',
      },
      outcome: {
        status: 'halted',
        step: 'test_result',
        runStatus: 'agent_result_ingested',
        reason: 'test_run_failed',
      },
    });
  });
});

describe('petri runtime helpers', () => {
  it('derive enabled transition ids and ready-step transition ids from the same slice-frontier facts', () => {
    const plan = { mode: 'greenfield', slices: [{ id: 'task-1' }, { id: 'task-2' }] } as const;

    expect(
      enabledPetriTransitionIds(metadata('slice_completed', { completedSliceIds: ['task-1'] }), plan),
    ).toEqual(['slice_start:task-2']);
    expect(
      resolvePetriTransitionIdForReadyStep(
        { kind: 'slice_start', sliceId: 'task-2' },
        metadata('slice_completed', { completedSliceIds: ['task-1'] }),
        plan,
      ),
    ).toBe('slice_start:task-2');

    expect(enabledPetriTransitionIds(metadata('agent_result_ingested', {}), plan)).toEqual([
      'test_result:task-1',
    ]);
    expect(
      resolvePetriTransitionIdForReadyStep(
        { kind: 'test_result', sliceId: 'task-1' },
        metadata('agent_result_ingested', {}),
        plan,
      ),
    ).toBe('test_result:task-1');

    expect(enabledPetriTransitionIds(metadata('promotion_prepared'), plan)).toEqual([]);
  });

  it('surfaces every dependency-ready slice start in the Petri frontier while serial policy still picks one', () => {
    const plan = {
      mode: 'greenfield',
      slices: [{ id: 'task-1' }, { id: 'task-2', depends_on: ['task-1'] }, { id: 'task-3' }],
    } as const;
    const runtime = materializeExecutorPetriRuntime(metadata('reports_initialized'), plan);

    const frontier = petriScheduler.ready(metadata('reports_initialized'), plan);

    expect(frontier).toEqual([
      { kind: 'slice_start', sliceId: 'task-1' },
      { kind: 'slice_start', sliceId: 'task-3' },
    ]);
    expect(
      serialFiringPolicy.select({ readySteps: frontier, state: metadata('reports_initialized'), plan }),
    ).toEqual([{ kind: 'slice_start', sliceId: 'task-1' }]);
    expect(
      frontierFiringPolicy.select({
        readySteps: frontier,
        readyRuntime: {
          currentMarking: runtime.currentMarking,
          enabledTransitions: frontier.map((step) => runtime.transitionForReadyStep(step)),
        },
        state: metadata('reports_initialized'),
        plan,
      }),
    ).toEqual([{ kind: 'slice_start', sliceId: 'task-1' }]);
  });

  it('surfaces blocked slice starts with unmet dependency ids alongside the ready frontier', () => {
    const plan = {
      mode: 'greenfield',
      slices: [{ id: 'task-1' }, { id: 'task-2', depends_on: ['task-1'] }, { id: 'task-3' }],
    } as const;

    const runtime = materializeExecutorPetriRuntime(metadata('reports_initialized'), plan);

    expect(runtime.blockedSteps).toEqual([
      { kind: 'slice_start', sliceId: 'task-2', blockers: [{ kind: 'dependency', sliceId: 'task-1' }] },
    ]);
  });

  it('surfaces dependency-ready slice starts as blocked by the active slice while another slice is in flight', () => {
    const plan = { mode: 'greenfield', slices: [{ id: 'task-1' }, { id: 'task-2' }] } as const;

    const runtime = materializeExecutorPetriRuntime(
      metadata('slice_started', { activeSliceId: 'task-1' }),
      plan,
    );

    expect(runtime.blockedSteps).toEqual([
      { kind: 'slice_start', sliceId: 'task-2', blockers: [{ kind: 'active_slice', sliceId: 'task-1' }] },
    ]);
  });

  it('rejects duplicate slice ids before materializing Petri runtime identity', () => {
    const plan = { mode: 'greenfield', slices: [{ id: 'task-1' }, { id: 'task-1' }] } as const;

    expect(() => materializeExecutorPetriRuntime(metadata('created'), plan)).toThrow(
      'Duplicate slice id in executor topology: task-1',
    );
  });

  it('rejects self-referential, unknown, and cyclic slice dependencies before materializing runtime identity', () => {
    expect(() =>
      compileExecutorTopology({
        mode: 'greenfield',
        slices: [{ id: 'task-1', depends_on: ['task-1'] }],
      }),
    ).toThrow('Slice cannot depend on itself in executor topology: task-1');

    expect(() =>
      compileExecutorTopology({
        mode: 'greenfield',
        slices: [{ id: 'task-1', depends_on: ['missing'] }],
      }),
    ).toThrow('Unknown slice dependency in executor topology: task-1 -> missing');

    expect(() =>
      compileExecutorTopology({
        mode: 'greenfield',
        slices: [
          { id: 'task-1', depends_on: ['task-2'] },
          { id: 'task-2', depends_on: ['task-1'] },
        ],
      }),
    ).toThrow('Cyclic slice dependency in executor topology: task-1');
  });

  it('rejects completed-slice history that is duplicated or violates dependency order', () => {
    const plan = {
      mode: 'greenfield',
      slices: [{ id: 'task-1' }, { id: 'task-2', depends_on: ['task-1'] }],
    } as const;

    expect(() =>
      materializeExecutorPetriRuntime(metadata('slice_completed', { completedSliceIds: ['task-2'] }), plan),
    ).toThrow('Cannot project Petri transition history for run status slice_completed');
    expect(() =>
      materializeExecutorPetriRuntime(
        metadata('slice_completed', { completedSliceIds: ['task-1', 'task-1'] }),
        plan,
      ),
    ).toThrow('Cannot project Petri transition history for run status slice_completed');
  });

  it('checks the known worktree plan before the source plan throughout post-population statuses', () => {
    const cwd = '/workspace';
    for (const status of [
      'worktree_populated',
      'source_policy_selected',
      'source_copied',
      'reports_initialized',
      'slice_started',
      'slice_execution_requested',
      'agent_result_ingested',
      'test_result_ingested',
      'slice_completed',
      'run_completed',
      'petri_exported',
      'promotion_prepared',
    ] as const) {
      expect(petriRuntimePlanPathCandidates(cwd, metadata(status))).toEqual([
        runPopulatedPlanPath(cwd, 'run-1'),
        petriPlanSnapshotPath(cwd, 'run-1'),
        'plan.yaml',
      ]);
    }
  });

  it('materializes a marking-backed runtime view over the compiled topology for the current serial state', () => {
    const plan = { mode: 'greenfield', slices: [{ id: 'task-1' }, { id: 'task-2' }] } as const;

    const frontierRuntime = materializeExecutorPetriRuntime(
      metadata('slice_completed', { completedSliceIds: ['task-1'] }),
      plan,
    );
    expect(frontierRuntime.currentMarking).toEqual({ 'run:slice_frontier': 1 });
    expect(frontierRuntime.enabledTransitions.map((transition) => transition.id)).toEqual([
      'slice_start:task-2',
    ]);
    expect(frontierRuntime.readySteps).toEqual([{ kind: 'slice_start', sliceId: 'task-2' }]);

    const inFlightRuntime = materializeExecutorPetriRuntime(metadata('agent_result_ingested', {}), plan);
    expect(inFlightRuntime.currentMarking).toEqual({ 'slice:task-1:agent_result_ingested': 1 });
    expect(inFlightRuntime.enabledTransitions.map((transition) => transition.id)).toEqual([
      'test_result:task-1',
    ]);
    expect(inFlightRuntime.transitionForReadyStep({ kind: 'test_result', sliceId: 'task-1' })?.id).toBe(
      'test_result:task-1',
    );
  });

  it('uses Petri input arcs with executor frontier guards, not raw place fan-out, to pick enabled transitions', () => {
    const plan = {
      mode: 'greenfield',
      slices: [{ id: 'task-1' }, { id: 'task-2', depends_on: ['task-1'] }, { id: 'task-3' }],
    } as const;

    const frontierRuntime = materializeExecutorPetriRuntime(metadata('reports_initialized'), plan);

    expect(frontierRuntime.currentMarking).toEqual({ 'run:slice_frontier': 1 });
    expect(frontierRuntime.enabledTransitions.map((transition) => transition.id)).toEqual([
      'slice_start:task-1',
      'slice_start:task-3',
    ]);
    expect(frontierRuntime.enabledTransitions.map((transition) => transition.step)).toEqual([
      { kind: 'slice_start', sliceId: 'task-1' },
      { kind: 'slice_start', sliceId: 'task-3' },
    ]);

    const unblockedRuntime = materializeExecutorPetriRuntime(
      metadata('slice_completed', { completedSliceIds: ['task-1'] }),
      plan,
    );
    expect(unblockedRuntime.currentMarking).toEqual({ 'run:slice_frontier': 1 });
    expect(unblockedRuntime.enabledTransitions.map((transition) => transition.id)).toEqual([
      'slice_start:task-2',
      'slice_start:task-3',
    ]);
    expect(unblockedRuntime.enabledTransitions.map((transition) => transition.step)).toEqual([
      { kind: 'slice_start', sliceId: 'task-2' },
      { kind: 'slice_start', sliceId: 'task-3' },
    ]);

    const doneRuntime = materializeExecutorPetriRuntime(
      metadata('slice_completed', { completedSliceIds: ['task-1', 'task-2', 'task-3'] }),
      plan,
    );
    expect(doneRuntime.currentMarking).toEqual({ 'run:slice_frontier': 1 });
    expect(doneRuntime.enabledTransitions.map((transition) => transition.id)).toEqual(['run_complete']);
  });

  it('derives current marking by replaying the transition history implied by lifecycle facts', () => {
    const plan = { mode: 'greenfield', slices: [{ id: 'task-1' }, { id: 'task-2' }] } as const;

    expect(
      projectExecutorPetriTransitionHistory(
        metadata('agent_result_ingested', {
          completedSliceIds: ['task-1'],
          activeSliceId: 'task-2',
        }),
        plan,
      ),
    ).toEqual({
      currentSliceId: 'task-2',
      transitionIds: [
        'worktree_create',
        'populate',
        'source_policy',
        'source_copy',
        'report_init',
        'slice_start:task-1',
        'slice_execute:task-1',
        'agent_result:task-1',
        'test_result:task-1',
        'slice_complete:task-1',
        'slice_start:task-2',
        'slice_execute:task-2',
        'agent_result:task-2',
      ],
    });

    expect(impliedPetriTransitionHistory(metadata('abandoned'), plan)).toBeUndefined();

    const inFlightRuntime = materializeExecutorPetriRuntime(
      metadata('agent_result_ingested', {
        completedSliceIds: ['task-1'],
        activeSliceId: 'task-2',
      }),
      plan,
    );
    expect(inFlightRuntime.currentMarking).toEqual({ 'slice:task-2:agent_result_ingested': 1 });
  });

  it('binds materialized Petri transitions to the existing lifecycle step handlers', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-runtime-bindings-'));
    await createRunAtCreated(cwd, ['task-1']);

    const createdState = await readRunMetadata(runMetadataPath(cwd, 'run-1'));
    const createdRuntime = materializeExecutorPetriRuntime(createdState!, undefined);
    const createdBindings = bindExecutorPetriRuntime(createdRuntime, {
      cwd,
      runId: 'run-1',
      ports: fakePorts(),
    });

    const worktreeTransition = createdBindings.transitionForReadyStep({ kind: 'worktree_create' });
    expect(worktreeTransition?.transition.id).toBe('worktree_create');
    await expect(worktreeTransition?.execute()).resolves.toMatchObject({
      status: 'worktree_created',
      runStatus: 'worktree_created',
    });

    await populateWorktree({ cwd, runId: 'run-1' });
    await selectSourcePolicy({ cwd, runId: 'run-1', policy: 'plan_only' });
    await copyHostSource({ cwd, runId: 'run-1' });
    await initializeReports({ cwd, runId: 'run-1' });

    const reportsReadyState = await readRunMetadata(runMetadataPath(cwd, 'run-1'));
    const reportsReadyRuntime = materializeExecutorPetriRuntime(reportsReadyState!, {
      mode: 'greenfield',
      slices: [{ id: 'task-1' }],
    });
    const reportsReadyBindings = bindExecutorPetriRuntime(reportsReadyRuntime, {
      cwd,
      runId: 'run-1',
      ports: fakePorts(),
    });

    const sliceStartTransition = reportsReadyBindings.transitionForReadyStep({
      kind: 'slice_start',
      sliceId: 'task-1',
    });
    expect(sliceStartTransition?.transition.id).toBe('slice_start:task-1');
    await expect(sliceStartTransition?.execute()).resolves.toMatchObject({
      status: 'slice_started',
      runStatus: 'slice_started',
      sliceId: 'task-1',
    });
  });
});

describe('linearScheduler', () => {
  it('returns exactly one ready step per turn and none once completed', () => {
    const slicePlan = { slices: [{ id: 'task-1' }] };
    const cases: {
      readonly status: RunMetadata['status'];
      readonly extra?: Partial<RunMetadata>;
      readonly plan?: Parameters<typeof linearScheduler.ready>[1];
      readonly expected: readonly ReadyStep[];
    }[] = [
      { status: 'created', expected: [{ kind: 'worktree_create' }] },
      { status: 'worktree_created', expected: [{ kind: 'populate' }] },
      { status: 'worktree_populated', expected: [{ kind: 'source_policy' }] },
      { status: 'source_policy_selected', expected: [{ kind: 'source_copy' }] },
      { status: 'source_copied', expected: [{ kind: 'report_init' }] },
      {
        status: 'slice_started',
        extra: { activeSliceId: 'task-1' },
        plan: slicePlan,
        expected: [{ kind: 'slice_execute', sliceId: 'task-1' }],
      },
      {
        status: 'slice_execution_requested',
        extra: { activeSliceId: 'task-1' },
        plan: slicePlan,
        expected: [{ kind: 'agent_result', sliceId: 'task-1' }],
      },
      {
        status: 'agent_result_ingested',
        extra: { activeSliceId: 'task-1' },
        plan: slicePlan,
        expected: [{ kind: 'test_result', sliceId: 'task-1' }],
      },
      {
        status: 'test_result_ingested',
        extra: { activeSliceId: 'task-1' },
        plan: slicePlan,
        expected: [{ kind: 'slice_complete', sliceId: 'task-1' }],
      },
      { status: 'run_completed', expected: [{ kind: 'petri_export' }] },
      { status: 'petri_exported', expected: [{ kind: 'promotion' }] },
      { status: 'promotion_prepared', expected: [] },
    ];
    for (const { status, extra, plan, expected } of cases) {
      expect(linearScheduler.ready(metadata(status, extra), plan)).toEqual(expected);
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

  it('starts only slices whose declared dependencies are complete', () => {
    const plan = {
      slices: [
        { id: 'task-2', depends_on: ['task-1'] },
        { id: 'task-1', depends_on: [] },
      ],
    };

    expect(linearScheduler.ready(metadata('reports_initialized'), plan)).toEqual([
      { kind: 'slice_start', sliceId: 'task-1' },
    ]);
    expect(
      linearScheduler.ready(metadata('slice_completed', { completedSliceIds: ['task-1'] }), plan),
    ).toEqual([{ kind: 'slice_start', sliceId: 'task-2' }]);
  });

  it('rejects cyclic slice dependencies before scheduling', () => {
    const plan = {
      slices: [
        { id: 'task-1', depends_on: ['task-2'] },
        { id: 'task-2', depends_on: ['task-1'] },
      ],
    };

    expect(() => linearScheduler.ready(metadata('reports_initialized'), plan)).toThrow(
      'Cyclic slice dependency in executor topology: task-1',
    );
  });
});

describe('compileExecutorTopology', () => {
  it('preserves one run subnet and one slice subnet per slice, including the source-policy boundary', () => {
    const topology = compileExecutorTopology({
      mode: 'greenfield',
      epics: [
        { id: 'frontier-1', summary: 'Build foundation', depends_on: [], verification: [] },
        { id: 'frontier-2', summary: 'Build feature', depends_on: ['frontier-1'], verification: [] },
      ],
      slices: [
        {
          id: 'task-1',
          epic_id: 'frontier-1',
          definition: 'Implement foundation.',
          verification: [{ kind: 'criterion', criterionId: 'AC1', target: 'Foundation works.' }],
          derived_from: ['REQ1'],
        },
        {
          id: 'task-2',
          epic_id: 'frontier-2',
          definition: 'Implement feature.',
          verification: [{ kind: 'criterion', criterionId: 'AC2', target: 'Feature works.' }],
          derived_from: ['REQ2'],
        },
      ],
    });

    expect(topology.epics).toEqual([
      {
        id: 'frontier-1',
        summary: 'Build foundation',
        dependsOn: [],
        verification: [],
        sliceIds: ['task-1'],
      },
      {
        id: 'frontier-2',
        summary: 'Build feature',
        dependsOn: ['frontier-1'],
        verification: [],
        sliceIds: ['task-2'],
      },
    ]);

    expect(topology.subnets).toEqual([
      {
        id: 'run',
        kind: 'run_control',
        transitionIds: [
          'worktree_create',
          'populate',
          'source_policy',
          'source_copy',
          'report_init',
          'run_complete',
          'petri_export',
          'promotion',
        ],
      },
      {
        id: 'slice:task-1',
        kind: 'slice_control',
        sliceId: 'task-1',
        epicId: 'frontier-1',
        definition: 'Implement foundation.',
        verification: [{ kind: 'criterion', criterionId: 'AC1', target: 'Foundation works.' }],
        derivedFrom: ['REQ1'],
        transitionIds: [
          'slice_start:task-1',
          'slice_execute:task-1',
          'agent_result:task-1',
          'test_result:task-1',
          'slice_complete:task-1',
        ],
      },
      {
        id: 'slice:task-2',
        kind: 'slice_control',
        sliceId: 'task-2',
        epicId: 'frontier-2',
        definition: 'Implement feature.',
        verification: [{ kind: 'criterion', criterionId: 'AC2', target: 'Feature works.' }],
        derivedFrom: ['REQ2'],
        transitionIds: [
          'slice_start:task-2',
          'slice_execute:task-2',
          'agent_result:task-2',
          'test_result:task-2',
          'slice_complete:task-2',
        ],
      },
    ]);
    expect(topology.transitions).toContainEqual(
      expect.objectContaining({
        id: 'source_policy',
        subnetId: 'run',
        step: { kind: 'source_policy' },
      }),
    );
    expect(topology.transitions).toContainEqual(
      expect.objectContaining({
        id: 'slice_start:task-1',
        subnetId: 'slice:task-1',
        epicId: 'frontier-1',
      }),
    );
  });

  it('compiles executor frontier policy into transition guards instead of leaving it implicit in the runtime', () => {
    const topology = compileExecutorTopology({
      mode: 'greenfield',
      slices: [{ id: 'task-1' }, { id: 'task-2', depends_on: ['task-1'] }],
    });

    expect(topology.transitions).toContainEqual(
      expect.objectContaining({
        id: 'slice_start:task-1',
        guard: { kind: 'slice_ready', sliceId: 'task-1', dependsOn: [] },
      }),
    );
    expect(topology.transitions).toContainEqual(
      expect.objectContaining({
        id: 'slice_start:task-2',
        guard: { kind: 'slice_ready', sliceId: 'task-2', dependsOn: ['task-1'] },
      }),
    );
    expect(topology.transitions).toContainEqual(
      expect.objectContaining({
        id: 'run_complete',
        guard: { kind: 'no_remaining_slices' },
      }),
    );
    expect(topology.transitions).toContainEqual(
      expect.objectContaining({
        id: 'test_result:task-2',
        guard: { kind: 'active_slice', sliceId: 'task-2' },
      }),
    );
  });
});

describe('petriScheduler', () => {
  it('keeps linear scheduling as the serial firing-policy view over the Petri frontier', () => {
    const plan = { mode: 'greenfield' as const, slices: [{ id: 'task-1' }, { id: 'task-2' }] };
    const cases: RunMetadata['status'][] = [
      'created',
      'worktree_created',
      'worktree_populated',
      'source_policy_selected',
      'source_copied',
      'reports_initialized',
      'slice_started',
      'slice_execution_requested',
      'agent_result_ingested',
      'test_result_ingested',
      'slice_completed',
      'run_completed',
      'petri_exported',
      'promotion_prepared',
      'abandoned',
    ];

    for (const status of cases) {
      const state =
        status === 'slice_completed' ? metadata(status, { completedSliceIds: ['task-1'] }) : metadata(status);
      expect(
        serialFiringPolicy.select({ readySteps: petriScheduler.ready(state, plan), state, plan }),
      ).toEqual(linearScheduler.ready(state, plan));
    }
  });

  it('drives the run to the same terminal state as the linear scheduler', async () => {
    const linear = await mkdtemp(join(tmpdir(), 'brunch-petri-scheduler-linear-'));
    await createRunAtCreated(linear, ['task-1', 'task-2']);
    const linearOutcome = await drive({ cwd: linear, runId: 'run-1', ports: fakePorts() }, linearScheduler);

    const petri = await mkdtemp(join(tmpdir(), 'brunch-petri-scheduler-petri-'));
    await createRunAtCreated(petri, ['task-1', 'task-2']);
    const petriOutcome = await drive({ cwd: petri, runId: 'run-1', ports: fakePorts() }, petriScheduler);

    expect(petriOutcome).toEqual(linearOutcome);
    expect(await readReportEvents(petri)).toEqual(await readReportEvents(linear));
    expect(await readRunMetadata(runMetadataPath(petri, 'run-1'))).toMatchObject({
      status: 'promotion_prepared',
      completedSliceIds: ['task-1', 'task-2'],
      sourcePolicy: 'plan_only',
      promotionCommitSha: 'abc123',
    });
  });

  it('passes the full ready frontier through firing policy selection before each drive step', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-firing-policy-frontier-'));
    await createRunAtCreated(cwd, [
      { id: 'task-1' },
      { id: 'task-2', dependsOn: ['task-1'] },
      { id: 'task-3' },
    ]);
    const seenFrontiers: string[][] = [];

    const outcome = await drive({ cwd, runId: 'run-1', ports: fakePorts() }, petriScheduler, {
      select({ readySteps }) {
        seenFrontiers.push(
          readySteps.map((step) =>
            step.kind === 'slice_start' ? `${step.kind}:${step.sliceId}` : step.kind,
          ),
        );
        return readySteps;
      },
    });

    expect(outcome).toEqual({ status: 'completed', runStatus: 'promotion_prepared' });
    expect(seenFrontiers).toContainEqual(['slice_start:task-1', 'slice_start:task-3']);
    expect(seenFrontiers).toContainEqual(['slice_start:task-2', 'slice_start:task-3']);
  });

  it('emits transition events in lifecycle order, including the source-policy boundary', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-events-'));
    await createRunAtCreated(cwd, ['task-1']);
    const seen: ExecutorNetEvent[] = [];

    const outcome = await drive(
      {
        cwd,
        runId: 'run-1',
        ports: fakePorts(),
        onNetEvent: (event) => {
          seen.push(event);
        },
      },
      petriScheduler,
    );

    expect(outcome).toEqual({ status: 'completed', runStatus: 'promotion_prepared' });
    expect(seen.map((event) => event.kind)).toEqual([
      'transition_fired',
      'transition_fired',
      'transition_fired',
      'transition_fired',
      'transition_fired',
      'transition_fired',
      'transition_fired',
      'transition_fired',
      'transition_fired',
      'transition_fired',
      'transition_fired',
      'transition_fired',
      'transition_fired',
      'net_completed',
    ]);
    expect(
      seen
        .filter((event) => event.kind === 'transition_fired')
        .map((event) => ({
          transitionId: event.transitionId,
          subnetId: event.subnetId,
          ...(event.epicId === undefined ? {} : { epicId: event.epicId }),
          ...(event.derivedFrom === undefined ? {} : { derivedFrom: event.derivedFrom }),
          contract: event.contract,
          consumed: event.consumed,
          produced: event.produced,
          fromStatus: event.fromStatus,
          toStatus: event.toStatus,
        })),
    ).toEqual([
      {
        transitionId: 'worktree_create',
        subnetId: 'run',
        contract: { kind: 'mechanical', lane: 'run' },
        consumed: ['run:created'],
        produced: ['run:worktree_created'],
        fromStatus: 'created',
        toStatus: 'worktree_created',
      },
      {
        transitionId: 'populate',
        subnetId: 'run',
        contract: { kind: 'mechanical', lane: 'run' },
        consumed: ['run:worktree_created'],
        produced: ['run:worktree_populated'],
        fromStatus: 'worktree_created',
        toStatus: 'worktree_populated',
      },
      {
        transitionId: 'source_policy',
        subnetId: 'run',
        contract: { kind: 'structural', lane: 'run' },
        consumed: ['run:worktree_populated'],
        produced: ['run:source_policy_selected'],
        fromStatus: 'worktree_populated',
        toStatus: 'source_policy_selected',
      },
      {
        transitionId: 'source_copy',
        subnetId: 'run',
        contract: { kind: 'mechanical', lane: 'run' },
        consumed: ['run:source_policy_selected'],
        produced: ['run:source_copied'],
        fromStatus: 'source_policy_selected',
        toStatus: 'source_copied',
      },
      {
        transitionId: 'report_init',
        subnetId: 'run',
        contract: { kind: 'mechanical', lane: 'run' },
        consumed: ['run:source_copied'],
        produced: ['run:slice_frontier'],
        fromStatus: 'source_copied',
        toStatus: 'reports_initialized',
      },
      {
        transitionId: 'slice_start:task-1',
        subnetId: 'slice:task-1',
        epicId: 'frontier-1',
        derivedFrom: ['REQ1'],
        contract: { kind: 'structural', lane: 'slice' },
        consumed: ['run:slice_frontier'],
        produced: ['slice:task-1:started'],
        fromStatus: 'reports_initialized',
        toStatus: 'slice_started',
      },
      {
        transitionId: 'slice_execute:task-1',
        subnetId: 'slice:task-1',
        epicId: 'frontier-1',
        derivedFrom: ['REQ1'],
        contract: { kind: 'mechanical', lane: 'slice' },
        consumed: ['slice:task-1:started'],
        produced: ['slice:task-1:execution_requested'],
        fromStatus: 'slice_started',
        toStatus: 'slice_execution_requested',
      },
      {
        transitionId: 'agent_result:task-1',
        subnetId: 'slice:task-1',
        epicId: 'frontier-1',
        derivedFrom: ['REQ1'],
        contract: { kind: 'mechanical', lane: 'slice' },
        consumed: ['slice:task-1:execution_requested'],
        produced: ['slice:task-1:agent_result_ingested'],
        fromStatus: 'slice_execution_requested',
        toStatus: 'agent_result_ingested',
      },
      {
        transitionId: 'test_result:task-1',
        subnetId: 'slice:task-1',
        epicId: 'frontier-1',
        derivedFrom: ['REQ1'],
        contract: { kind: 'mechanical', lane: 'slice' },
        consumed: ['slice:task-1:agent_result_ingested'],
        produced: ['slice:task-1:test_result_ingested'],
        fromStatus: 'agent_result_ingested',
        toStatus: 'test_result_ingested',
      },
      {
        transitionId: 'slice_complete:task-1',
        subnetId: 'slice:task-1',
        epicId: 'frontier-1',
        derivedFrom: ['REQ1'],
        contract: { kind: 'structural', lane: 'slice' },
        consumed: ['slice:task-1:test_result_ingested'],
        produced: ['run:slice_frontier'],
        fromStatus: 'test_result_ingested',
        toStatus: 'slice_completed',
      },
      {
        transitionId: 'run_complete',
        subnetId: 'run',
        contract: { kind: 'mechanical', lane: 'run' },
        consumed: ['run:slice_frontier'],
        produced: ['run:run_completed'],
        fromStatus: 'slice_completed',
        toStatus: 'run_completed',
      },
      {
        transitionId: 'petri_export',
        subnetId: 'run',
        contract: { kind: 'mechanical', lane: 'run' },
        consumed: ['run:run_completed'],
        produced: ['run:petri_exported'],
        fromStatus: 'run_completed',
        toStatus: 'petri_exported',
      },
      {
        transitionId: 'promotion',
        subnetId: 'run',
        contract: { kind: 'mechanical', lane: 'run' },
        consumed: ['run:petri_exported'],
        produced: ['run:promotion_prepared'],
        fromStatus: 'petri_exported',
        toStatus: 'promotion_prepared',
      },
    ]);
    expect(seen.at(-1)).toEqual({
      kind: 'net_completed',
      runId: 'run-1',
      runStatus: 'promotion_prepared',
    });
    expect(await readPetriEvents(cwd)).toEqual(seen);
  });

  it('persists a durable marking snapshot alongside the runtime event journal', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-marking-'));
    await createRunAtCreated(cwd, ['task-1']);

    const outcome = await drive({ cwd, runId: 'run-1', ports: fakePorts() }, petriScheduler);

    expect(outcome).toEqual({ status: 'completed', runStatus: 'promotion_prepared' });
    await expect(readPetriMarkingSnapshot({ cwd, runId: 'run-1' })).resolves.toEqual({
      currentMarking: { 'run:promotion_prepared': 1 },
      firedTransitionCount: 13,
      lifecycleProvenance: {
        activeSliceId: 'task-1',
        runStatus: 'promotion_prepared',
        completedSliceIds: ['task-1'],
      },
      terminalEventKind: 'net_completed',
    });
  });

  it('persists the selected Petri claim-set before the first reserved transition fires', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-marking-claims-'));
    await createRunAtCreated(cwd, ['task-1', 'task-2']);
    let claimedSnapshotPromise: Promise<Awaited<ReturnType<typeof readPetriMarkingSnapshot>>> | undefined;

    const outcome = await drive(
      {
        cwd,
        runId: 'run-1',
        ports: fakePorts(),
        onStepStart: (_kind, _runStatus, progress) => {
          if (progress.step.kind !== 'slice_start' || claimedSnapshotPromise) return;
          claimedSnapshotPromise = readPetriMarkingSnapshot({ cwd, runId: 'run-1' });
        },
      },
      petriScheduler,
      frontierFiringPolicy,
    );

    expect(outcome).toEqual({ status: 'completed', runStatus: 'promotion_prepared' });
    await expect(claimedSnapshotPromise).resolves.toEqual({
      claimedTransitionIds: ['slice_start:task-1'],
      currentMarking: { 'run:slice_frontier': 1 },
      firedTransitionCount: 5,
      lifecycleProvenance: {
        runStatus: 'reports_initialized',
      },
    });
  });

  it('resumes a matching persisted claim-set before recomputing a fresh frontier selection', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-claim-resume-'));
    await createRunAtCreated(cwd, ['task-1', 'task-2']);
    await createWorktree({ cwd, runId: 'run-1', gitWorktree: fakePorts().gitWorktree });
    await populateWorktree({ cwd, runId: 'run-1' });
    await selectSourcePolicy({ cwd, runId: 'run-1', policy: 'host_source_deferred' });
    await copyHostSource({ cwd, runId: 'run-1' });
    await initializeReports({ cwd, runId: 'run-1' });
    await writePetriMarkingSnapshot({
      cwd,
      runId: 'run-1',
      snapshot: {
        claimedTransitionIds: ['slice_start:task-2'],
        currentMarking: { 'run:slice_frontier': 1 },
        firedTransitionCount: 5,
        lifecycleProvenance: { runStatus: 'reports_initialized' },
      },
    });

    const startedSteps: ReadyStep[] = [];
    const outcome = await drive(
      {
        cwd,
        runId: 'run-1',
        ports: fakePorts(),
        onStepStart: (kind, _runStatus, progress) => {
          if (kind === 'slice_start') startedSteps.push(progress.step);
        },
      },
      petriScheduler,
      frontierFiringPolicy,
      { maxFirings: 1 },
    );

    expect(outcome).toEqual({ status: 'completed', runStatus: 'slice_started' });
    expect(startedSteps).toMatchObject([{ kind: 'slice_start', sliceId: 'task-2', epicId: 'frontier-1' }]);
    expect(await readRunMetadata(runMetadataPath(cwd, 'run-1'))).toMatchObject({
      status: 'slice_started',
      activeSliceId: 'task-2',
      activeEpicId: 'frontier-1',
    });
  });

  it.each([
    {
      label: 'marking',
      currentMarking: { 'run:created': 1 },
      firedTransitionCount: 5,
    },
    {
      label: 'firing count',
      currentMarking: { 'run:slice_frontier': 1 },
      firedTransitionCount: 99,
    },
  ])(
    'ignores a persisted claim-set with a stale $label',
    async ({ currentMarking, firedTransitionCount }) => {
      const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-claim-stale-runtime-'));
      await createRunAtCreated(cwd, ['task-1', 'task-2']);
      await createWorktree({ cwd, runId: 'run-1', gitWorktree: fakePorts().gitWorktree });
      await populateWorktree({ cwd, runId: 'run-1' });
      await selectSourcePolicy({ cwd, runId: 'run-1', policy: 'host_source_deferred' });
      await copyHostSource({ cwd, runId: 'run-1' });
      await initializeReports({ cwd, runId: 'run-1' });
      await writePetriMarkingSnapshot({
        cwd,
        runId: 'run-1',
        snapshot: {
          claimedTransitionIds: ['slice_start:task-2'],
          currentMarking,
          firedTransitionCount,
          lifecycleProvenance: { runStatus: 'reports_initialized' },
        },
      });

      await expect(
        drive({ cwd, runId: 'run-1', ports: fakePorts() }, petriScheduler, frontierFiringPolicy, {
          maxFirings: 1,
        }),
      ).resolves.toEqual({ status: 'completed', runStatus: 'slice_started' });
      await expect(readRunMetadata(runMetadataPath(cwd, 'run-1'))).resolves.toMatchObject({
        activeSliceId: 'task-1',
      });
    },
  );

  it('ignores a resumed claim-set when it falls outside the current scheduler frontier', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-claim-resume-linear-'));
    await createRunAtCreated(cwd, ['task-1', 'task-2']);
    await createWorktree({ cwd, runId: 'run-1', gitWorktree: fakePorts().gitWorktree });
    await populateWorktree({ cwd, runId: 'run-1' });
    await selectSourcePolicy({ cwd, runId: 'run-1', policy: 'host_source_deferred' });
    await copyHostSource({ cwd, runId: 'run-1' });
    await initializeReports({ cwd, runId: 'run-1' });
    await writePetriMarkingSnapshot({
      cwd,
      runId: 'run-1',
      snapshot: {
        claimedTransitionIds: ['slice_start:task-2'],
        currentMarking: { 'run:slice_frontier': 1 },
        firedTransitionCount: 5,
        lifecycleProvenance: { runStatus: 'reports_initialized' },
      },
    });

    await expect(
      drive({ cwd, runId: 'run-1', ports: fakePorts() }, undefined, undefined, { maxFirings: 1 }),
    ).resolves.toEqual({
      status: 'completed',
      runStatus: 'slice_started',
    });
    await expect(readRunMetadata(runMetadataPath(cwd, 'run-1'))).resolves.toMatchObject({
      status: 'slice_started',
      activeSliceId: 'task-1',
      activeEpicId: 'frontier-1',
    });
  });

  it('stops after the first fired transition when maxFirings limits a parallel frontier batch', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-max-firings-frontier-'));
    await createRunAtCreated(cwd, ['task-1', 'task-2']);
    await createWorktree({ cwd, runId: 'run-1', gitWorktree: fakePorts().gitWorktree });
    await populateWorktree({ cwd, runId: 'run-1' });
    await selectSourcePolicy({ cwd, runId: 'run-1', policy: 'host_source_deferred' });
    await copyHostSource({ cwd, runId: 'run-1' });
    await initializeReports({ cwd, runId: 'run-1' });

    const outcome = await drive(
      { cwd, runId: 'run-1', ports: fakePorts() },
      petriScheduler,
      frontierFiringPolicy,
      { maxFirings: 1 },
    );

    expect(outcome).toEqual({ status: 'completed', runStatus: 'slice_started' });
    await expect(readRunMetadata(runMetadataPath(cwd, 'run-1'))).resolves.toMatchObject({
      status: 'slice_started',
      activeSliceId: 'task-1',
    });
  });

  it('fails closed when a persisted claim-set overclaims the current marking', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-claim-overclaim-'));
    await createRunAtCreated(cwd, ['task-1', 'task-2']);
    await createWorktree({ cwd, runId: 'run-1', gitWorktree: fakePorts().gitWorktree });
    await populateWorktree({ cwd, runId: 'run-1' });
    await selectSourcePolicy({ cwd, runId: 'run-1', policy: 'host_source_deferred' });
    await copyHostSource({ cwd, runId: 'run-1' });
    await initializeReports({ cwd, runId: 'run-1' });
    await writePetriMarkingSnapshot({
      cwd,
      runId: 'run-1',
      snapshot: {
        claimedTransitionIds: ['slice_start:task-1', 'slice_start:task-2'],
        currentMarking: { 'run:slice_frontier': 1 },
        firedTransitionCount: 5,
        lifecycleProvenance: { runStatus: 'reports_initialized' },
      },
    });

    let claimedSnapshotPromise: Promise<Awaited<ReturnType<typeof readPetriMarkingSnapshot>>> | undefined;
    const outcome = await drive(
      {
        cwd,
        runId: 'run-1',
        ports: fakePorts(),
        onStepStart: (_kind, _runStatus, progress) => {
          if (progress.step.kind !== 'slice_start' || claimedSnapshotPromise) return;
          claimedSnapshotPromise = readPetriMarkingSnapshot({ cwd, runId: 'run-1' });
        },
      },
      petriScheduler,
      frontierFiringPolicy,
      { maxFirings: 1 },
    );

    expect(outcome).toEqual({ status: 'completed', runStatus: 'slice_started' });
    await expect(claimedSnapshotPromise).resolves.toMatchObject({
      claimedTransitionIds: ['slice_start:task-1'],
    });
    await expect(claimedSnapshotPromise).resolves.not.toMatchObject({
      claimedTransitionIds: ['slice_start:task-1', 'slice_start:task-2'],
    });
  });

  it('keeps the durable fired-transition count exact after one missed snapshot write in a completed run', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-marking-recover-completed-'));
    await createRunAtCreated(cwd, ['task-1']);
    const blockingPath = petriMarkingPath(cwd, 'run-1');
    let netEventCount = 0;

    const outcome = await drive(
      {
        cwd,
        runId: 'run-1',
        ports: fakePorts(),
        onNetEvent: () => {
          netEventCount += 1;
          if (netEventCount === 1) {
            mkdirSync(join(cwd, '.brunch', 'cook', 'runs', 'run-1', 'petrinaut'), { recursive: true });
            mkdirSync(blockingPath, { recursive: true });
            return;
          }
          if (netEventCount === 2) {
            rmSync(blockingPath, { recursive: true, force: true });
          }
        },
      },
      petriScheduler,
    );

    expect(outcome).toEqual({ status: 'completed', runStatus: 'promotion_prepared' });
    await expect(readPetriMarkingSnapshot({ cwd, runId: 'run-1' })).resolves.toEqual({
      currentMarking: { 'run:promotion_prepared': 1 },
      firedTransitionCount: 13,
      lifecycleProvenance: {
        activeSliceId: 'task-1',
        runStatus: 'promotion_prepared',
        completedSliceIds: ['task-1'],
      },
      terminalEventKind: 'net_completed',
    });
  });

  it('keeps the durable fired-transition count exact after one missed snapshot write in a halted run', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-marking-recover-halted-'));
    await createRunAtCreated(cwd, ['task-1']);
    const blockingPath = petriMarkingPath(cwd, 'run-1');
    let netEventCount = 0;

    const outcome = await drive(
      {
        cwd,
        runId: 'run-1',
        ports: fakePorts({
          testRunner: createFakeTestRunnerPort({ status: 'failed', message: 'runner exploded' }),
        }),
        onNetEvent: () => {
          netEventCount += 1;
          if (netEventCount === 1) {
            mkdirSync(join(cwd, '.brunch', 'cook', 'runs', 'run-1', 'petrinaut'), { recursive: true });
            mkdirSync(blockingPath, { recursive: true });
            return;
          }
          if (netEventCount === 2) {
            rmSync(blockingPath, { recursive: true, force: true });
          }
        },
      },
      petriScheduler,
    );

    expect(outcome).toEqual({
      status: 'halted',
      step: 'test_result',
      runStatus: 'agent_result_ingested',
      reason: 'test_run_failed',
    });
    await expect(readPetriMarkingSnapshot({ cwd, runId: 'run-1' })).resolves.toEqual({
      currentMarking: { 'slice:task-1:agent_result_ingested': 1 },
      firedTransitionCount: 8,
      lifecycleProvenance: {
        activeSliceId: 'task-1',
        runStatus: 'agent_result_ingested',
      },
      haltedReason: 'test_run_failed',
      terminalEventKind: 'net_halted',
    });
  });

  it('emits a halt event instead of a false completion event when a Petri step cannot advance', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-events-halt-'));
    await createRunAtCreated(cwd, ['task-1']);
    const seen: ExecutorNetEvent[] = [];

    const outcome = await drive(
      {
        cwd,
        runId: 'run-1',
        ports: fakePorts({
          testRunner: createFakeTestRunnerPort({ status: 'failed', message: 'runner exploded' }),
        }),
        onNetEvent: (event) => {
          seen.push(event);
        },
      },
      petriScheduler,
    );

    expect(outcome).toEqual({
      status: 'halted',
      step: 'test_result',
      runStatus: 'agent_result_ingested',
      reason: 'test_run_failed',
    });
    expect(seen.some((event) => event.kind === 'net_completed')).toBe(false);
    expect(seen.at(-1)).toEqual({
      kind: 'net_halted',
      runId: 'run-1',
      runStatus: 'agent_result_ingested',
      step: 'test_result',
      reason: 'test_run_failed',
    });
    expect(await readPetriEvents(cwd)).toEqual(seen);
  });

  it('halts instead of reporting a false completion when the frontier plan is unreadable mid-run', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-unreadable-frontier-plan-'));
    const planPath = join(cwd, 'broken-plan.json');
    const seen: ExecutorNetEvent[] = [];

    await writeFile(planPath, '{"mode":', 'utf8');
    await mkdir(join(cwd, '.brunch', 'cook', 'runs', 'run-1'), { recursive: true });
    await writeFile(
      runMetadataPath(cwd, 'run-1'),
      JSON.stringify({
        runId: 'run-1',
        specId: '42',
        planPath,
        status: 'reports_initialized',
        reportsPath: reportsPath(cwd, 'run-1'),
      }),
      'utf8',
    );

    const outcome = await drive(
      {
        cwd,
        runId: 'run-1',
        ports: fakePorts(),
        onNetEvent: (event) => {
          seen.push(event);
        },
      },
      petriScheduler,
    );

    expect(outcome).toEqual({
      status: 'halted',
      step: 'slice_start',
      runStatus: 'reports_initialized',
      reason: 'scheduler_plan_unreadable',
    });
    expect(seen).toEqual([
      {
        kind: 'net_halted',
        runId: 'run-1',
        runStatus: 'reports_initialized',
        step: 'slice_start',
        reason: 'scheduler_plan_unreadable',
      },
    ]);
  });

  it('halts when duplicate slice ids make the Petri runtime unreadable during drive', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-drive-duplicate-slices-'));
    const planPath = join(cwd, 'duplicate-slices.json');
    const seen: ExecutorNetEvent[] = [];

    await writeFile(
      planPath,
      JSON.stringify({
        mode: 'greenfield',
        slices: [{ id: 'task-1' }, { id: 'task-1' }],
      }),
      'utf8',
    );
    await mkdir(join(cwd, '.brunch', 'cook', 'runs', 'run-1'), { recursive: true });
    await writeFile(
      runMetadataPath(cwd, 'run-1'),
      JSON.stringify({
        runId: 'run-1',
        specId: '42',
        planPath,
        status: 'reports_initialized',
        reportsPath: reportsPath(cwd, 'run-1'),
      }),
      'utf8',
    );

    const outcome = await drive(
      {
        cwd,
        runId: 'run-1',
        ports: fakePorts(),
        onNetEvent: (event) => {
          seen.push(event);
        },
      },
      linearScheduler,
    );

    expect(outcome).toEqual({
      status: 'halted',
      step: 'slice_start',
      runStatus: 'reports_initialized',
      reason: 'petri_input_unreadable',
    });
    expect(seen).toEqual([
      {
        kind: 'net_halted',
        runId: 'run-1',
        runStatus: 'reports_initialized',
        step: 'slice_start',
        reason: 'petri_input_unreadable',
      },
    ]);
  });

  it('fails closed on duplicate slice ids before the first lifecycle side effect', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-drive-created-duplicate-slices-'));
    await createRunAtCreated(cwd, ['task-1', 'task-1']);

    await expect(drive({ cwd, runId: 'run-1', ports: fakePorts() })).resolves.toEqual({
      status: 'halted',
      step: 'worktree_create',
      runStatus: 'created',
      reason: 'petri_input_unreadable',
    });
    await expect(readRunMetadata(runMetadataPath(cwd, 'run-1'))).resolves.toMatchObject({
      status: 'created',
    });
  });

  it('fails closed when lifecycle history names a slice outside the runtime plan', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-drive-foreign-active-slice-'));
    const planPath = join(cwd, 'plan.json');
    await writeFile(planPath, planJson(['task-1']), 'utf8');
    await mkdir(join(cwd, '.brunch', 'cook', 'runs', 'run-1'), { recursive: true });
    await writeFile(
      runMetadataPath(cwd, 'run-1'),
      JSON.stringify({
        runId: 'run-1',
        specId: '42',
        planPath,
        status: 'slice_started',
        activeSliceId: 'foreign-slice',
        reportsPath: reportsPath(cwd, 'run-1'),
      }),
      'utf8',
    );

    await expect(drive({ cwd, runId: 'run-1', ports: fakePorts() })).resolves.toEqual({
      status: 'halted',
      step: 'slice_execute',
      runStatus: 'slice_started',
      reason: 'petri_input_unreadable',
    });
  });

  it('does not fall back to the source plan when an explicit populated plan is unreadable', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-drive-corrupt-populated-plan-'));
    const planPath = join(cwd, 'plan.json');
    const populatedPlanPath = join(cwd, 'worktree-plan.json');
    await writeFile(planPath, planJson(['task-1']), 'utf8');
    await writeFile(populatedPlanPath, '{"mode":', 'utf8');
    await mkdir(join(cwd, '.brunch', 'cook', 'runs', 'run-1'), { recursive: true });
    await writeFile(
      runMetadataPath(cwd, 'run-1'),
      JSON.stringify({
        runId: 'run-1',
        specId: '42',
        planPath,
        populatedPlanPath,
        status: 'reports_initialized',
        reportsPath: reportsPath(cwd, 'run-1'),
      }),
      'utf8',
    );

    await expect(drive({ cwd, runId: 'run-1', ports: fakePorts() })).resolves.toEqual({
      status: 'halted',
      step: 'slice_start',
      runStatus: 'reports_initialized',
      reason: 'scheduler_plan_unreadable',
    });
  });

  it('rejects cyclic slice dependencies as unreadable Petri topology', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-drive-cyclic-plan-'));
    const planPath = join(cwd, 'cyclic-plan.json');
    await writeFile(
      planPath,
      planJson([
        { id: 'task-1', dependsOn: ['task-2'] },
        { id: 'task-2', dependsOn: ['task-1'] },
      ]),
      'utf8',
    );
    await mkdir(join(cwd, '.brunch', 'cook', 'runs', 'run-1'), { recursive: true });
    await writeFile(
      runMetadataPath(cwd, 'run-1'),
      JSON.stringify({
        runId: 'run-1',
        specId: '42',
        planPath,
        status: 'reports_initialized',
        reportsPath: reportsPath(cwd, 'run-1'),
      }),
      'utf8',
    );

    await expect(drive({ cwd, runId: 'run-1', ports: fakePorts() })).resolves.toEqual({
      status: 'halted',
      step: 'slice_start',
      runStatus: 'reports_initialized',
      reason: 'petri_input_unreadable',
    });
  });

  it('halts at petri_export when the compiled plan input is unreadable', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-export-unreadable-'));
    const planPath = join(cwd, 'broken-plan.json');
    const seen: ExecutorNetEvent[] = [];

    await writeFile(planPath, '{"mode":', 'utf8');
    await mkdir(join(cwd, '.brunch', 'cook', 'runs', 'run-1'), { recursive: true });
    await writeFile(
      runMetadataPath(cwd, 'run-1'),
      JSON.stringify({
        runId: 'run-1',
        specId: '42',
        planPath,
        status: 'run_completed',
        reportsPath: reportsPath(cwd, 'run-1'),
        completedSliceIds: ['task-1'],
      }),
      'utf8',
    );

    const outcome = await drive(
      {
        cwd,
        runId: 'run-1',
        ports: fakePorts(),
        onNetEvent: (event) => {
          seen.push(event);
        },
      },
      petriScheduler,
    );

    expect(outcome).toEqual({
      status: 'halted',
      step: 'petri_export',
      runStatus: 'run_completed',
      reason: 'petri_input_unreadable',
    });
    expect(await pathExists(petriNetPath(cwd, 'run-1'))).toBe(false);
    expect(seen.some((event) => event.kind === 'net_completed')).toBe(false);
    expect(seen.at(-1)).toEqual({
      kind: 'net_halted',
      runId: 'run-1',
      runStatus: 'run_completed',
      step: 'petri_export',
      reason: 'petri_input_unreadable',
    });
  });

  it('halts at petri_export when the compiled plan input parses but is structurally invalid', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-export-invalid-shape-'));
    const planPath = join(cwd, 'broken-plan.json');
    const seen: ExecutorNetEvent[] = [];

    await writeFile(
      planPath,
      JSON.stringify({
        mode: 'greenfield',
        slices: [{ epic_id: 'frontier-1' }],
      }),
      'utf8',
    );
    await mkdir(join(cwd, '.brunch', 'cook', 'runs', 'run-1'), { recursive: true });
    await writeFile(
      runMetadataPath(cwd, 'run-1'),
      JSON.stringify({
        runId: 'run-1',
        specId: '42',
        planPath,
        status: 'run_completed',
        reportsPath: reportsPath(cwd, 'run-1'),
        completedSliceIds: ['task-1'],
      }),
      'utf8',
    );

    const outcome = await drive(
      {
        cwd,
        runId: 'run-1',
        ports: fakePorts(),
        onNetEvent: (event) => {
          seen.push(event);
        },
      },
      petriScheduler,
    );

    expect(outcome).toEqual({
      status: 'halted',
      step: 'petri_export',
      runStatus: 'run_completed',
      reason: 'petri_input_unreadable',
    });
    expect(await pathExists(petriNetPath(cwd, 'run-1'))).toBe(false);
    expect(seen.some((event) => event.kind === 'net_completed')).toBe(false);
    expect(seen.at(-1)).toEqual({
      kind: 'net_halted',
      runId: 'run-1',
      runStatus: 'run_completed',
      step: 'petri_export',
      reason: 'petri_input_unreadable',
    });
  });

  it('treats an abandoned run as a halted terminal at both the driver and journal boundary', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-abandoned-terminal-'));
    const seen: ExecutorNetEvent[] = [];

    await mkdir(join(cwd, '.brunch', 'cook', 'runs', 'run-1'), { recursive: true });
    await writeFile(
      runMetadataPath(cwd, 'run-1'),
      JSON.stringify({
        runId: 'run-1',
        specId: '42',
        planPath: '/plan.yaml',
        status: 'abandoned',
        abandonedAt: '2026-07-09T00:00:00.000Z',
      }),
      'utf8',
    );

    const outcome = await drive(
      {
        cwd,
        runId: 'run-1',
        ports: fakePorts(),
        onNetEvent: (event) => {
          seen.push(event);
        },
      },
      petriScheduler,
    );

    expect(outcome).toEqual({
      status: 'halted',
      step: 'abandoned',
      runStatus: 'abandoned',
      reason: 'abandoned',
    });
    expect(seen).toEqual([
      {
        kind: 'net_halted',
        runId: 'run-1',
        runStatus: 'abandoned',
        reason: 'abandoned',
      },
    ]);
  });

  it('returns the abandoned halt even when the abandoned run plan has invalid topology', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-abandoned-invalid-topology-'));
    const planPath = join(cwd, 'duplicate-slices.json');
    await writeFile(planPath, planJson(['task-1', 'task-1']), 'utf8');
    await mkdir(join(cwd, '.brunch', 'cook', 'runs', 'run-1'), { recursive: true });
    await writeFile(
      runMetadataPath(cwd, 'run-1'),
      JSON.stringify({ runId: 'run-1', specId: '42', planPath, status: 'abandoned' }),
      'utf8',
    );

    await expect(drive({ cwd, runId: 'run-1', ports: fakePorts() })).resolves.toEqual({
      status: 'halted',
      step: 'abandoned',
      runStatus: 'abandoned',
      reason: 'abandoned',
    });
  });

  it('does not append duplicate terminal journal events when a completed run is driven again', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-terminal-dedup-'));
    await createRunAtCreated(cwd, ['task-1']);

    await drive({ cwd, runId: 'run-1', ports: fakePorts() }, petriScheduler);
    const firstPass = await readPetriEvents(cwd);

    const secondOutcome = await drive({ cwd, runId: 'run-1', ports: fakePorts() }, petriScheduler);
    const secondPass = await readPetriEvents(cwd);

    expect(secondOutcome).toEqual({ status: 'completed', runStatus: 'promotion_prepared' });
    expect(secondPass).toEqual(firstPass);
    expect(secondPass.filter((event) => event.kind === 'net_completed')).toHaveLength(1);
  });
});
