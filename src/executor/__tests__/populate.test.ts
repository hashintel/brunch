import { access, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { cookPlanFilePath } from '../plan-file.js';
import { populateCookWorktree, populatedPlanPath } from '../populate.js';
import { cookRunDir, cookRunMetadataPath, createCookRun } from '../run.js';
import { cookWorktreeDir, createCookWorktree } from '../worktree.js';

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

describe('populateCookWorktree', () => {
  it('does not populate when run metadata is missing', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-cook-populate-missing-run-'));
    const result = await populateCookWorktree({ cwd, runId: 'run-1' });

    expect(result).toEqual({
      status: 'missing_run',
      runStatus: 'not_started',
      runId: 'run-1',
      metadataPath: cookRunMetadataPath(cwd, 'run-1'),
      sideEffects: [],
    });
  });

  it('does not populate when the empty worktree has not been created', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-cook-populate-missing-worktree-'));
    const planPath = cookPlanFilePath(cwd, '42');
    await mkdir(dirname(planPath), { recursive: true });
    await writeFile(planPath, '{"mode":"greenfield","epics":[],"slices":[]}', 'utf8');
    await createCookRun({ cwd, specId: '42', runId: 'run-1' });

    const result = await populateCookWorktree({ cwd, runId: 'run-1' });

    expect(result).toEqual({
      status: 'missing_worktree',
      runStatus: 'created',
      runId: 'run-1',
      worktreeDir: cookWorktreeDir(cwd, 'run-1'),
      metadataPath: cookRunMetadataPath(cwd, 'run-1'),
      sideEffects: [],
    });
  });

  it('copies the selected plan into the worktree and updates metadata only', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-cook-populate-ready-'));
    const planPath = cookPlanFilePath(cwd, '42');
    await mkdir(dirname(planPath), { recursive: true });
    await writeFile(planPath, '{"mode":"greenfield","epics":[],"slices":[]}', 'utf8');
    await createCookRun({ cwd, specId: '42', runId: 'run-1' });
    await createCookWorktree({ cwd, runId: 'run-1' });

    const result = await populateCookWorktree({ cwd, runId: 'run-1' });

    expect(result).toEqual({
      status: 'worktree_populated',
      runStatus: 'worktree_populated',
      runId: 'run-1',
      worktreeDir: cookWorktreeDir(cwd, 'run-1'),
      metadataPath: cookRunMetadataPath(cwd, 'run-1'),
      populatedPlanPath: populatedPlanPath(cwd, 'run-1'),
      sideEffects: [
        { kind: 'mkdir', path: dirname(populatedPlanPath(cwd, 'run-1')) },
        { kind: 'write_file', path: populatedPlanPath(cwd, 'run-1'), ifExists: 'overwrite' },
        { kind: 'write_file', path: cookRunMetadataPath(cwd, 'run-1'), ifExists: 'overwrite' },
      ],
    });
    expect(await readFile(populatedPlanPath(cwd, 'run-1'), 'utf8')).toBe(
      '{"mode":"greenfield","epics":[],"slices":[]}',
    );
    expect(JSON.parse(await readFile(cookRunMetadataPath(cwd, 'run-1'), 'utf8'))).toMatchObject({
      runId: 'run-1',
      status: 'worktree_populated',
      populatedPlanPath: populatedPlanPath(cwd, 'run-1'),
    });
    expect(await pathExists(join(cookRunDir(cwd, 'run-1'), 'reports.jsonl'))).toBe(false);
    expect(await pathExists(join(cookRunDir(cwd, 'run-1'), 'petrinaut'))).toBe(false);
  });
});
