import { access, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { GitWorktreePort } from '../execution-ports.js';
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
  function createFakeGitWorktreePort(
    create: GitWorktreePort['create'] = async ({ worktreeDir, ref }) => ({
      status: 'created',
      worktreeDir,
      sideEffects: [{ kind: 'git_worktree_add', path: worktreeDir, ref }],
    }),
  ): GitWorktreePort {
    return { create };
  }

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
