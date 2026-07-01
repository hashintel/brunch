import { access, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { planFilePath } from '../plan-file.js';
import { createRun, runDirPath, runMetadataPath } from '../run.js';

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

describe('createRun', () => {
  it('does not create a run when the selected spec plan is missing', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-cook-run-missing-'));
    const result = await createRun({ cwd, specId: '42', runId: 'run-1' });

    expect(result).toEqual({
      status: 'missing_plan',
      runStatus: 'not_started',
      planPath: planFilePath(cwd, '42'),
      sideEffects: [],
    });
    expect(await pathExists(runDirPath(cwd, 'run-1'))).toBe(false);
  });

  it('creates only run metadata for a ready plan', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-cook-run-ready-'));
    const planPath = planFilePath(cwd, '42');
    await mkdir(join(cwd, '.brunch', 'cook', 'specs', '42'), { recursive: true });
    await writeFile(planPath, '{"mode":"greenfield","epics":[],"slices":[]}', 'utf8');

    const result = await createRun({ cwd, specId: '42', runId: 'run-1' });

    expect(result).toEqual({
      status: 'created',
      runStatus: 'created',
      runId: 'run-1',
      runDir: runDirPath(cwd, 'run-1'),
      metadataPath: runMetadataPath(cwd, 'run-1'),
      planPath,
      sideEffects: [
        { kind: 'mkdir', path: runDirPath(cwd, 'run-1') },
        { kind: 'write_file', path: runMetadataPath(cwd, 'run-1'), ifExists: 'overwrite' },
      ],
    });
    expect(JSON.parse(await readFile(runMetadataPath(cwd, 'run-1'), 'utf8'))).toEqual({
      runId: 'run-1',
      specId: '42',
      planPath,
      status: 'created',
    });
    expect(await pathExists(join(runDirPath(cwd, 'run-1'), 'worktree'))).toBe(false);
    expect(await pathExists(join(runDirPath(cwd, 'run-1'), 'petrinaut'))).toBe(false);
    expect(await pathExists(join(runDirPath(cwd, 'run-1'), 'reports.jsonl'))).toBe(false);
    expect(await pathExists(join(cwd, '.brunch', 'cook', 'land'))).toBe(false);
  });
});
