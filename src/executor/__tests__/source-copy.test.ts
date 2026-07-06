import { access, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { planFilePath } from '../plan-file.js';
import { populateWorktree } from '../populate.js';
import { runDirPath, runMetadataPath, createRun } from '../run.js';
import { copyHostSource } from '../source-copy.js';
import { selectSourcePolicy, sourcePolicyPath } from '../source-policy.js';
import { worktreeDirPath, createWorktree } from '../worktree.js';

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function createPolicyRun(cwd: string, policy: 'plan_only' | 'host_source_deferred'): Promise<void> {
  const planPath = planFilePath(cwd, '42');
  await mkdir(join(cwd, 'src'), { recursive: true });
  await writeFile(join(cwd, 'src', 'app.ts'), 'export const app = true;\n', 'utf8');
  await writeFile(join(cwd, 'package.json'), '{"type":"module"}\n', 'utf8');
  await mkdir(join(cwd, '.brunch', 'debug'), { recursive: true });
  await writeFile(join(cwd, '.brunch', 'debug', 'skip.txt'), 'skip', 'utf8');
  await mkdir(join(cwd, '.git'), { recursive: true });
  await writeFile(join(cwd, '.git', 'HEAD'), 'skip', 'utf8');
  await mkdir(join(cwd, 'node_modules', 'dep'), { recursive: true });
  await writeFile(join(cwd, 'node_modules', 'dep', 'index.js'), 'skip', 'utf8');
  await mkdir(join(cwd, 'dist'), { recursive: true });
  await writeFile(join(cwd, 'dist', 'bundle.js'), 'skip', 'utf8');
  await mkdir(join(cwd, '.brunch', 'cook', 'specs', '42'), { recursive: true });
  await writeFile(planPath, '{"mode":"greenfield","epics":[],"slices":[]}', 'utf8');
  await createRun({ cwd, specId: '42', runId: 'run-1' });
  await createWorktree({ cwd, runId: 'run-1' });
  await populateWorktree({ cwd, runId: 'run-1' });
  await selectSourcePolicy({ cwd, runId: 'run-1', policy });
}

describe('copyHostSource', () => {
  it('does not copy when source policy has not been selected', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-source-copy-missing-policy-'));
    const result = await copyHostSource({ cwd, runId: 'run-1' });

    expect(result).toEqual({
      status: 'missing_run',
      runStatus: 'not_started',
      runId: 'run-1',
      metadataPath: runMetadataPath(cwd, 'run-1'),
      sideEffects: [],
    });
  });

  it('skips host source copy for plan_only policy', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-source-copy-plan-only-'));
    await createPolicyRun(cwd, 'plan_only');

    const result = await copyHostSource({ cwd, runId: 'run-1' });

    expect(result).toEqual({
      status: 'policy_skipped',
      runStatus: 'source_copied',
      runId: 'run-1',
      metadataPath: runMetadataPath(cwd, 'run-1'),
      policy: 'plan_only',
      sideEffects: [{ kind: 'write_file', path: runMetadataPath(cwd, 'run-1'), ifExists: 'overwrite' }],
    });
    expect(await pathExists(join(worktreeDirPath(cwd, 'run-1'), 'src', 'app.ts'))).toBe(false);
    // The run still advances so report init / slices can proceed on plan_only.
    expect(JSON.parse(await readFile(runMetadataPath(cwd, 'run-1'), 'utf8'))).toMatchObject({
      status: 'source_copied',
      sourceCopied: false,
    });
  });

  it('copies host source entries into the worktree while excluding cook state and heavy dirs', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-source-copy-ready-'));
    await createPolicyRun(cwd, 'host_source_deferred');

    const result = await copyHostSource({ cwd, runId: 'run-1' });

    expect(result).toEqual({
      status: 'source_copied',
      runStatus: 'source_copied',
      runId: 'run-1',
      metadataPath: runMetadataPath(cwd, 'run-1'),
      sourcePolicyPath: sourcePolicyPath(cwd, 'run-1'),
      copiedEntries: ['package.json', 'src'],
      sideEffects: [
        {
          kind: 'copy_entry',
          from: join(cwd, 'package.json'),
          to: join(worktreeDirPath(cwd, 'run-1'), 'package.json'),
        },
        { kind: 'copy_entry', from: join(cwd, 'src'), to: join(worktreeDirPath(cwd, 'run-1'), 'src') },
        { kind: 'write_file', path: sourcePolicyPath(cwd, 'run-1'), ifExists: 'overwrite' },
        { kind: 'write_file', path: runMetadataPath(cwd, 'run-1'), ifExists: 'overwrite' },
      ],
    });
    expect(await readFile(join(worktreeDirPath(cwd, 'run-1'), 'src', 'app.ts'), 'utf8')).toBe(
      'export const app = true;\n',
    );
    expect(await pathExists(join(worktreeDirPath(cwd, 'run-1'), '.brunch', 'debug', 'skip.txt'))).toBe(false);
    expect(await pathExists(join(worktreeDirPath(cwd, 'run-1'), '.git', 'HEAD'))).toBe(false);
    expect(await pathExists(join(worktreeDirPath(cwd, 'run-1'), 'node_modules', 'dep', 'index.js'))).toBe(
      false,
    );
    expect(await pathExists(join(worktreeDirPath(cwd, 'run-1'), 'dist', 'bundle.js'))).toBe(false);
    expect(JSON.parse(await readFile(sourcePolicyPath(cwd, 'run-1'), 'utf8'))).toMatchObject({
      policy: 'host_source_deferred',
      hostSourceCopied: true,
      copiedEntries: ['package.json', 'src'],
    });
    expect(JSON.parse(await readFile(runMetadataPath(cwd, 'run-1'), 'utf8'))).toMatchObject({
      status: 'source_copied',
      sourceCopied: true,
    });
    expect(await pathExists(join(runDirPath(cwd, 'run-1'), 'reports.jsonl'))).toBe(false);
  });
});
