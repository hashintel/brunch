import { describe, expect, it } from 'vitest';

import { createGitLandPort } from '../git-land-port.js';

describe('createGitLandPort', () => {
  it('reads the current worktree HEAD', async () => {
    const calls: string[] = [];
    const port = createGitLandPort({
      run: async (_command, args) => {
        calls.push(args.join(' '));
        return { exitCode: 0, stdout: 'base123\n', stderr: '' };
      },
    });

    await expect(port.currentHead({ worktreeDir: '/repo/wt' })).resolves.toEqual({
      status: 'ok',
      commitSha: 'base123',
    });
    expect(calls).toEqual(['rev-parse HEAD']);
  });

  it('commits run-local worktree changes and reports the commit sha', async () => {
    const calls: Array<{ command: string; args: readonly string[]; cwd: string }> = [];
    const port = createGitLandPort({
      run: async (command, args, options) => {
        calls.push({ command, args, cwd: options.cwd });
        if (args[0] === 'status') return { exitCode: 0, stdout: ' M worker-proof.txt\n', stderr: '' };
        if (args[0] === 'add') return { exitCode: 0, stdout: '', stderr: '' };
        if (args[0] === 'commit')
          return { exitCode: 0, stdout: '[detached HEAD abc123] promote\n', stderr: '' };
        if (args[0] === 'rev-parse') return { exitCode: 0, stdout: 'abc123\n', stderr: '' };
        return { exitCode: 1, stdout: '', stderr: `unexpected ${args.join(' ')}` };
      },
    });

    const result = await port.promote({
      worktreeDir: '/repo/.brunch/cook/runs/run-1/worktree',
      message: 'promote run-1',
    });

    expect(calls).toEqual([
      { command: 'git', args: ['status', '--porcelain'], cwd: '/repo/.brunch/cook/runs/run-1/worktree' },
      { command: 'git', args: ['add', '-A'], cwd: '/repo/.brunch/cook/runs/run-1/worktree' },
      {
        command: 'git',
        args: ['commit', '-m', 'promote run-1'],
        cwd: '/repo/.brunch/cook/runs/run-1/worktree',
      },
      { command: 'git', args: ['rev-parse', 'HEAD'], cwd: '/repo/.brunch/cook/runs/run-1/worktree' },
    ]);
    expect(result).toEqual({
      status: 'promoted',
      commitSha: 'abc123',
      sideEffects: [{ kind: 'git_commit', path: '/repo/.brunch/cook/runs/run-1/worktree', sha: 'abc123' }],
    });
  });

  it('reports no_changes with current HEAD without staging or committing when the worktree is clean', async () => {
    const calls: string[] = [];
    const port = createGitLandPort({
      run: async (_command, args) => {
        calls.push(args.join(' '));
        if (args[0] === 'rev-parse') return { exitCode: 0, stdout: 'abc123\n', stderr: '' };
        return { exitCode: 0, stdout: '', stderr: '' };
      },
    });

    await expect(port.promote({ worktreeDir: '/repo/wt', message: 'promote' })).resolves.toEqual({
      status: 'no_changes',
      message: 'no worktree changes to promote',
      commitSha: 'abc123',
      sideEffects: [],
    });
    expect(calls).toEqual(['status --porcelain', 'rev-parse HEAD']);
  });

  it('reports git failures without claiming side effects', async () => {
    const port = createGitLandPort({
      run: async (_command, args) =>
        args[0] === 'status'
          ? { exitCode: 0, stdout: ' M file.ts\n', stderr: '' }
          : { exitCode: 128, stdout: '', stderr: 'fatal: cannot commit' },
    });

    await expect(port.promote({ worktreeDir: '/repo/wt', message: 'promote' })).resolves.toEqual({
      status: 'failed',
      message: 'fatal: cannot commit',
      sideEffects: [],
    });
  });
});
