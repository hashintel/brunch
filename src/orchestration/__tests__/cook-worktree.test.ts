import { access, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { cookPlanFilePath } from '../cook-plan-file.js';
import { cookRunDir, cookRunMetadataPath, createCookRun } from '../cook-run.js';
import { cookWorktreeDir, createCookWorktree } from '../cook-worktree.js';

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

describe('createCookWorktree', () => {
  it('does not create a worktree when run metadata is missing', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-cook-worktree-missing-'));
    const result = await createCookWorktree({ cwd, runId: 'run-1' });

    expect(result).toEqual({
      status: 'missing_run',
      runStatus: 'not_started',
      runId: 'run-1',
      metadataPath: cookRunMetadataPath(cwd, 'run-1'),
      sideEffects: [],
    });
    expect(await pathExists(cookWorktreeDir(cwd, 'run-1'))).toBe(false);
  });

  it('creates only an empty worktree directory for an existing run', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-cook-worktree-ready-'));
    const planPath = cookPlanFilePath(cwd, '42');
    await mkdir(dirname(planPath), { recursive: true });
    await writeFile(planPath, '{"mode":"greenfield","epics":[],"slices":[]}', 'utf8');
    await createCookRun({ cwd, specId: '42', runId: 'run-1' });

    const result = await createCookWorktree({ cwd, runId: 'run-1' });

    expect(result).toEqual({
      status: 'worktree_created',
      runStatus: 'worktree_created',
      runId: 'run-1',
      runDir: cookRunDir(cwd, 'run-1'),
      worktreeDir: cookWorktreeDir(cwd, 'run-1'),
      metadataPath: cookRunMetadataPath(cwd, 'run-1'),
      sideEffects: [
        { kind: 'mkdir', path: cookWorktreeDir(cwd, 'run-1') },
        { kind: 'write_file', path: cookRunMetadataPath(cwd, 'run-1'), ifExists: 'overwrite' },
      ],
    });
    expect(await pathExists(cookWorktreeDir(cwd, 'run-1'))).toBe(true);
    expect(JSON.parse(await readFile(cookRunMetadataPath(cwd, 'run-1'), 'utf8'))).toMatchObject({
      runId: 'run-1',
      status: 'worktree_created',
      worktreeDir: cookWorktreeDir(cwd, 'run-1'),
    });
    expect(await pathExists(join(cookRunDir(cwd, 'run-1'), 'petrinaut'))).toBe(false);
    expect(await pathExists(join(cookRunDir(cwd, 'run-1'), 'reports.jsonl'))).toBe(false);
    expect(await pathExists(join(cwd, '.brunch', 'cook', 'land'))).toBe(false);
  });
});
