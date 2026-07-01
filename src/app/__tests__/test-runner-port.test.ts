import { describe, expect, it } from 'vitest';

import { createTestRunnerPort } from '../test-runner-port.js';

describe('createTestRunnerPort', () => {
  it('runs the verify command in the worktree and reports a passing verdict', async () => {
    const controller = new AbortController();
    const calls: Array<{
      command: string;
      args: readonly string[];
      cwd: string;
      signal?: AbortSignal | undefined;
      timeoutMs?: number | undefined;
      maxOutputBytes?: number | undefined;
    }> = [];
    const port = createTestRunnerPort({
      run: async (command, args, options) => {
        calls.push({
          command,
          args,
          cwd: options.cwd,
          signal: options.signal,
          timeoutMs: options.timeoutMs,
          maxOutputBytes: options.maxOutputBytes,
        });
        return { exitCode: 0, stdout: 'all good', stderr: '' };
      },
    });

    const result = await port.run({
      worktreeDir: '/repo/.brunch/cook/runs/run-1/worktree',
      signal: controller.signal,
    });

    expect(calls).toEqual([
      {
        command: 'npm',
        args: ['run', 'verify'],
        cwd: '/repo/.brunch/cook/runs/run-1/worktree',
        signal: controller.signal,
        timeoutMs: 10 * 60_000,
        maxOutputBytes: 128 * 1024,
      },
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

    await expect(port.run({ worktreeDir: '/repo/wt' })).resolves.toEqual({
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

    await expect(port.run({ worktreeDir: '/repo/wt' })).resolves.toEqual({
      status: 'failed',
      message: 'spawn npm ENOENT',
    });
  });

  it('reports a runner failure when verify is aborted', async () => {
    const port = createTestRunnerPort({
      run: async () => ({ exitCode: 1, stdout: '', stderr: '', aborted: true }),
    });

    await expect(port.run({ worktreeDir: '/repo/wt' })).resolves.toEqual({
      status: 'failed',
      message: 'npm run verify aborted',
    });
  });

  it('reports a runner failure when verify times out', async () => {
    const port = createTestRunnerPort({
      run: async () => ({ exitCode: 1, stdout: '', stderr: '', timedOut: true }),
    });

    await expect(port.run({ worktreeDir: '/repo/wt' })).resolves.toEqual({
      status: 'failed',
      message: 'npm run verify timed out after 600000ms',
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

    const result = await port.run({ worktreeDir: '/repo/wt' });

    expect(calls).toEqual([{ command: 'pnpm', args: ['test'] }]);
    expect(result).toMatchObject({ status: 'completed', verdict: 'passed', target: 'pnpm test' });
  });
});
