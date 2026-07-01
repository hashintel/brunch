import { access, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { cookPlanFilePath } from '../plan-file.js';
import { populateCookWorktree } from '../populate.js';
import { initializeCookReports, reportsPath } from '../report.js';
import { cookRunDir, cookRunMetadataPath, createCookRun } from '../run.js';
import { startCookSlice } from '../slice-start.js';
import { copyCookHostSource } from '../source-copy.js';
import { selectCookSourcePolicy } from '../source-policy.js';
import { createCookWorktree } from '../worktree.js';

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function createReportReadyRun(cwd: string): Promise<void> {
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
}

describe('startCookSlice', () => {
  it('does not start a slice when reports are not initialized', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-slice-start-missing-report-'));
    const result = await startCookSlice({ cwd, runId: 'run-1' });

    expect(result).toEqual({
      status: 'missing_run',
      runStatus: 'not_started',
      runId: 'run-1',
      metadataPath: cookRunMetadataPath(cwd, 'run-1'),
      sideEffects: [],
    });
  });

  it('appends one slice-start marker for the first plan slice without running agents', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-slice-start-ready-'));
    await createReportReadyRun(cwd);

    const result = await startCookSlice({ cwd, runId: 'run-1' });

    expect(result).toEqual({
      status: 'slice_started',
      runStatus: 'slice_started',
      runId: 'run-1',
      sliceId: 'task-1',
      epicId: 'frontier-1',
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
      event: 'slice_started',
      runId: 'run-1',
      epicId: 'frontier-1',
      sliceId: 'task-1',
      status: 'slice_started',
    });
    expect(JSON.parse(await readFile(cookRunMetadataPath(cwd, 'run-1'), 'utf8'))).toMatchObject({
      status: 'slice_started',
      activeSliceId: 'task-1',
      activeEpicId: 'frontier-1',
    });
    expect(await pathExists(join(cookRunDir(cwd, 'run-1'), 'petrinaut'))).toBe(false);
    expect(await pathExists(join(cookRunDir(cwd, 'run-1'), 'agent-output'))).toBe(false);
  });
});
