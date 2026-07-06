import { access, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { planFilePath } from '../plan-file.js';
import { populateWorktree } from '../populate.js';
import { initializeReports, reportsPath } from '../report.js';
import { runDirPath, runMetadataPath, createRun } from '../run.js';
import { requestSliceExecution, sliceExecutionRequestPath } from '../slice-execute.js';
import { startSlice } from '../slice-start.js';
import { copyHostSource } from '../source-copy.js';
import { selectSourcePolicy } from '../source-policy.js';
import { createWorktree } from '../worktree.js';
import { createFakeGitWorktreePort } from './fake-ports.js';

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function createSliceStartedRun(cwd: string): Promise<void> {
  const planPath = planFilePath(cwd, '42');
  await mkdir(join(cwd, 'src'), { recursive: true });
  await writeFile(join(cwd, 'src', 'app.ts'), 'export const app = true;\n', 'utf8');
  await mkdir(join(cwd, '.brunch', 'cook', 'specs', '42'), { recursive: true });
  await writeFile(
    planPath,
    JSON.stringify({
      mode: 'greenfield',
      epics: [{ id: 'frontier-1', summary: 'Build feature', depends_on: [], verification: [] }],
      slices: [
        {
          id: 'task-1',
          epic_id: 'frontier-1',
          definition: 'Build the first task.',
          depends_on: [],
          verification: [],
          derived_from: ['REQ1'],
        },
      ],
    }),
    'utf8',
  );
  await createRun({ cwd, specId: '42', runId: 'run-1' });
  await createWorktree({ cwd, runId: 'run-1', gitWorktree: createFakeGitWorktreePort() });
  await populateWorktree({ cwd, runId: 'run-1' });
  await selectSourcePolicy({ cwd, runId: 'run-1', policy: 'host_source_deferred' });
  await copyHostSource({ cwd, runId: 'run-1' });
  await initializeReports({ cwd, runId: 'run-1' });
  await startSlice({ cwd, runId: 'run-1' });
}

describe('requestSliceExecution', () => {
  it('does not request execution before a slice is active', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-slice-execute-missing-run-'));
    const result = await requestSliceExecution({ cwd, runId: 'run-1' });

    expect(result).toEqual({
      status: 'missing_run',
      runStatus: 'not_started',
      runId: 'run-1',
      metadataPath: runMetadataPath(cwd, 'run-1'),
      sideEffects: [],
    });
  });

  it('writes an execution request and report for the active slice without invoking an agent', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-slice-execute-ready-'));
    await createSliceStartedRun(cwd);

    const result = await requestSliceExecution({ cwd, runId: 'run-1' });

    expect(result).toEqual({
      status: 'slice_execution_requested',
      runStatus: 'slice_execution_requested',
      runId: 'run-1',
      sliceId: 'task-1',
      epicId: 'frontier-1',
      metadataPath: runMetadataPath(cwd, 'run-1'),
      reportsPath: reportsPath(cwd, 'run-1'),
      requestPath: sliceExecutionRequestPath(cwd, 'run-1', 'task-1'),
      sideEffects: [
        { kind: 'mkdir', path: dirname(sliceExecutionRequestPath(cwd, 'run-1', 'task-1')) },
        {
          kind: 'write_file',
          path: sliceExecutionRequestPath(cwd, 'run-1', 'task-1'),
          ifExists: 'overwrite',
        },
        { kind: 'append_file', path: reportsPath(cwd, 'run-1') },
        { kind: 'write_file', path: runMetadataPath(cwd, 'run-1'), ifExists: 'overwrite' },
      ],
    });
    expect(JSON.parse(await readFile(sliceExecutionRequestPath(cwd, 'run-1', 'task-1'), 'utf8'))).toEqual({
      runId: 'run-1',
      sliceId: 'task-1',
      epicId: 'frontier-1',
      action: 'execute_slice',
      status: 'requested',
    });
    const reports = (await readFile(reportsPath(cwd, 'run-1'), 'utf8'))
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    expect(reports.at(-1)).toEqual({
      event: 'slice_execution_requested',
      runId: 'run-1',
      epicId: 'frontier-1',
      sliceId: 'task-1',
      status: 'slice_execution_requested',
    });
    expect(
      await pathExists(
        join(
          runDirPath(cwd, 'run-1'),
          'worktree',
          '.brunch',
          'cook',
          'agent-output',
          'task-1',
          'result.json',
        ),
      ),
    ).toBe(false);
    expect(await pathExists(join(runDirPath(cwd, 'run-1'), 'petrinaut'))).toBe(false);
  });

  it('rejects active slice ids that would escape the agent-output directory', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-slice-execute-unsafe-slice-'));
    const runDir = runDirPath(cwd, 'run-1');
    const reportPath = reportsPath(cwd, 'run-1');
    await mkdir(runDir, { recursive: true });
    await writeFile(reportPath, '{"event":"run_ready"}\n', 'utf8');
    await writeFile(
      runMetadataPath(cwd, 'run-1'),
      JSON.stringify({
        runId: 'run-1',
        specId: '42',
        planPath: '/tmp/plan.yaml',
        status: 'slice_started',
        reportsPath: reportPath,
        activeSliceId: '../../escape',
        activeEpicId: 'frontier-1',
      }),
      'utf8',
    );

    await expect(requestSliceExecution({ cwd, runId: 'run-1' })).rejects.toThrow('invalid sliceId');
    expect(await pathExists(join(runDir, '..', 'escape', 'request.json'))).toBe(false);
  });
});
