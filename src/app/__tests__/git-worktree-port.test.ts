import { describe, expect, it } from 'vitest';

import { createGitWorktreePort } from '../git-worktree-port.js';

describe('createGitWorktreePort', () => {
  it('shells out to git worktree add for the requested run workspace', async () => {
    const calls: Array<{ command: string; args: readonly string[]; cwd: string }> = [];
    const port = createGitWorktreePort({
      run: async (command, args, options) => {
        calls.push({ command, args, cwd: options.cwd });
        return { exitCode: 0, stdout: 'Preparing worktree', stderr: '' };
      },
    });

    const result = await port.create({
      cwd: '/repo',
      worktreeDir: '/repo/.brunch/cook/runs/run-1/worktree',
      ref: 'HEAD',
    });

    expect(calls).toEqual([
      {
        command: 'git',
        args: ['worktree', 'add', '--detach', '/repo/.brunch/cook/runs/run-1/worktree', 'HEAD'],
        cwd: '/repo',
      },
    ]);
    expect(result).toEqual({
      status: 'created',
      worktreeDir: '/repo/.brunch/cook/runs/run-1/worktree',
      sideEffects: [
        { kind: 'git_worktree_add', path: '/repo/.brunch/cook/runs/run-1/worktree', ref: 'HEAD' },
      ],
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
});
