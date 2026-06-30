import { access, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { cookPlanFilePath } from '../cook-plan-file.js';
import { populateCookWorktree } from '../cook-populate.js';
import { initializeCookReports, reportsPath } from '../cook-report.js';
import { cookRunDir, cookRunMetadataPath, createCookRun } from '../cook-run.js';
import { requestCookSliceExecution, sliceExecutionRequestPath } from '../cook-slice-execute.js';
import { startCookSlice } from '../cook-slice-start.js';
import { copyCookHostSource } from '../cook-source-copy.js';
import { selectCookSourcePolicy } from '../cook-source-policy.js';
import { createCookWorktree } from '../cook-worktree.js';

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function createSliceStartedRun(cwd: string): Promise<void> {
  const planPath = cookPlanFilePath(cwd, '42');
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
  await createCookRun({ cwd, specId: '42', runId: 'run-1' });
  await createCookWorktree({ cwd, runId: 'run-1' });
  await populateCookWorktree({ cwd, runId: 'run-1' });
  await selectCookSourcePolicy({ cwd, runId: 'run-1', policy: 'host_source_deferred' });
  await copyCookHostSource({ cwd, runId: 'run-1' });
  await initializeCookReports({ cwd, runId: 'run-1' });
  await startCookSlice({ cwd, runId: 'run-1' });
}

describe('requestCookSliceExecution', () => {
  it('does not request execution before a slice is active', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-slice-execute-missing-run-'));
    const result = await requestCookSliceExecution({ cwd, runId: 'run-1' });

    expect(result).toEqual({
      status: 'missing_run',
      runStatus: 'not_started',
      runId: 'run-1',
      metadataPath: cookRunMetadataPath(cwd, 'run-1'),
      sideEffects: [],
    });
  });

  it('writes an execution request and report for the active slice without invoking an agent', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-slice-execute-ready-'));
    await createSliceStartedRun(cwd);

    const result = await requestCookSliceExecution({ cwd, runId: 'run-1' });

    expect(result).toEqual({
      status: 'slice_execution_requested',
      runStatus: 'slice_execution_requested',
      runId: 'run-1',
      sliceId: 'task-1',
      epicId: 'frontier-1',
      metadataPath: cookRunMetadataPath(cwd, 'run-1'),
      reportsPath: reportsPath(cwd, 'run-1'),
      requestPath: sliceExecutionRequestPath(cwd, 'run-1', 'task-1'),
      sideEffects: [
        { kind: 'mkdir', path: join(cookRunDir(cwd, 'run-1'), 'agent-output', 'task-1') },
        {
          kind: 'write_file',
          path: sliceExecutionRequestPath(cwd, 'run-1', 'task-1'),
          ifExists: 'overwrite',
        },
        { kind: 'append_file', path: reportsPath(cwd, 'run-1') },
        { kind: 'write_file', path: cookRunMetadataPath(cwd, 'run-1'), ifExists: 'overwrite' },
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
    expect(await pathExists(join(cookRunDir(cwd, 'run-1'), 'agent-output', 'task-1', 'result.json'))).toBe(
      false,
    );
    expect(await pathExists(join(cookRunDir(cwd, 'run-1'), 'petrinaut'))).toBe(false);
  });
});
