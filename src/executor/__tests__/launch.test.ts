import { access, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { prepareCookLaunch } from '../launch.js';
import { cookPlanFilePath } from '../plan-file.js';

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

describe('prepareCookLaunch', () => {
  it('reports a missing spec-scoped plan without creating run resources', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-cook-launch-missing-'));
    const result = await prepareCookLaunch({ cwd, specId: '42' });

    expect(result).toEqual({
      status: 'missing_plan',
      runStatus: 'not_started',
      planPath: cookPlanFilePath(cwd, '42'),
      sideEffects: [],
    });
    expect(await pathExists(join(cwd, '.brunch', 'cook', 'runs'))).toBe(false);
  });

  it('reports a ready request when the bounded plan file exists without starting cook', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-cook-launch-ready-'));
    const planPath = cookPlanFilePath(cwd, '42');
    await mkdir(join(cwd, '.brunch', 'cook', 'specs', '42'), { recursive: true });
    await writeFile(planPath, '{"mode":"greenfield","epics":[],"slices":[]}', 'utf8');

    const result = await prepareCookLaunch({ cwd, specId: '42' });

    expect(result).toEqual({
      status: 'ready',
      runStatus: 'not_started',
      planPath,
      sideEffects: [],
    });
    expect(await pathExists(join(cwd, '.brunch', 'cook', 'runs'))).toBe(false);
    expect(await pathExists(join(cwd, '.brunch', 'cook', 'petrinaut'))).toBe(false);
  });
});
