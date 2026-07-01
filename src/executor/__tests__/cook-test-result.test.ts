import { access, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { agentResultPath } from '../cook-agent-result.js';
import { reportsPath } from '../cook-report.js';
import { cookRunDir, cookRunMetadataPath } from '../cook-run.js';
import { ingestCookTestResult, testResultPath } from '../cook-test-result.js';

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function createAgentResultRun(cwd: string): Promise<void> {
  const runDir = cookRunDir(cwd, 'run-1');
  const reportPath = reportsPath(cwd, 'run-1');
  const metadataPath = cookRunMetadataPath(cwd, 'run-1');
  const resultPath = agentResultPath(cwd, 'run-1', 'task-1');
  await mkdir(join(runDir, 'agent-output', 'task-1'), { recursive: true });
  await writeFile(resultPath, JSON.stringify({ status: 'completed', summary: 'Implemented task.' }), 'utf8');
  await writeFile(reportPath, '{"event":"run_ready"}\n', 'utf8');
  await writeFile(
    metadataPath,
    JSON.stringify({
      runId: 'run-1',
      specId: '42',
      planPath: '/tmp/plan.yaml',
      status: 'agent_result_ingested',
      reportsPath: reportPath,
      activeSliceId: 'task-1',
      activeEpicId: 'frontier-1',
      agentResultPath: resultPath,
    }),
    'utf8',
  );
}

describe('ingestCookTestResult', () => {
  it('does not ingest when run metadata is missing', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-test-result-missing-run-'));
    const result = await ingestCookTestResult({ cwd, runId: 'run-1' });

    expect(result).toEqual({
      status: 'missing_run',
      runStatus: 'not_started',
      runId: 'run-1',
      metadataPath: cookRunMetadataPath(cwd, 'run-1'),
      sideEffects: [],
    });
  });

  it('does not ingest before agent result has been ingested', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-test-result-not-ready-'));
    await mkdir(cookRunDir(cwd, 'run-1'), { recursive: true });
    await writeFile(
      cookRunMetadataPath(cwd, 'run-1'),
      JSON.stringify({
        runId: 'run-1',
        specId: '42',
        planPath: '/tmp/plan.yaml',
        status: 'slice_execution_requested',
      }),
      'utf8',
    );

    const result = await ingestCookTestResult({ cwd, runId: 'run-1' });

    expect(result).toEqual({
      status: 'agent_result_not_ingested',
      runStatus: 'slice_execution_requested',
      runId: 'run-1',
      metadataPath: cookRunMetadataPath(cwd, 'run-1'),
      sideEffects: [],
    });
  });

  it('does not ingest until a test result file exists', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-test-result-missing-result-'));
    await createAgentResultRun(cwd);

    const result = await ingestCookTestResult({ cwd, runId: 'run-1' });

    expect(result).toEqual({
      status: 'missing_test_result',
      runStatus: 'agent_result_ingested',
      runId: 'run-1',
      sliceId: 'task-1',
      resultPath: testResultPath(cwd, 'run-1', 'task-1'),
      metadataPath: cookRunMetadataPath(cwd, 'run-1'),
      sideEffects: [],
    });
  });

  it('ingests a prewritten test result without running tests or Petri', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-test-result-ready-'));
    await createAgentResultRun(cwd);
    const resultPath = testResultPath(cwd, 'run-1', 'task-1');
    await writeFile(resultPath, JSON.stringify({ status: 'passed', target: 'tests/task-1.test.ts' }), 'utf8');

    const result = await ingestCookTestResult({ cwd, runId: 'run-1' });

    expect(result).toEqual({
      status: 'test_result_ingested',
      runStatus: 'test_result_ingested',
      runId: 'run-1',
      sliceId: 'task-1',
      epicId: 'frontier-1',
      resultPath,
      metadataPath: cookRunMetadataPath(cwd, 'run-1'),
      reportsPath: reportsPath(cwd, 'run-1'),
      sideEffects: [
        { kind: 'append_file', path: reportsPath(cwd, 'run-1') },
        { kind: 'write_file', path: cookRunMetadataPath(cwd, 'run-1'), ifExists: 'overwrite' },
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
      target: 'tests/task-1.test.ts',
    });
    expect(JSON.parse(await readFile(cookRunMetadataPath(cwd, 'run-1'), 'utf8'))).toMatchObject({
      status: 'test_result_ingested',
      testResultPath: resultPath,
    });
    expect(await pathExists(join(cookRunDir(cwd, 'run-1'), 'petrinaut'))).toBe(false);
    expect(await pathExists(join(cookRunDir(cwd, 'run-1'), 'promotion'))).toBe(false);
  });
});
