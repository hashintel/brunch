import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dirname } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { agentResultPath } from '../agent-result.js';
import type { TestRunArgs } from '../execution-ports.js';
import { petriEventsPath } from '../petri-events.js';
import { reportsPath } from '../report.js';
import { runDirPath, runMetadataPath } from '../run.js';
import { ingestTestResult, verifyStreamPath } from '../test-result.js';
import { worktreeDirPath } from '../worktree.js';
import { createFakeTestRunnerPort } from './fake-ports.js';

async function createAgentResultRun(
  cwd: string,
  options: { readonly verifyTarget?: { readonly command: string; readonly args: readonly string[] } } = {},
): Promise<void> {
  const reportPath = reportsPath(cwd, 'run-1');
  const metadataPath = runMetadataPath(cwd, 'run-1');
  const resultPath = agentResultPath(cwd, 'run-1', 'task-1');
  await mkdir(dirname(resultPath), { recursive: true });
  await writeFile(resultPath, JSON.stringify({ status: 'completed', summary: 'Implemented task.' }), 'utf8');
  await writeFile(reportPath, '{"event":"run_ready"}\n', 'utf8');
  await writeFile(
    metadataPath,
    JSON.stringify({
      runId: 'run-1',
      specId: '42',
      planPath: '/tmp/plan.json',
      status: 'agent_result_ingested',
      worktreeDir: worktreeDirPath(cwd, 'run-1'),
      reportsPath: reportPath,
      activeSliceId: 'task-1',
      activeEpicId: 'frontier-1',
      agentResultPath: resultPath,
      verifyTarget: options.verifyTarget ?? { command: 'npm', args: ['run', 'verify'] },
      sliceRepairHistory: {
        'task-1': [
          {
            cycle: 1,
            epochs: [
              {
                stage: 'agent',
                outcome: 'succeeded',
                attempts: 1,
                artifactOrdinalStart: 1,
                artifactOrdinalEnd: 1,
              },
            ],
          },
        ],
      },
    }),
    'utf8',
  );
}

describe('ingestTestResult', () => {
  it('does not ingest when run metadata is missing', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-test-result-missing-run-'));
    const result = await ingestTestResult({ cwd, runId: 'run-1', testRunner: createFakeTestRunnerPort() });

    expect(result).toEqual({
      status: 'missing_run',
      runStatus: 'not_started',
      runId: 'run-1',
      metadataPath: runMetadataPath(cwd, 'run-1'),
      sideEffects: [],
    });
  });

  it('does not ingest before agent result has been ingested', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-test-result-not-ready-'));
    await mkdir(runDirPath(cwd, 'run-1'), { recursive: true });
    await writeFile(
      runMetadataPath(cwd, 'run-1'),
      JSON.stringify({
        runId: 'run-1',
        specId: '42',
        planPath: '/tmp/plan.json',
        status: 'slice_execution_requested',
      }),
      'utf8',
    );

    const result = await ingestTestResult({ cwd, runId: 'run-1', testRunner: createFakeTestRunnerPort() });

    expect(result).toEqual({
      status: 'agent_result_not_ingested',
      runStatus: 'slice_execution_requested',
      runId: 'run-1',
      metadataPath: runMetadataPath(cwd, 'run-1'),
      sideEffects: [],
    });
  });

  it('does not invoke verification or mutate evidence after a durable terminal', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-test-result-terminal-'));
    await createAgentResultRun(cwd);
    const metadataPath = runMetadataPath(cwd, 'run-1');
    const reportPath = reportsPath(cwd, 'run-1');
    const journalPath = petriEventsPath(cwd, 'run-1');
    await mkdir(dirname(journalPath), { recursive: true });
    await writeFile(
      journalPath,
      `${JSON.stringify({
        kind: 'net_halted',
        runId: 'run-1',
        runStatus: 'agent_result_ingested',
        step: 'test_result',
        reason: 'verify_exhausted',
        failedSliceIds: ['task-1'],
        ts: new Date().toISOString(),
      })}\n`,
      'utf8',
    );
    const metadataBefore = await readFile(metadataPath, 'utf8');
    const reportsBefore = await readFile(reportPath, 'utf8');
    const run = vi.fn(async () => ({
      status: 'completed' as const,
      verdict: 'passed' as const,
      exitCode: 0,
    }));

    const result = await ingestTestResult({ cwd, runId: 'run-1', testRunner: { run } });

    expect(result).toMatchObject({
      status: 'petri_terminal_recorded',
      runStatus: 'agent_result_ingested',
      runId: 'run-1',
      metadataPath,
      terminal: { kind: 'net_halted', reason: 'verify_exhausted' },
      sideEffects: [],
    });
    expect(run).not.toHaveBeenCalled();
    expect(await readFile(metadataPath, 'utf8')).toBe(metadataBefore);
    expect(await readFile(reportPath, 'utf8')).toBe(reportsBefore);
  });

  it('does not invoke verification while an attempt reset is pending orchestration', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-test-result-reset-pending-'));
    await createAgentResultRun(cwd);
    const metadataPath = runMetadataPath(cwd, 'run-1');
    const metadata = JSON.parse(await readFile(metadataPath, 'utf8')) as Record<string, unknown>;
    await writeFile(
      metadataPath,
      JSON.stringify({ ...metadata, activeSliceAttemptReset: { stage: 'verify' } }),
    );
    const metadataBefore = await readFile(metadataPath, 'utf8');
    const reportsBefore = await readFile(reportsPath(cwd, 'run-1'), 'utf8');
    const run = vi.fn(async () => ({
      status: 'completed' as const,
      verdict: 'passed' as const,
      exitCode: 0,
    }));

    const result = await ingestTestResult({ cwd, runId: 'run-1', testRunner: { run } });

    expect(result).toMatchObject({
      status: 'attempt_reset_pending',
      runStatus: 'agent_result_ingested',
      runId: 'run-1',
      metadataPath,
      stage: 'verify',
      sideEffects: [],
    });
    expect(run).not.toHaveBeenCalled();
    expect(await readFile(metadataPath, 'utf8')).toBe(metadataBefore);
    expect(await readFile(reportsPath(cwd, 'run-1'), 'utf8')).toBe(reportsBefore);
  });

  it('does not advance run metadata when the test runner cannot execute', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-test-result-run-failed-'));
    await createAgentResultRun(cwd);

    const result = await ingestTestResult({
      cwd,
      runId: 'run-1',
      testRunner: createFakeTestRunnerPort({ status: 'failed', message: 'verify command not found' }),
    });

    expect(result).toEqual({
      status: 'test_run_failed',
      runStatus: 'agent_result_ingested',
      runId: 'run-1',
      sliceId: 'task-1',
      worktreeDir: worktreeDirPath(cwd, 'run-1'),
      metadataPath: runMetadataPath(cwd, 'run-1'),
      message: 'verify command not found',
      attempts: 1,
      sideEffects: [{ kind: 'write_file', path: runMetadataPath(cwd, 'run-1'), ifExists: 'overwrite' }],
    });
    expect(JSON.parse(await readFile(runMetadataPath(cwd, 'run-1'), 'utf8'))).toMatchObject({
      status: 'agent_result_ingested',
      activeSliceAttempts: 1,
    });
  });

  it('runs the verify subprocess in the run worktree and ingests its true result', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-test-result-ready-'));
    await createAgentResultRun(cwd);

    const calls: TestRunArgs[] = [];
    const result = await ingestTestResult({
      cwd,
      runId: 'run-1',
      testRunner: {
        async run(args) {
          calls.push(args);
          return { status: 'completed', verdict: 'passed', exitCode: 0, target: 'npm run verify' };
        },
      },
    });

    expect(calls).toEqual([expect.objectContaining({ worktreeDir: worktreeDirPath(cwd, 'run-1') })]);
    expect(result).toEqual({
      status: 'test_result_ingested',
      runStatus: 'test_result_ingested',
      runId: 'run-1',
      sliceId: 'task-1',
      epicId: 'frontier-1',
      verdict: 'passed',
      worktreeDir: worktreeDirPath(cwd, 'run-1'),
      metadataPath: runMetadataPath(cwd, 'run-1'),
      reportsPath: reportsPath(cwd, 'run-1'),
      sideEffects: [
        { kind: 'append_file', path: reportsPath(cwd, 'run-1') },
        { kind: 'write_file', path: runMetadataPath(cwd, 'run-1'), ifExists: 'overwrite' },
      ],
    });
    const reports = (await readFile(reportsPath(cwd, 'run-1'), 'utf8'))
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    expect(reports.at(-1)).toEqual({
      event: 'slice_test_result',
      runId: 'run-1',
      epicId: 'frontier-1',
      sliceId: 'task-1',
      cycle: 1,
      artifactAttempt: 1,
      status: 'passed',
      exitCode: 0,
      target: 'npm run verify',
    });
    expect(JSON.parse(await readFile(runMetadataPath(cwd, 'run-1'), 'utf8'))).toMatchObject({
      status: 'test_result_ingested',
    });
  });

  it('passes the run verify target to the test runner port', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-test-result-verify-target-'));
    await createAgentResultRun(cwd, { verifyTarget: { command: 'npm', args: ['test'] } });

    const calls: TestRunArgs[] = [];
    const result = await ingestTestResult({
      cwd,
      runId: 'run-1',
      testRunner: {
        async run(args) {
          calls.push(args);
          return { status: 'completed', verdict: 'passed', exitCode: 0, target: 'npm test' };
        },
      },
    });

    expect(calls).toEqual([
      expect.objectContaining({
        worktreeDir: worktreeDirPath(cwd, 'run-1'),
        verifyTarget: { command: 'npm', args: ['test'] },
      }),
    ]);
    expect(result).toMatchObject({ status: 'test_result_ingested', verdict: 'passed' });
  });

  it('persists normalized verify stream updates before ingesting the final result', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-test-result-stream-'));
    await createAgentResultRun(cwd);
    const observed: unknown[] = [];

    const result = await ingestTestResult({
      cwd,
      runId: 'run-1',
      testRunner: {
        async run(args) {
          await args.onUpdate?.({ kind: 'status', message: 'npm run verify started' });
          await args.onUpdate?.({ kind: 'stdout', message: 'tests passed\n' });
          return { status: 'completed', verdict: 'passed', exitCode: 0, target: 'npm run verify' };
        },
      },
      onVerifyUpdate: (event) => observed.push(event),
    });

    const streamPath = verifyStreamPath(cwd, 'run-1', 'task-1');
    const stream = (await readFile(streamPath, 'utf8'))
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    expect(stream).toEqual([
      {
        event: 'verify_stream',
        runId: 'run-1',
        epicId: 'frontier-1',
        sliceId: 'task-1',
        sequence: 0,
        runSequence: 0,
        kind: 'status',
        message: 'npm run verify started',
      },
      {
        event: 'verify_stream',
        runId: 'run-1',
        epicId: 'frontier-1',
        sliceId: 'task-1',
        sequence: 1,
        runSequence: 1,
        kind: 'stdout',
        message: 'tests passed\n',
      },
    ]);
    expect(observed).toEqual(stream);
    expect(result.sideEffects).toContainEqual({ kind: 'append_file', path: streamPath });
    expect(result.status).toBe('test_result_ingested');
  });

  it('ingests a failing verdict and durably requests the next repair cycle', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-test-result-failing-'));
    await createAgentResultRun(cwd);

    const result = await ingestTestResult({
      cwd,
      runId: 'run-1',
      testRunner: createFakeTestRunnerPort({
        status: 'completed',
        verdict: 'failed',
        exitCode: 1,
        target: 'npm run verify',
      }),
    });

    expect(result).toMatchObject({ status: 'slice_repair_requested', verdict: 'failed' });
    const reports = (await readFile(reportsPath(cwd, 'run-1'), 'utf8'))
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    expect(reports.at(-1)).toMatchObject({ event: 'slice_test_result', status: 'failed', exitCode: 1 });
    expect(JSON.parse(await readFile(runMetadataPath(cwd, 'run-1'), 'utf8'))).toMatchObject({
      pendingSliceRepair: {
        phase: 'materialized',
        sliceId: 'task-1',
        sourceCycle: 1,
        cycle: 2,
        sourceVerifyArtifactOrdinal: 1,
      },
    });
  });

  it('materializes durable pending repair without replaying the verifier', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-test-result-pending-repair-'));
    await createAgentResultRun(cwd);
    let verifierCalls = 0;
    const testRunner = {
      async run() {
        verifierCalls += 1;
        return {
          status: 'completed' as const,
          verdict: 'failed' as const,
          exitCode: 1,
          target: 'npm run verify',
        };
      },
    };
    await ingestTestResult({ cwd, runId: 'run-1', testRunner });

    const metadataPath = runMetadataPath(cwd, 'run-1');
    const crashState = JSON.parse(await readFile(metadataPath, 'utf8'));
    await rm(crashState.pendingSliceRepair.contextPath);
    crashState.status = 'agent_result_ingested';
    crashState.pendingSliceRepair.phase = 'pending';
    await writeFile(metadataPath, JSON.stringify(crashState), 'utf8');
    const reportsBeforeRecovery = await readFile(reportsPath(cwd, 'run-1'), 'utf8');

    const result = await ingestTestResult({ cwd, runId: 'run-1', testRunner });

    expect(result).toMatchObject({
      status: 'slice_repair_requested',
      runStatus: 'slice_execution_requested',
      verdict: 'failed',
    });
    expect(verifierCalls).toBe(1);
    await expect(readFile(reportsPath(cwd, 'run-1'), 'utf8')).resolves.toBe(reportsBeforeRecovery);
    expect(JSON.parse(await readFile(metadataPath, 'utf8'))).toMatchObject({
      status: 'slice_execution_requested',
      pendingSliceRepair: { phase: 'materialized', sourceCycle: 1, cycle: 2 },
    });
  });
});
