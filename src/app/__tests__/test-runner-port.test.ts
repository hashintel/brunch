import { describe, expect, it } from 'vitest';

import { createTestRunnerPort } from '../test-runner-port.js';

describe('createTestRunnerPort', () => {
  it('runs the verify command in the worktree and reports a passing verdict', async () => {
    const calls: Array<{ command: string; args: readonly string[]; cwd: string }> = [];
    const port = createTestRunnerPort({
      run: async (command, args, options) => {
        calls.push({ command, args, cwd: options.cwd });
        return { exitCode: 0, stdout: 'all good', stderr: '' };
      },
    });

    const result = await port.run({ cwd: '/repo', worktreeDir: '/repo/.brunch/cook/runs/run-1/worktree' });

    expect(calls).toEqual([
      { command: 'npm', args: ['run', 'verify'], cwd: '/repo/.brunch/cook/runs/run-1/worktree' },
    ]);
    expect(result).toEqual({
      status: 'completed',
      verdict: 'passed',
      exitCode: 0,
      target: 'npm run verify',
    });
  });

  it('reports a failing verdict when the verify command exits non-zero', async () => {
    const port = createTestRunnerPort({
      run: async () => ({ exitCode: 1, stdout: '', stderr: '2 tests failed' }),
    });

    await expect(port.run({ cwd: '/repo', worktreeDir: '/repo/wt' })).resolves.toEqual({
      status: 'completed',
      verdict: 'failed',
      exitCode: 1,
      target: 'npm run verify',
    });
  });

  it('reports a runner failure when the command cannot be spawned', async () => {
    const port = createTestRunnerPort({
      run: async () => ({ exitCode: 1, stdout: '', stderr: '', spawnError: 'spawn npm ENOENT' }),
    });

    await expect(port.run({ cwd: '/repo', worktreeDir: '/repo/wt' })).resolves.toEqual({
      status: 'failed',
      message: 'spawn npm ENOENT',
    });
  });

  it('honors a custom verify command and args', async () => {
    const calls: Array<{ command: string; args: readonly string[] }> = [];
    const port = createTestRunnerPort({
      command: 'pnpm',
      args: ['test'],
      run: async (command, args) => {
        calls.push({ command, args });
        return { exitCode: 0, stdout: '', stderr: '' };
      },
    });

    const result = await port.run({ cwd: '/repo', worktreeDir: '/repo/wt' });

    expect(calls).toEqual([{ command: 'pnpm', args: ['test'] }]);
    expect(result).toMatchObject({ status: 'completed', verdict: 'passed', target: 'pnpm test' });
  });
});
