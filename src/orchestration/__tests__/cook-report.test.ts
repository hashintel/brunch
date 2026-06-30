import { access, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { cookPlanFilePath } from '../cook-plan-file.js';
import { populateCookWorktree } from '../cook-populate.js';
import { initializeCookReports, reportsPath } from '../cook-report.js';
import { cookRunDir, cookRunMetadataPath, createCookRun } from '../cook-run.js';
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

async function createSourceCopiedRun(cwd: string): Promise<void> {
  const planPath = cookPlanFilePath(cwd, '42');
  await mkdir(join(cwd, 'src'), { recursive: true });
  await writeFile(join(cwd, 'src', 'app.ts'), 'export const app = true;\n', 'utf8');
  await mkdir(join(cwd, '.brunch', 'cook', 'specs', '42'), { recursive: true });
  await writeFile(planPath, '{"mode":"greenfield","epics":[],"slices":[]}', 'utf8');
  await createCookRun({ cwd, specId: '42', runId: 'run-1' });
  await createCookWorktree({ cwd, runId: 'run-1' });
  await populateCookWorktree({ cwd, runId: 'run-1' });
  await selectCookSourcePolicy({ cwd, runId: 'run-1', policy: 'host_source_deferred' });
  await copyCookHostSource({ cwd, runId: 'run-1' });
}

describe('initializeCookReports', () => {
  it('does not create reports when run metadata is missing', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-report-missing-run-'));
    const result = await initializeCookReports({ cwd, runId: 'run-1' });

    expect(result).toEqual({
      status: 'missing_run',
      runStatus: 'not_started',
      runId: 'run-1',
      metadataPath: cookRunMetadataPath(cwd, 'run-1'),
      sideEffects: [],
    });
  });

  it('does not create reports until host source has been copied', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-report-not-ready-'));
    const planPath = cookPlanFilePath(cwd, '42');
    await mkdir(join(cwd, '.brunch', 'cook', 'specs', '42'), { recursive: true });
    await writeFile(planPath, '{"mode":"greenfield","epics":[],"slices":[]}', 'utf8');
    await createCookRun({ cwd, specId: '42', runId: 'run-1' });

    const result = await initializeCookReports({ cwd, runId: 'run-1' });

    expect(result).toEqual({
      status: 'source_not_copied',
      runStatus: 'created',
      runId: 'run-1',
      metadataPath: cookRunMetadataPath(cwd, 'run-1'),
      sideEffects: [],
    });
    expect(await pathExists(reportsPath(cwd, 'run-1'))).toBe(false);
  });

  it('writes a report log initialization event only', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-report-ready-'));
    await createSourceCopiedRun(cwd);

    const result = await initializeCookReports({ cwd, runId: 'run-1' });

    expect(result).toEqual({
      status: 'reports_initialized',
      runStatus: 'reports_initialized',
      runId: 'run-1',
      metadataPath: cookRunMetadataPath(cwd, 'run-1'),
      reportsPath: reportsPath(cwd, 'run-1'),
      sideEffects: [
        { kind: 'write_file', path: reportsPath(cwd, 'run-1'), ifExists: 'overwrite' },
        { kind: 'write_file', path: cookRunMetadataPath(cwd, 'run-1'), ifExists: 'overwrite' },
      ],
    });
    const reports = (await readFile(reportsPath(cwd, 'run-1'), 'utf8'))
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    expect(reports).toEqual([
      {
        event: 'run_ready',
        runId: 'run-1',
        status: 'reports_initialized',
      },
    ]);
    expect(JSON.parse(await readFile(cookRunMetadataPath(cwd, 'run-1'), 'utf8'))).toMatchObject({
      status: 'reports_initialized',
      reportsPath: reportsPath(cwd, 'run-1'),
    });
    expect(await pathExists(join(cookRunDir(cwd, 'run-1'), 'petrinaut'))).toBe(false);
  });
});
