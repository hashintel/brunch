import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { describe, expect, it } from 'vitest';

import { createGitLandPort } from '../git-land-port.js';

const execFileAsync = promisify(execFile);

async function git(cwd: string, args: readonly string[]): Promise<string> {
  const result = await execFileAsync('git', [...args], { cwd });
  return result.stdout.trim();
}

describe('createGitLandPort', () => {
  it('reads the current worktree HEAD', async () => {
    const calls: string[] = [];
    const port = createGitLandPort({
      run: async (_command, args) => {
        calls.push(args.join(' '));
        if (args.join(' ') === 'rev-parse --show-toplevel')
          return { exitCode: 0, stdout: '/repo/wt\n', stderr: '' };
        return { exitCode: 0, stdout: 'base123\n', stderr: '' };
      },
    });

    await expect(port.currentHead({ worktreeDir: '/repo/wt' })).resolves.toEqual({
      status: 'ok',
      commitSha: 'base123',
    });
    expect(calls).toEqual(['rev-parse --show-toplevel', 'rev-parse HEAD']);
  });

  it('resolves a durable review branch ref', async () => {
    const port = createGitLandPort({
      run: async (_command, args) => {
        if (args.join(' ') === 'rev-parse --show-toplevel')
          return { exitCode: 0, stdout: '/repo/wt\n', stderr: '' };
        return { exitCode: 0, stdout: 'abc123\n', stderr: '' };
      },
    });

    await expect(port.resolveRef({ worktreeDir: '/repo/wt', ref: 'brunch/review/run-1' })).resolves.toEqual({
      status: 'ok',
      commitSha: 'abc123',
    });
  });

  it('commits run-local worktree changes and reports the commit sha', async () => {
    const calls: Array<{ command: string; args: readonly string[]; cwd: string }> = [];
    const port = createGitLandPort({
      run: async (command, args, options) => {
        calls.push({ command, args, cwd: options.cwd });
        if (args.join(' ') === 'rev-parse --show-toplevel')
          return { exitCode: 0, stdout: '/repo/.brunch/cook/runs/run-1/worktree\n', stderr: '' };
        if (args[0] === 'check-ref-format') return { exitCode: 0, stdout: '', stderr: '' };
        if (args[0] === 'status') return { exitCode: 0, stdout: ' M worker-proof.txt\n', stderr: '' };
        if (args[0] === 'add') return { exitCode: 0, stdout: '', stderr: '' };
        if (args.includes('commit'))
          return { exitCode: 0, stdout: '[detached HEAD abc123] promote\n', stderr: '' };
        if (args.join(' ') === 'rev-parse HEAD') return { exitCode: 0, stdout: 'abc123\n', stderr: '' };
        if (args.join(' ').startsWith('rev-parse --verify')) return { exitCode: 1, stdout: '', stderr: '' };
        if (args[0] === 'update-ref') return { exitCode: 0, stdout: '', stderr: '' };
        return { exitCode: 1, stdout: '', stderr: `unexpected ${args.join(' ')}` };
      },
    });

    const result = await port.promote({
      worktreeDir: '/repo/.brunch/cook/runs/run-1/worktree',
      message: 'promote run-1',
      baseSha: 'base123',
      reviewBranch: 'brunch/review/run-1',
    });

    expect(calls).toEqual([
      {
        command: 'git',
        args: ['rev-parse', '--show-toplevel'],
        cwd: '/repo/.brunch/cook/runs/run-1/worktree',
      },
      {
        command: 'git',
        args: ['check-ref-format', '--branch', 'brunch/review/run-1'],
        cwd: '/repo/.brunch/cook/runs/run-1/worktree',
      },
      {
        command: 'git',
        args: ['status', '--porcelain', '--', '.', ':(exclude).brunch'],
        cwd: '/repo/.brunch/cook/runs/run-1/worktree',
      },
      {
        command: 'git',
        args: ['add', '-A', '--', '.', ':(exclude).brunch'],
        cwd: '/repo/.brunch/cook/runs/run-1/worktree',
      },
      {
        command: 'git',
        args: ['-c', 'user.name=brunch', '-c', 'user.email=cook@brunch', 'commit', '-m', 'promote run-1'],
        cwd: '/repo/.brunch/cook/runs/run-1/worktree',
      },
      { command: 'git', args: ['rev-parse', 'HEAD'], cwd: '/repo/.brunch/cook/runs/run-1/worktree' },
      {
        command: 'git',
        args: ['rev-parse', '--verify', '--quiet', 'refs/heads/brunch/review/run-1'],
        cwd: '/repo/.brunch/cook/runs/run-1/worktree',
      },
      {
        command: 'git',
        args: [
          'update-ref',
          'refs/heads/brunch/review/run-1',
          'abc123',
          '0000000000000000000000000000000000000000',
        ],
        cwd: '/repo/.brunch/cook/runs/run-1/worktree',
      },
    ]);
    expect(result).toEqual({
      status: 'promoted',
      commitSha: 'abc123',
      reviewBranch: 'brunch/review/run-1',
      sideEffects: [
        { kind: 'git_commit', path: '/repo/.brunch/cook/runs/run-1/worktree', sha: 'abc123' },
        {
          kind: 'git_ref_create',
          path: '/repo/.brunch/cook/runs/run-1/worktree',
          ref: 'refs/heads/brunch/review/run-1',
          sha: 'abc123',
        },
      ],
    });
  });

  it('creates the review ref without staging or committing when the worktree is clean', async () => {
    const calls: string[] = [];
    const port = createGitLandPort({
      run: async (_command, args) => {
        calls.push(args.join(' '));
        if (args.join(' ') === 'rev-parse --show-toplevel')
          return { exitCode: 0, stdout: '/repo/wt\n', stderr: '' };
        if (args[0] === 'check-ref-format') return { exitCode: 0, stdout: '', stderr: '' };
        if (args.join(' ') === 'rev-parse HEAD') return { exitCode: 0, stdout: 'abc123\n', stderr: '' };
        if (args.join(' ').startsWith('rev-parse --verify')) {
          return { exitCode: 1, stdout: '', stderr: '' };
        }
        return { exitCode: 0, stdout: '', stderr: '' };
      },
    });

    await expect(
      port.promote({
        worktreeDir: '/repo/wt',
        message: 'promote',
        baseSha: 'abc123',
        reviewBranch: 'brunch/review/run-1',
      }),
    ).resolves.toEqual({
      status: 'promoted',
      commitSha: 'abc123',
      reviewBranch: 'brunch/review/run-1',
      sideEffects: [
        {
          kind: 'git_ref_create',
          path: '/repo/wt',
          ref: 'refs/heads/brunch/review/run-1',
          sha: 'abc123',
        },
      ],
    });
    expect(calls).toEqual([
      'rev-parse --show-toplevel',
      'check-ref-format --branch brunch/review/run-1',
      'status --porcelain -- . :(exclude).brunch',
      'rev-parse HEAD',
      'rev-parse --verify --quiet refs/heads/brunch/review/run-1',
      'update-ref refs/heads/brunch/review/run-1 abc123 0000000000000000000000000000000000000000',
    ]);
  });

  it('refuses to promote when git resolves to a parent repository', async () => {
    const port = createGitLandPort({
      run: async () => ({ exitCode: 0, stdout: '/repo\n', stderr: '' }),
    });

    await expect(
      port.promote({
        worktreeDir: '/repo/.brunch/cook/runs/run-1/worktree',
        message: 'promote',
        baseSha: 'base123',
        reviewBranch: 'brunch/review/run-1',
      }),
    ).resolves.toEqual({
      status: 'failed',
      message: 'refusing to promote from non-isolated worktree: git root is /repo',
      sideEffects: [],
    });
  });

  it('reports git failures without claiming side effects', async () => {
    const port = createGitLandPort({
      run: async (_command, args) =>
        args.join(' ') === 'rev-parse --show-toplevel'
          ? { exitCode: 0, stdout: '/repo/wt\n', stderr: '' }
          : args[0] === 'status'
            ? { exitCode: 0, stdout: ' M file.ts\n', stderr: '' }
            : { exitCode: 128, stdout: '', stderr: 'fatal: cannot commit' },
    });

    await expect(
      port.promote({
        worktreeDir: '/repo/wt',
        message: 'promote',
        baseSha: 'base123',
        reviewBranch: 'brunch/review/run-1',
      }),
    ).resolves.toEqual({
      status: 'failed',
      message: 'fatal: cannot commit',
      sideEffects: [],
    });
  });

  it('excludes .brunch bookkeeping from the promotion commit while rescuing sibling files', async () => {
    const worktreeDir = await mkdtemp(join(tmpdir(), 'brunch-git-land-hygiene-'));
    await git(worktreeDir, ['init', '-b', 'main']);
    await git(worktreeDir, ['config', 'user.name', 'Brunch Test']);
    await git(worktreeDir, ['config', 'user.email', 'brunch@example.test']);
    await writeFile(join(worktreeDir, 'base.txt'), 'base\n', 'utf8');
    await git(worktreeDir, ['add', 'base.txt']);
    await git(worktreeDir, ['commit', '-m', 'base']);
    const baseSha = await git(worktreeDir, ['rev-parse', 'HEAD']);
    await git(worktreeDir, ['checkout', '--detach']);
    await writeFile(join(worktreeDir, 'result.txt'), 'result\n', 'utf8');
    await mkdir(join(worktreeDir, '.brunch', 'cook'), { recursive: true });
    await writeFile(join(worktreeDir, '.brunch', 'cook', 'plan.json'), '{"planted":true}\n', 'utf8');

    const result = await createGitLandPort().promote({
      worktreeDir,
      message: 'promote run-1',
      baseSha,
      reviewBranch: 'brunch/review/run-1',
    });

    if (result.status !== 'promoted') throw new Error(result.message);
    const tree = await git(worktreeDir, ['ls-tree', '-r', '--name-only', result.commitSha]);
    expect(tree).toContain('result.txt');
    expect(tree).not.toContain('.brunch');
    // Bookkeeping survives on disk, uncommitted.
    await expect(readFile(join(worktreeDir, '.brunch', 'cook', 'plan.json'), 'utf8')).resolves.toBe(
      '{"planted":true}\n',
    );
  });

  it('reports no_changes when the only worktree dirt is .brunch bookkeeping', async () => {
    const worktreeDir = await mkdtemp(join(tmpdir(), 'brunch-git-land-brunch-only-'));
    await git(worktreeDir, ['init', '-b', 'main']);
    await git(worktreeDir, ['config', 'user.name', 'Brunch Test']);
    await git(worktreeDir, ['config', 'user.email', 'brunch@example.test']);
    await writeFile(join(worktreeDir, 'base.txt'), 'base\n', 'utf8');
    await git(worktreeDir, ['add', 'base.txt']);
    await git(worktreeDir, ['commit', '-m', 'base']);
    const baseSha = await git(worktreeDir, ['rev-parse', 'HEAD']);
    await git(worktreeDir, ['checkout', '--detach']);
    await mkdir(join(worktreeDir, '.brunch', 'cook'), { recursive: true });
    await writeFile(join(worktreeDir, '.brunch', 'cook', 'plan.json'), '{"planted":true}\n', 'utf8');

    await expect(
      createGitLandPort().promote({
        worktreeDir,
        message: 'promote run-1',
        baseSha,
        reviewBranch: 'brunch/review/run-1',
      }),
    ).resolves.toMatchObject({ status: 'no_changes', commitSha: baseSha, sideEffects: [] });
  });

  it('creates a durable review branch while leaving the run worktree detached', async () => {
    const worktreeDir = await mkdtemp(join(tmpdir(), 'brunch-git-land-review-'));
    await git(worktreeDir, ['init', '-b', 'main']);
    await git(worktreeDir, ['config', 'user.name', 'Brunch Test']);
    await git(worktreeDir, ['config', 'user.email', 'brunch@example.test']);
    await writeFile(join(worktreeDir, 'base.txt'), 'base\n', 'utf8');
    await git(worktreeDir, ['add', 'base.txt']);
    await git(worktreeDir, ['commit', '-m', 'base']);
    const baseSha = await git(worktreeDir, ['rev-parse', 'HEAD']);
    await git(worktreeDir, ['checkout', '--detach']);
    await writeFile(join(worktreeDir, 'result.txt'), 'result\n', 'utf8');

    const result = await createGitLandPort().promote({
      worktreeDir,
      message: 'promote run-1',
      baseSha,
      reviewBranch: 'brunch/review/run-1',
    });

    if (result.status !== 'promoted') throw new Error(result.message);
    expect(result).toMatchObject({
      status: 'promoted',
      reviewBranch: 'brunch/review/run-1',
    });
    await expect(git(worktreeDir, ['rev-parse', 'refs/heads/brunch/review/run-1'])).resolves.toBe(
      result.commitSha,
    );
    await expect(
      execFileAsync('git', ['symbolic-ref', '-q', 'HEAD'], { cwd: worktreeDir }),
    ).rejects.toThrow();
  });
});
