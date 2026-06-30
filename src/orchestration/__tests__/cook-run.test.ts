import { access, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { cookPlanFilePath } from '../cook-plan-file.js';
import { createCookRun, cookRunDir, cookRunMetadataPath } from '../cook-run.js';

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

describe('createCookRun', () => {
  it('does not create a run when the selected spec plan is missing', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-cook-run-missing-'));
    const result = await createCookRun({ cwd, specId: '42', runId: 'run-1' });

    expect(result).toEqual({
      status: 'missing_plan',
      runStatus: 'not_started',
      planPath: cookPlanFilePath(cwd, '42'),
      sideEffects: [],
    });
    expect(await pathExists(cookRunDir(cwd, 'run-1'))).toBe(false);
  });

  it('creates only run metadata for a ready plan', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-cook-run-ready-'));
    const planPath = cookPlanFilePath(cwd, '42');
    await mkdir(join(cwd, '.brunch', 'cook', 'specs', '42'), { recursive: true });
    await writeFile(planPath, '{"mode":"greenfield","epics":[],"slices":[]}', 'utf8');

    const result = await createCookRun({ cwd, specId: '42', runId: 'run-1' });

    expect(result).toEqual({
      status: 'created',
      runStatus: 'created',
      runId: 'run-1',
      runDir: cookRunDir(cwd, 'run-1'),
      metadataPath: cookRunMetadataPath(cwd, 'run-1'),
      planPath,
      sideEffects: [
        { kind: 'mkdir', path: cookRunDir(cwd, 'run-1') },
        { kind: 'write_file', path: cookRunMetadataPath(cwd, 'run-1'), ifExists: 'overwrite' },
      ],
    });
    expect(JSON.parse(await readFile(cookRunMetadataPath(cwd, 'run-1'), 'utf8'))).toEqual({
      runId: 'run-1',
      specId: '42',
      planPath,
      status: 'created',
    });
    expect(await pathExists(join(cookRunDir(cwd, 'run-1'), 'worktree'))).toBe(false);
    expect(await pathExists(join(cookRunDir(cwd, 'run-1'), 'petrinaut'))).toBe(false);
    expect(await pathExists(join(cookRunDir(cwd, 'run-1'), 'reports.jsonl'))).toBe(false);
    expect(await pathExists(join(cwd, '.brunch', 'cook', 'land'))).toBe(false);
  });
});
