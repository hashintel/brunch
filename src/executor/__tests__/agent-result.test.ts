import { access, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ingestAgentResult } from '../agent-result.js';
import { reportsPath } from '../report.js';
import { runDirPath, runMetadataPath } from '../run.js';
import { sliceExecutionRequestPath } from '../slice-execute.js';

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function createRequestedSliceRun(cwd: string): Promise<void> {
  const runDir = runDirPath(cwd, 'run-1');
  const metadataPath = runMetadataPath(cwd, 'run-1');
  const reportPath = reportsPath(cwd, 'run-1');
  const requestPath = sliceExecutionRequestPath(cwd, 'run-1', 'task-1');
  await mkdir(dirname(requestPath), { recursive: true });
  await writeFile(requestPath, JSON.stringify({ status: 'requested' }), 'utf8');
  await writeFile(reportPath, '{"event":"run_ready"}\n', 'utf8');
  await writeFile(
    metadataPath,
    JSON.stringify({
      runId: 'run-1',
      specId: '42',
      planPath: '/tmp/plan.yaml',
      status: 'slice_execution_requested',
      reportsPath: reportPath,
      activeSliceId: 'task-1',
      activeEpicId: 'frontier-1',
      sliceExecutionRequestPath: requestPath,
    }),
    'utf8',
  );
  await mkdir(join(runDir, 'worktree'), { recursive: true });
}

describe('ingestAgentResult', () => {
  it('does not ingest when run metadata is missing', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-agent-result-missing-run-'));
    const result = await ingestAgentResult({ cwd, runId: 'run-1' });

    expect(result).toEqual({
      status: 'missing_run',
      runStatus: 'not_started',
      runId: 'run-1',
      metadataPath: runMetadataPath(cwd, 'run-1'),
      sideEffects: [],
    });
  });

  it('does not ingest before execution has been requested', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-agent-result-not-requested-'));
    await mkdir(runDirPath(cwd, 'run-1'), { recursive: true });
    await writeFile(
      runMetadataPath(cwd, 'run-1'),
      JSON.stringify({ runId: 'run-1', specId: '42', planPath: '/tmp/plan.yaml', status: 'slice_started' }),
      'utf8',
    );

    const result = await ingestAgentResult({ cwd, runId: 'run-1' });

    expect(result).toEqual({
      status: 'slice_not_requested',
      runStatus: 'slice_started',
      runId: 'run-1',
      metadataPath: runMetadataPath(cwd, 'run-1'),
      sideEffects: [],
    });
  });

  it('does not ingest until an agent result file exists', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-agent-result-missing-result-'));
    await createRequestedSliceRun(cwd);

    const result = await ingestAgentResult({ cwd, runId: 'run-1' });

    expect(result).toEqual({
      status: 'missing_agent_result',
      runStatus: 'slice_execution_requested',
      runId: 'run-1',
      sliceId: 'task-1',
      resultPath: join(runDirPath(cwd, 'run-1'), 'agent-output', 'task-1', 'result.json'),
      metadataPath: runMetadataPath(cwd, 'run-1'),
      sideEffects: [],
    });
  });

  it('ingests a prewritten agent result without running tests or Petri', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-agent-result-ready-'));
    await createRequestedSliceRun(cwd);
    const resultPath = join(runDirPath(cwd, 'run-1'), 'agent-output', 'task-1', 'result.json');
    await writeFile(
      resultPath,
      JSON.stringify({ status: 'completed', summary: 'Implemented task.' }),
      'utf8',
    );

    const result = await ingestAgentResult({ cwd, runId: 'run-1' });

    expect(result).toEqual({
      status: 'agent_result_ingested',
      runStatus: 'agent_result_ingested',
      runId: 'run-1',
      sliceId: 'task-1',
      epicId: 'frontier-1',
      resultPath,
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
      event: 'slice_agent_result',
      runId: 'run-1',
      epicId: 'frontier-1',
      sliceId: 'task-1',
      status: 'completed',
      summary: 'Implemented task.',
    });
    expect(JSON.parse(await readFile(runMetadataPath(cwd, 'run-1'), 'utf8'))).toMatchObject({
      status: 'agent_result_ingested',
      activeSliceId: 'task-1',
      agentResultPath: resultPath,
    });
    expect(await pathExists(join(runDirPath(cwd, 'run-1'), 'petrinaut'))).toBe(false);
    expect(await pathExists(join(runDirPath(cwd, 'run-1'), 'tests-ran.json'))).toBe(false);
  });
});
