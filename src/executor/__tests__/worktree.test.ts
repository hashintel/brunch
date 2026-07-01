import { access, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { planFilePath } from '../plan-file.js';
import { runDirPath, runMetadataPath, createRun } from '../run.js';
import { worktreeDirPath, createWorktree } from '../worktree.js';

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

describe('createWorktree', () => {
  it('does not create a worktree when run metadata is missing', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-cook-worktree-missing-'));
    const result = await createWorktree({ cwd, runId: 'run-1' });

    expect(result).toEqual({
      status: 'missing_run',
      runStatus: 'not_started',
      runId: 'run-1',
      metadataPath: runMetadataPath(cwd, 'run-1'),
      sideEffects: [],
    });
    expect(await pathExists(worktreeDirPath(cwd, 'run-1'))).toBe(false);
  });

  it('creates only an empty worktree directory for an existing run', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-cook-worktree-ready-'));
    const planPath = planFilePath(cwd, '42');
    await mkdir(dirname(planPath), { recursive: true });
    await writeFile(planPath, '{"mode":"greenfield","epics":[],"slices":[]}', 'utf8');
    await createRun({ cwd, specId: '42', runId: 'run-1' });

    const result = await createWorktree({ cwd, runId: 'run-1' });

    expect(result).toEqual({
      status: 'worktree_created',
      runStatus: 'worktree_created',
      runId: 'run-1',
      runDir: runDirPath(cwd, 'run-1'),
      worktreeDir: worktreeDirPath(cwd, 'run-1'),
      metadataPath: runMetadataPath(cwd, 'run-1'),
      sideEffects: [
        { kind: 'mkdir', path: worktreeDirPath(cwd, 'run-1') },
        { kind: 'write_file', path: runMetadataPath(cwd, 'run-1'), ifExists: 'overwrite' },
      ],
    });
    expect(await pathExists(worktreeDirPath(cwd, 'run-1'))).toBe(true);
    expect(JSON.parse(await readFile(runMetadataPath(cwd, 'run-1'), 'utf8'))).toMatchObject({
      runId: 'run-1',
      status: 'worktree_created',
      worktreeDir: worktreeDirPath(cwd, 'run-1'),
    });
    expect(await pathExists(join(runDirPath(cwd, 'run-1'), 'petrinaut'))).toBe(false);
    expect(await pathExists(join(runDirPath(cwd, 'run-1'), 'reports.jsonl'))).toBe(false);
    expect(await pathExists(join(cwd, '.brunch', 'cook', 'land'))).toBe(false);
  });
});
