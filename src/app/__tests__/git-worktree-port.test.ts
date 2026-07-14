import { describe, expect, it } from 'vitest';

import { createGitWorktreePort } from '../git-worktree-port.js';

describe('createGitWorktreePort', () => {
  it('shells out to git worktree add for the requested run workspace', async () => {
    const controller = new AbortController();
    const calls: Array<{
      command: string;
      args: readonly string[];
      cwd: string;
      signal?: AbortSignal | undefined;
      timeoutMs?: number | undefined;
      maxOutputBytes?: number | undefined;
    }> = [];
    const port = createGitWorktreePort({
      run: async (command, args, options) => {
        calls.push({
          command,
          args,
          cwd: options.cwd,
          signal: options.signal,
          timeoutMs: options.timeoutMs,
          maxOutputBytes: options.maxOutputBytes,
        });
        if (args[0] === 'rev-parse') return { exitCode: 0, stdout: 'headsha123\n', stderr: '' };
        return { exitCode: 0, stdout: 'Preparing worktree', stderr: '' };
      },
    });

    const result = await port.create({
      cwd: '/repo',
      worktreeDir: '/repo/.brunch/cook/runs/run-1/worktree',
      ref: 'HEAD',
      signal: controller.signal,
    });

    expect(calls).toEqual([
      {
        command: 'git',
        args: ['worktree', 'add', '--detach', '/repo/.brunch/cook/runs/run-1/worktree', 'HEAD'],
        cwd: '/repo',
        signal: controller.signal,
        timeoutMs: 30_000,
        maxOutputBytes: 16 * 1024,
      },
      {
        command: 'git',
        args: ['rev-parse', 'HEAD'],
        cwd: '/repo/.brunch/cook/runs/run-1/worktree',
        signal: undefined,
        timeoutMs: 30_000,
        maxOutputBytes: 16 * 1024,
      },
    ]);
    expect(result).toEqual({
      status: 'created',
      worktreeDir: '/repo/.brunch/cook/runs/run-1/worktree',
      createdFromSha: 'headsha123',
      sideEffects: [
        { kind: 'git_worktree_add', path: '/repo/.brunch/cook/runs/run-1/worktree', ref: 'HEAD' },
      ],
    });
  });

  it('fails without a side-effect claim when the created worktree HEAD cannot be resolved', async () => {
    const port = createGitWorktreePort({
      run: async (_command, args) =>
        args[0] === 'rev-parse'
          ? { exitCode: 128, stdout: '', stderr: 'fatal: ambiguous argument' }
          : { exitCode: 0, stdout: 'Preparing worktree', stderr: '' },
    });

    await expect(port.create({ cwd: '/repo', worktreeDir: '/repo/wt', ref: 'HEAD' })).resolves.toEqual({
      status: 'failed',
      worktreeDir: '/repo/wt',
      message: 'fatal: ambiguous argument',
      sideEffects: [],
    });
  });

  it('reports git worktree failures without claiming a side effect', async () => {
    const port = createGitWorktreePort({
      run: async () => ({ exitCode: 128, stdout: '', stderr: 'fatal: not a git repository' }),
    });

    await expect(
      port.create({ cwd: '/not-git', worktreeDir: '/not-git/.brunch/cook/runs/run-1/worktree', ref: 'HEAD' }),
    ).resolves.toEqual({
      status: 'failed',
      worktreeDir: '/not-git/.brunch/cook/runs/run-1/worktree',
      message: 'fatal: not a git repository',
      sideEffects: [],
    });
  });

  it('surfaces the spawn-error message when git cannot be launched', async () => {
    const port = createGitWorktreePort({
      run: async () => ({ exitCode: 1, stdout: '', stderr: '', spawnError: 'spawn git ENOENT' }),
    });

    await expect(port.create({ cwd: '/repo', worktreeDir: '/repo/wt', ref: 'HEAD' })).resolves.toEqual({
      status: 'failed',
      worktreeDir: '/repo/wt',
      message: 'spawn git ENOENT',
      sideEffects: [],
    });
  });

  it('reports aborts as git worktree failures', async () => {
    const port = createGitWorktreePort({
      run: async () => ({ exitCode: 1, stdout: '', stderr: '', aborted: true }),
    });

    await expect(port.create({ cwd: '/repo', worktreeDir: '/repo/wt', ref: 'HEAD' })).resolves.toEqual({
      status: 'failed',
      worktreeDir: '/repo/wt',
      message: 'git worktree add aborted',
      sideEffects: [],
    });
  });

  it('reports timeouts as git worktree failures', async () => {
    const port = createGitWorktreePort({
      run: async () => ({ exitCode: 1, stdout: '', stderr: '', timedOut: true }),
    });

    await expect(port.create({ cwd: '/repo', worktreeDir: '/repo/wt', ref: 'HEAD' })).resolves.toEqual({
      status: 'failed',
      worktreeDir: '/repo/wt',
      message: 'git worktree add timed out after 30000ms',
      sideEffects: [],
    });
  });
});
