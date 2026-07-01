import { describe, expect, it } from 'vitest';

import { createGitLandPort } from '../git-land-port.js';

describe('createGitLandPort', () => {
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

  it('reports no_changes without a recovery sha when clean HEAD is unrelated to promotion', async () => {
    const calls: string[] = [];
    const port = createGitLandPort({
      run: async (_command, args) => {
        calls.push(args.join(' '));
        if (args[0] === 'log') return { exitCode: 0, stdout: 'abc123\u0000some other commit\n', stderr: '' };
        return { exitCode: 0, stdout: '', stderr: '' };
      },
    });

    await expect(port.promote({ worktreeDir: '/repo/wt', message: 'promote' })).resolves.toEqual({
      status: 'no_changes',
      message: 'no worktree changes to promote',
      sideEffects: [],
    });
    expect(calls).toEqual(['status --porcelain', 'log -1 --format=%H%x00%s']);
  });

  it('reports no_changes with a recovery sha when clean HEAD is the promotion commit', async () => {
    const calls: string[] = [];
    const port = createGitLandPort({
      run: async (_command, args) => {
        calls.push(args.join(' '));
        if (args[0] === 'log') return { exitCode: 0, stdout: 'abc123\u0000promote\n', stderr: '' };
        return { exitCode: 0, stdout: '', stderr: '' };
      },
    });

    await expect(port.promote({ worktreeDir: '/repo/wt', message: 'promote' })).resolves.toEqual({
      status: 'no_changes',
      message: 'no worktree changes to promote',
      commitSha: 'abc123',
      sideEffects: [],
    });
    expect(calls).toEqual(['status --porcelain', 'log -1 --format=%H%x00%s']);
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
