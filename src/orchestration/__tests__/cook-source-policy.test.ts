import { access, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { cookPlanFilePath } from '../cook-plan-file.js';
import { populateCookWorktree } from '../cook-populate.js';
import { cookRunDir, cookRunMetadataPath, createCookRun } from '../cook-run.js';
import {
  selectCookSourcePolicy,
  sourcePolicyPath,
  type CookSourcePolicyKind,
} from '../cook-source-policy.js';
import { createCookWorktree } from '../cook-worktree.js';

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function createPopulatedRun(cwd: string): Promise<void> {
  const planPath = cookPlanFilePath(cwd, '42');
  await mkdir(dirname(planPath), { recursive: true });
  await writeFile(planPath, '{"mode":"greenfield","epics":[],"slices":[]}', 'utf8');
  await createCookRun({ cwd, specId: '42', runId: 'run-1' });
  await createCookWorktree({ cwd, runId: 'run-1' });
  await populateCookWorktree({ cwd, runId: 'run-1' });
}

describe('selectCookSourcePolicy', () => {
  it('does not select a source policy when run metadata is missing', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-source-policy-missing-run-'));
    const result = await selectCookSourcePolicy({ cwd, runId: 'run-1', policy: 'plan_only' });

    expect(result).toEqual({
      status: 'missing_run',
      runStatus: 'not_started',
      runId: 'run-1',
      metadataPath: cookRunMetadataPath(cwd, 'run-1'),
      sideEffects: [],
    });
  });

  it('does not select a source policy until plan population has completed', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-source-policy-not-populated-'));
    const planPath = cookPlanFilePath(cwd, '42');
    await mkdir(dirname(planPath), { recursive: true });
    await writeFile(planPath, '{"mode":"greenfield","epics":[],"slices":[]}', 'utf8');
    await createCookRun({ cwd, specId: '42', runId: 'run-1' });
    await createCookWorktree({ cwd, runId: 'run-1' });

    const result = await selectCookSourcePolicy({ cwd, runId: 'run-1', policy: 'plan_only' });

    expect(result).toEqual({
      status: 'missing_populated_plan',
      runStatus: 'worktree_created',
      runId: 'run-1',
      metadataPath: cookRunMetadataPath(cwd, 'run-1'),
      sideEffects: [],
    });
  });

  it.each<CookSourcePolicyKind>(['plan_only', 'host_source_deferred'])(
    'records %s without copying host source files',
    async (policy) => {
      const cwd = await mkdtemp(join(tmpdir(), 'brunch-source-policy-ready-'));
      await createPopulatedRun(cwd);

      const result = await selectCookSourcePolicy({ cwd, runId: 'run-1', policy });

      expect(result).toEqual({
        status: 'source_policy_selected',
        runStatus: 'source_policy_selected',
        runId: 'run-1',
        metadataPath: cookRunMetadataPath(cwd, 'run-1'),
        sourcePolicyPath: sourcePolicyPath(cwd, 'run-1'),
        policy,
        sideEffects: [
          { kind: 'write_file', path: sourcePolicyPath(cwd, 'run-1'), ifExists: 'overwrite' },
          { kind: 'write_file', path: cookRunMetadataPath(cwd, 'run-1'), ifExists: 'overwrite' },
        ],
      });
      expect(JSON.parse(await readFile(sourcePolicyPath(cwd, 'run-1'), 'utf8'))).toEqual({
        policy,
        hostSourceCopied: false,
      });
      expect(JSON.parse(await readFile(cookRunMetadataPath(cwd, 'run-1'), 'utf8'))).toMatchObject({
        status: 'source_policy_selected',
        sourcePolicy: policy,
        sourcePolicyPath: sourcePolicyPath(cwd, 'run-1'),
      });
      expect(await pathExists(join(cookRunDir(cwd, 'run-1'), 'reports.jsonl'))).toBe(false);
      expect(await pathExists(join(cookRunDir(cwd, 'run-1'), 'src'))).toBe(false);
    },
  );
});
