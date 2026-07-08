import { access, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { planFilePath } from '../plan-file.js';
import { runDirPath, runMetadataPath, createRun } from '../run.js';
import { worktreeDirPath, createWorktree } from '../worktree.js';
import { createFakeGitWorktreePort } from './fake-ports.js';

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
    const result = await createWorktree({
      cwd,
      runId: 'run-1',
      gitWorktree: createFakeGitWorktreePort(),
    });

    expect(result).toEqual({
      status: 'missing_run',
      runStatus: 'not_started',
      runId: 'run-1',
      metadataPath: runMetadataPath(cwd, 'run-1'),
      sideEffects: [],
    });
    expect(await pathExists(worktreeDirPath(cwd, 'run-1'))).toBe(false);
  });

  it('creates the run workspace through the injected git worktree port', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-cook-worktree-ready-'));
    const planPath = planFilePath(cwd, '42');
    await mkdir(dirname(planPath), { recursive: true });
    await writeFile(planPath, '{"mode":"greenfield","epics":[],"slices":[]}', 'utf8');
    await createRun({ cwd, specId: '42', runId: 'run-1' });

    const calls: Array<{ cwd: string; worktreeDir: string; ref: string }> = [];
    const result = await createWorktree({
      cwd,
      runId: 'run-1',
      gitWorktree: createFakeGitWorktreePort(async (portArgs) => {
        calls.push(portArgs);
        await mkdir(portArgs.worktreeDir, { recursive: true });
        await writeFile(join(portArgs.worktreeDir, '.git'), 'gitdir: /tmp/worktrees/run-1\n', 'utf8');
        return {
          status: 'created',
          worktreeDir: portArgs.worktreeDir,
          sideEffects: [{ kind: 'git_worktree_add', path: portArgs.worktreeDir, ref: portArgs.ref }],
        };
      }),
    });

    expect(result).toEqual({
      status: 'worktree_created',
      runStatus: 'worktree_created',
      runId: 'run-1',
      runDir: runDirPath(cwd, 'run-1'),
      worktreeDir: worktreeDirPath(cwd, 'run-1'),
      metadataPath: runMetadataPath(cwd, 'run-1'),
      sideEffects: [
        { kind: 'git_worktree_add', path: worktreeDirPath(cwd, 'run-1'), ref: 'HEAD' },
        { kind: 'write_file', path: runMetadataPath(cwd, 'run-1'), ifExists: 'overwrite' },
      ],
    });
    expect(calls).toEqual([{ cwd, worktreeDir: worktreeDirPath(cwd, 'run-1'), ref: 'HEAD' }]);
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

  it('creates an empty directory substrate as an isolated git repository without invoking the git worktree port', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-cook-empty-substrate-'));
    const planPath = planFilePath(cwd, '42');
    await mkdir(dirname(planPath), { recursive: true });
    await writeFile(planPath, '{"mode":"greenfield","epics":[],"slices":[]}', 'utf8');
    await createRun({ cwd, specId: '42', runId: 'run-1', substrate: 'empty_dir' });
    let gitPortCalled = false;

    const result = await createWorktree({
      cwd,
      runId: 'run-1',
      gitWorktree: createFakeGitWorktreePort(async () => {
        gitPortCalled = true;
        return { status: 'failed', worktreeDir: '/unused', message: 'should not run', sideEffects: [] };
      }),
    });

    expect(gitPortCalled).toBe(false);
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
    await expect(access(join(worktreeDirPath(cwd, 'run-1'), '.git'))).resolves.toBeUndefined();
    expect(JSON.parse(await readFile(runMetadataPath(cwd, 'run-1'), 'utf8'))).toMatchObject({
      substrate: 'empty_dir',
      status: 'worktree_created',
      worktreeDir: worktreeDirPath(cwd, 'run-1'),
    });
  });

  it('clears a stale empty directory substrate target before creating it', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-cook-empty-substrate-stale-'));
    const planPath = planFilePath(cwd, '42');
    await mkdir(dirname(planPath), { recursive: true });
    await writeFile(planPath, '{"mode":"greenfield","epics":[],"slices":[]}', 'utf8');
    await createRun({ cwd, specId: '42', runId: 'run-1', substrate: 'empty_dir' });
    const worktreeDir = worktreeDirPath(cwd, 'run-1');
    await mkdir(worktreeDir, { recursive: true });
    await writeFile(join(worktreeDir, 'stale.txt'), 'leftover workspace', 'utf8');

    const result = await createWorktree({
      cwd,
      runId: 'run-1',
      gitWorktree: createFakeGitWorktreePort(async () => {
        throw new Error('git should not run for empty_dir');
      }),
    });

    expect(result.status).toBe('worktree_created');
    expect(await pathExists(worktreeDir)).toBe(true);
    expect(await pathExists(join(worktreeDir, 'stale.txt'))).toBe(false);
  });

  it('recreates an empty directory substrate from a stale git worktree marker', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-cook-empty-substrate-git-marker-'));
    const planPath = planFilePath(cwd, '42');
    await mkdir(dirname(planPath), { recursive: true });
    await writeFile(planPath, '{"mode":"greenfield","epics":[],"slices":[]}', 'utf8');
    await createRun({ cwd, specId: '42', runId: 'run-1', substrate: 'empty_dir' });
    const worktreeDir = worktreeDirPath(cwd, 'run-1');
    await mkdir(worktreeDir, { recursive: true });
    await writeFile(join(worktreeDir, '.git'), 'gitdir: /tmp/worktrees/run-1\n', 'utf8');

    const result = await createWorktree({
      cwd,
      runId: 'run-1',
      gitWorktree: createFakeGitWorktreePort(async () => {
        throw new Error('git should not run for empty_dir');
      }),
    });

    expect(result.status).toBe('worktree_created');
    expect(await pathExists(join(worktreeDir, '.git'))).toBe(true);
    expect(JSON.parse(await readFile(runMetadataPath(cwd, 'run-1'), 'utf8'))).toMatchObject({
      substrate: 'empty_dir',
      status: 'worktree_created',
      worktreeDir,
    });
  });

  it('reinitializes a repairable empty directory substrate whose recorded worktree lost its git repo', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-cook-empty-substrate-missing-git-'));
    const planPath = planFilePath(cwd, '42');
    await mkdir(dirname(planPath), { recursive: true });
    await writeFile(planPath, '{"mode":"greenfield","epics":[],"slices":[]}', 'utf8');
    await createRun({ cwd, specId: '42', runId: 'run-1', substrate: 'empty_dir' });
    const worktreeDir = worktreeDirPath(cwd, 'run-1');
    await mkdir(worktreeDir, { recursive: true });
    await writeFile(join(worktreeDir, 'not-a-repo.txt'), 'corrupt empty-dir retry', 'utf8');
    await writeFile(
      runMetadataPath(cwd, 'run-1'),
      JSON.stringify({
        runId: 'run-1',
        specId: '42',
        planPath,
        status: 'worktree_created',
        substrate: 'empty_dir',
        worktreeDir,
      }),
      'utf8',
    );

    const result = await createWorktree({
      cwd,
      runId: 'run-1',
      gitWorktree: createFakeGitWorktreePort(async () => {
        throw new Error('git should not run for empty_dir');
      }),
    });

    expect(result.status).toBe('worktree_created');
    expect(await pathExists(join(worktreeDir, 'not-a-repo.txt'))).toBe(false);
    expect(await pathExists(join(worktreeDir, '.git'))).toBe(true);
  });

  it('reinitializes a repairable empty directory substrate whose git marker points outside the worktree', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-cook-empty-substrate-host-marker-'));
    const planPath = planFilePath(cwd, '42');
    await mkdir(dirname(planPath), { recursive: true });
    await writeFile(planPath, '{"mode":"greenfield","epics":[],"slices":[]}', 'utf8');
    await createRun({ cwd, specId: '42', runId: 'run-1', substrate: 'empty_dir' });
    const worktreeDir = worktreeDirPath(cwd, 'run-1');
    await mkdir(worktreeDir, { recursive: true });
    await writeFile(join(worktreeDir, '.git'), 'gitdir: /tmp/host-linked-worktree\n', 'utf8');
    await writeFile(join(worktreeDir, 'host-file.txt'), 'should be cleared', 'utf8');
    await writeFile(
      runMetadataPath(cwd, 'run-1'),
      JSON.stringify({
        runId: 'run-1',
        specId: '42',
        planPath,
        status: 'worktree_created',
        substrate: 'empty_dir',
        worktreeDir,
      }),
      'utf8',
    );

    const result = await createWorktree({
      cwd,
      runId: 'run-1',
      gitWorktree: createFakeGitWorktreePort(async () => {
        throw new Error('git worktree port should not run for empty_dir');
      }),
    });

    expect(result.status).toBe('worktree_created');
    expect(await pathExists(join(worktreeDir, 'host-file.txt'))).toBe(false);
    expect(await pathExists(join(worktreeDir, '.git'))).toBe(true);
  });

  it('fails closed for an advanced empty directory substrate whose recorded worktree lost its git repo', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-cook-empty-substrate-advanced-'));
    const planPath = planFilePath(cwd, '42');
    await mkdir(dirname(planPath), { recursive: true });
    await writeFile(planPath, '{"mode":"greenfield","epics":[],"slices":[]}', 'utf8');
    await createRun({ cwd, specId: '42', runId: 'run-1', substrate: 'empty_dir' });
    const worktreeDir = worktreeDirPath(cwd, 'run-1');
    await mkdir(worktreeDir, { recursive: true });
    await writeFile(
      runMetadataPath(cwd, 'run-1'),
      JSON.stringify({
        runId: 'run-1',
        specId: '42',
        planPath,
        status: 'source_copied',
        substrate: 'empty_dir',
        worktreeDir,
      }),
      'utf8',
    );

    const result = await createWorktree({
      cwd,
      runId: 'run-1',
      gitWorktree: createFakeGitWorktreePort(async () => {
        throw new Error('git should not run for empty_dir retry');
      }),
    });

    expect(result).toEqual({
      status: 'worktree_create_failed',
      runStatus: 'source_copied',
      runId: 'run-1',
      worktreeDir,
      metadataPath: runMetadataPath(cwd, 'run-1'),
      message: 'run already advanced to source_copied; refusing to recreate missing or invalid worktree',
      sideEffects: [],
    });
    expect(JSON.parse(await readFile(runMetadataPath(cwd, 'run-1'), 'utf8'))).toMatchObject({
      status: 'source_copied',
      substrate: 'empty_dir',
      worktreeDir,
    });
  });

  it('is idempotent: a second create does not re-invoke the git worktree port', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-cook-worktree-idempotent-'));
    const planPath = planFilePath(cwd, '42');
    await mkdir(dirname(planPath), { recursive: true });
    await writeFile(planPath, '{"mode":"greenfield","epics":[],"slices":[]}', 'utf8');
    await createRun({ cwd, specId: '42', runId: 'run-1' });

    const calls: Array<{ cwd: string; worktreeDir: string; ref: string }> = [];
    const gitWorktree = createFakeGitWorktreePort(async (portArgs) => {
      calls.push(portArgs);
      await mkdir(portArgs.worktreeDir, { recursive: true });
      await writeFile(join(portArgs.worktreeDir, '.git'), 'gitdir: /tmp/worktrees/run-1\n', 'utf8');
      return {
        status: 'created',
        worktreeDir: portArgs.worktreeDir,
        sideEffects: [{ kind: 'git_worktree_add', path: portArgs.worktreeDir, ref: portArgs.ref }],
      };
    });

    const first = await createWorktree({ cwd, runId: 'run-1', gitWorktree });
    expect(first.status).toBe('worktree_created');

    const second = await createWorktree({ cwd, runId: 'run-1', gitWorktree });
    expect(second).toEqual({
      status: 'already_created',
      runStatus: 'worktree_created',
      runId: 'run-1',
      runDir: runDirPath(cwd, 'run-1'),
      worktreeDir: worktreeDirPath(cwd, 'run-1'),
      metadataPath: runMetadataPath(cwd, 'run-1'),
      sideEffects: [],
    });
    // git worktree add ran exactly once, not on the retry.
    expect(calls).toHaveLength(1);
  });

  it('recovers metadata when the worktree exists after a metadata write failure', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-cook-worktree-recover-metadata-'));
    const planPath = planFilePath(cwd, '42');
    await mkdir(dirname(planPath), { recursive: true });
    await writeFile(planPath, '{"mode":"greenfield","epics":[],"slices":[]}', 'utf8');
    await createRun({ cwd, specId: '42', runId: 'run-1' });
    await mkdir(worktreeDirPath(cwd, 'run-1'), { recursive: true });
    await writeFile(join(worktreeDirPath(cwd, 'run-1'), '.git'), 'gitdir: /tmp/worktrees/run-1\n', 'utf8');

    const result = await createWorktree({
      cwd,
      runId: 'run-1',
      gitWorktree: createFakeGitWorktreePort(async () => {
        throw new Error('git should not run when the worktree already exists');
      }),
    });

    expect(result).toEqual({
      status: 'worktree_created',
      runStatus: 'worktree_created',
      runId: 'run-1',
      runDir: runDirPath(cwd, 'run-1'),
      worktreeDir: worktreeDirPath(cwd, 'run-1'),
      metadataPath: runMetadataPath(cwd, 'run-1'),
      sideEffects: [{ kind: 'write_file', path: runMetadataPath(cwd, 'run-1'), ifExists: 'overwrite' }],
    });
    expect(JSON.parse(await readFile(runMetadataPath(cwd, 'run-1'), 'utf8'))).toMatchObject({
      status: 'worktree_created',
      worktreeDir: worktreeDirPath(cwd, 'run-1'),
    });
  });

  it('does not recover metadata from a stale non-git directory', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-cook-worktree-stale-directory-'));
    const planPath = planFilePath(cwd, '42');
    await mkdir(dirname(planPath), { recursive: true });
    await writeFile(planPath, '{"mode":"greenfield","epics":[],"slices":[]}', 'utf8');
    await createRun({ cwd, specId: '42', runId: 'run-1' });
    await mkdir(worktreeDirPath(cwd, 'run-1'), { recursive: true });

    const calls: Array<{ cwd: string; worktreeDir: string; ref: string }> = [];
    const result = await createWorktree({
      cwd,
      runId: 'run-1',
      gitWorktree: createFakeGitWorktreePort(async (portArgs) => {
        calls.push(portArgs);
        return {
          status: 'failed',
          worktreeDir: portArgs.worktreeDir,
          message: 'not a git worktree',
          sideEffects: [],
        };
      }),
    });

    expect(result).toEqual({
      status: 'worktree_create_failed',
      runStatus: 'created',
      runId: 'run-1',
      worktreeDir: worktreeDirPath(cwd, 'run-1'),
      metadataPath: runMetadataPath(cwd, 'run-1'),
      message: 'not a git worktree',
      sideEffects: [],
    });
    expect(calls).toEqual([{ cwd, worktreeDir: worktreeDirPath(cwd, 'run-1'), ref: 'HEAD' }]);
    expect(JSON.parse(await readFile(runMetadataPath(cwd, 'run-1'), 'utf8'))).toMatchObject({
      status: 'created',
    });
  });

  it('repairs a stale non-git directory recorded in metadata before recreating', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-cook-worktree-repair-stale-'));
    const planPath = planFilePath(cwd, '42');
    await mkdir(dirname(planPath), { recursive: true });
    await writeFile(planPath, '{"mode":"greenfield","epics":[],"slices":[]}', 'utf8');
    await createRun({ cwd, specId: '42', runId: 'run-1' });

    // run.json already points at a worktreeDir that exists without a `.git`
    // marker (interrupted `git worktree add` or a legacy mkdir workspace).
    const worktreeDir = worktreeDirPath(cwd, 'run-1');
    await writeFile(
      runMetadataPath(cwd, 'run-1'),
      JSON.stringify({
        runId: 'run-1',
        specId: '42',
        planPath,
        status: 'worktree_created',
        worktreeDir,
      }),
      'utf8',
    );
    await mkdir(worktreeDir, { recursive: true });
    await writeFile(join(worktreeDir, 'stale.txt'), 'legacy checkout', 'utf8');

    // `git worktree add` refuses a non-empty target; the fake records whether the
    // stale content survived to the point where git would have run.
    const staleSurvivedAtCreate: boolean[] = [];
    const result = await createWorktree({
      cwd,
      runId: 'run-1',
      gitWorktree: createFakeGitWorktreePort(async (portArgs) => {
        staleSurvivedAtCreate.push(await pathExists(join(portArgs.worktreeDir, 'stale.txt')));
        await mkdir(portArgs.worktreeDir, { recursive: true });
        await writeFile(join(portArgs.worktreeDir, '.git'), 'gitdir: /tmp/worktrees/run-1\n', 'utf8');
        return {
          status: 'created',
          worktreeDir: portArgs.worktreeDir,
          sideEffects: [{ kind: 'git_worktree_add', path: portArgs.worktreeDir, ref: portArgs.ref }],
        };
      }),
    });

    expect(result.status).toBe('worktree_created');
    // The stale directory was cleared before git ran, so the run recovers.
    expect(staleSurvivedAtCreate).toEqual([false]);
    expect(await pathExists(join(worktreeDir, 'stale.txt'))).toBe(false);
    expect(await pathExists(join(worktreeDir, '.git'))).toBe(true);
  });

  it('recreates the worktree when persisted metadata points at a missing directory', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-cook-worktree-recreate-missing-'));
    const planPath = planFilePath(cwd, '42');
    await mkdir(dirname(planPath), { recursive: true });
    await writeFile(planPath, '{"mode":"greenfield","epics":[],"slices":[]}', 'utf8');
    await createRun({ cwd, specId: '42', runId: 'run-1' });
    await writeFile(
      runMetadataPath(cwd, 'run-1'),
      JSON.stringify({
        runId: 'run-1',
        specId: '42',
        planPath,
        status: 'worktree_created',
        worktreeDir: worktreeDirPath(cwd, 'run-1'),
      }),
      'utf8',
    );

    const calls: Array<{ cwd: string; worktreeDir: string; ref: string }> = [];
    const result = await createWorktree({
      cwd,
      runId: 'run-1',
      gitWorktree: createFakeGitWorktreePort(async (portArgs) => {
        calls.push(portArgs);
        await mkdir(portArgs.worktreeDir, { recursive: true });
        await writeFile(join(portArgs.worktreeDir, '.git'), 'gitdir: /tmp/worktrees/run-1\n', 'utf8');
        return {
          status: 'created',
          worktreeDir: portArgs.worktreeDir,
          sideEffects: [{ kind: 'git_worktree_add', path: portArgs.worktreeDir, ref: portArgs.ref }],
        };
      }),
    });

    expect(result.status).toBe('worktree_created');
    expect(calls).toEqual([{ cwd, worktreeDir: worktreeDirPath(cwd, 'run-1'), ref: 'HEAD' }]);
    expect(await pathExists(worktreeDirPath(cwd, 'run-1'))).toBe(true);
  });

  it('does not delete or downgrade an advanced run with a corrupt recorded worktree', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-cook-worktree-advanced-corrupt-'));
    const planPath = planFilePath(cwd, '42');
    await mkdir(dirname(planPath), { recursive: true });
    await writeFile(planPath, '{"mode":"greenfield","epics":[],"slices":[]}', 'utf8');
    await createRun({ cwd, specId: '42', runId: 'run-1' });
    const worktreeDir = worktreeDirPath(cwd, 'run-1');
    await mkdir(worktreeDir, { recursive: true });
    await writeFile(join(worktreeDir, 'source.txt'), 'already populated', 'utf8');
    await writeFile(
      runMetadataPath(cwd, 'run-1'),
      JSON.stringify({
        runId: 'run-1',
        specId: '42',
        planPath,
        status: 'source_copied',
        worktreeDir,
      }),
      'utf8',
    );

    const result = await createWorktree({
      cwd,
      runId: 'run-1',
      gitWorktree: createFakeGitWorktreePort(async () => {
        throw new Error('git should not run for an advanced corrupt worktree');
      }),
    });

    expect(result).toEqual({
      status: 'worktree_create_failed',
      runStatus: 'source_copied',
      runId: 'run-1',
      worktreeDir,
      metadataPath: runMetadataPath(cwd, 'run-1'),
      message: 'run already advanced to source_copied; refusing to recreate missing or invalid worktree',
      sideEffects: [],
    });
    expect(await readFile(join(worktreeDir, 'source.txt'), 'utf8')).toBe('already populated');
    expect(JSON.parse(await readFile(runMetadataPath(cwd, 'run-1'), 'utf8'))).toMatchObject({
      status: 'source_copied',
      worktreeDir,
    });
  });

  it('does not update run metadata when the git worktree port fails', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-cook-worktree-failed-'));
    const planPath = planFilePath(cwd, '42');
    await mkdir(dirname(planPath), { recursive: true });
    await writeFile(planPath, '{"mode":"greenfield","epics":[],"slices":[]}', 'utf8');
    await createRun({ cwd, specId: '42', runId: 'run-1' });

    const result = await createWorktree({
      cwd,
      runId: 'run-1',
      gitWorktree: createFakeGitWorktreePort(async ({ worktreeDir }) => ({
        status: 'failed',
        worktreeDir,
        message: 'not a git repository',
        sideEffects: [],
      })),
    });

    expect(result).toEqual({
      status: 'worktree_create_failed',
      runStatus: 'created',
      runId: 'run-1',
      worktreeDir: worktreeDirPath(cwd, 'run-1'),
      metadataPath: runMetadataPath(cwd, 'run-1'),
      message: 'not a git repository',
      sideEffects: [],
    });
    expect(JSON.parse(await readFile(runMetadataPath(cwd, 'run-1'), 'utf8'))).toMatchObject({
      runId: 'run-1',
      status: 'created',
    });
  });
});
