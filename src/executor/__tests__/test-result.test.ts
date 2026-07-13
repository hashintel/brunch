import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dirname } from 'node:path';

import { describe, expect, it } from 'vitest';

import { agentResultPath } from '../agent-result.js';
import type { TestRunArgs } from '../execution-ports.js';
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
      planPath: '/tmp/plan.yaml',
      status: 'agent_result_ingested',
      worktreeDir: worktreeDirPath(cwd, 'run-1'),
      reportsPath: reportPath,
      activeSliceId: 'task-1',
      activeEpicId: 'frontier-1',
      agentResultPath: resultPath,
      ...(options.verifyTarget ? { verifyTarget: options.verifyTarget } : {}),
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
        planPath: '/tmp/plan.yaml',
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

  it('ingests a failing verdict and still advances the run', async () => {
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

    expect(result).toMatchObject({ status: 'test_result_ingested', verdict: 'failed' });
    const reports = (await readFile(reportsPath(cwd, 'run-1'), 'utf8'))
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    expect(reports.at(-1)).toMatchObject({ event: 'slice_test_result', status: 'failed', exitCode: 1 });
  });
});
