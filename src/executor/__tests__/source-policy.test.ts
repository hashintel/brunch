import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { pathExists } from '../path-exists.js';
import { planFilePath } from '../plan-file.js';
import { populateWorktree } from '../populate.js';
import { runDirPath, runMetadataPath, createRun } from '../run.js';
import { selectSourcePolicy, sourcePolicyPath, type SourcePolicyKind } from '../source-policy.js';
import { createWorktree } from '../worktree.js';
import { createFakeGitWorktreePort } from './fake-ports.js';

async function createPopulatedRun(cwd: string): Promise<void> {
  const planPath = planFilePath(cwd, '42');
  await mkdir(dirname(planPath), { recursive: true });
  await writeFile(planPath, '{"mode":"greenfield","epics":[],"slices":[]}', 'utf8');
  await createRun({ cwd, specId: '42', runId: 'run-1' });
  await createWorktree({ cwd, runId: 'run-1', gitWorktree: createFakeGitWorktreePort() });
  await populateWorktree({ cwd, runId: 'run-1' });
}

describe('selectSourcePolicy', () => {
  it('does not select a source policy when run metadata is missing', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-source-policy-missing-run-'));
    const result = await selectSourcePolicy({ cwd, runId: 'run-1', policy: 'plan_only' });

    expect(result).toEqual({
      status: 'missing_run',
      runStatus: 'not_started',
      runId: 'run-1',
      metadataPath: runMetadataPath(cwd, 'run-1'),
      sideEffects: [],
    });
  });

  it('does not select a source policy until plan population has completed', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-source-policy-not-populated-'));
    const planPath = planFilePath(cwd, '42');
    await mkdir(dirname(planPath), { recursive: true });
    await writeFile(planPath, '{"mode":"greenfield","epics":[],"slices":[]}', 'utf8');
    await createRun({ cwd, specId: '42', runId: 'run-1' });
    await createWorktree({ cwd, runId: 'run-1', gitWorktree: createFakeGitWorktreePort() });

    const result = await selectSourcePolicy({ cwd, runId: 'run-1', policy: 'plan_only' });

    expect(result).toEqual({
      status: 'missing_populated_plan',
      runStatus: 'worktree_created',
      runId: 'run-1',
      metadataPath: runMetadataPath(cwd, 'run-1'),
      sideEffects: [],
    });
  });

  it.each<SourcePolicyKind>(['plan_only', 'host_source_deferred'])(
    'records %s without copying host source files',
    async (policy) => {
      const cwd = await mkdtemp(join(tmpdir(), 'brunch-source-policy-ready-'));
      await createPopulatedRun(cwd);

      const result = await selectSourcePolicy({ cwd, runId: 'run-1', policy });

      expect(result).toEqual({
        status: 'source_policy_selected',
        runStatus: 'source_policy_selected',
        runId: 'run-1',
        metadataPath: runMetadataPath(cwd, 'run-1'),
        sourcePolicyPath: sourcePolicyPath(cwd, 'run-1'),
        policy,
        sideEffects: [
          { kind: 'write_file', path: sourcePolicyPath(cwd, 'run-1'), ifExists: 'overwrite' },
          { kind: 'write_file', path: runMetadataPath(cwd, 'run-1'), ifExists: 'overwrite' },
        ],
      });
      expect(JSON.parse(await readFile(sourcePolicyPath(cwd, 'run-1'), 'utf8'))).toEqual({
        policy,
        hostSourceCopied: false,
      });
      expect(JSON.parse(await readFile(runMetadataPath(cwd, 'run-1'), 'utf8'))).toMatchObject({
        status: 'source_policy_selected',
        sourcePolicy: policy,
        sourcePolicyPath: sourcePolicyPath(cwd, 'run-1'),
      });
      expect(await pathExists(join(runDirPath(cwd, 'run-1'), 'reports.jsonl'))).toBe(false);
      expect(await pathExists(join(runDirPath(cwd, 'run-1'), 'src'))).toBe(false);
    },
  );
});
