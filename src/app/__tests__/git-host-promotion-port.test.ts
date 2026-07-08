import { execFile } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { describe, expect, it } from 'vitest';

import { createGitHostPromotionPort } from '../git-host-promotion-port.js';

const execFileAsync = promisify(execFile);

async function git(cwd: string, args: readonly string[]): Promise<string> {
  const result = await execFileAsync('git', [...args], { cwd });
  return result.stdout.trim();
}

async function createHostAndRunRepos(prefix: string): Promise<{
  readonly root: string;
  readonly hostDir: string;
  readonly worktreeDir: string;
  readonly baseSha: string;
  readonly commitSha: string;
}> {
  const root = await mkdtemp(join(tmpdir(), prefix));
  const hostDir = join(root, 'host');
  const worktreeDir = join(root, 'worktree');
  await git(root, ['init', hostDir]);
  await git(root, ['clone', hostDir, worktreeDir]);

  for (const dir of [hostDir, worktreeDir]) {
    await git(dir, ['config', 'user.name', 'Brunch Test']);
    await git(dir, ['config', 'user.email', 'brunch@example.test']);
  }

  await writeFile(join(hostDir, 'host-proof.txt'), 'host content\n', 'utf8');
  await git(hostDir, ['add', 'host-proof.txt']);
  await git(hostDir, ['commit', '-m', 'host base']);

  await git(worktreeDir, ['pull', '--ff-only']);
  const baseSha = await git(worktreeDir, ['rev-parse', 'HEAD']);
  await writeFile(join(worktreeDir, 'host-proof.txt'), 'promoted content\n', 'utf8');
  await git(worktreeDir, ['add', 'host-proof.txt']);
  await git(worktreeDir, ['commit', '-m', 'promote run']);
  const commitSha = await git(worktreeDir, ['rev-parse', 'HEAD']);

  return { root, hostDir, worktreeDir, baseSha, commitSha };
}

describe('createGitHostPromotionPort', () => {
  it('computes the promoted commit diff from the run worktree without touching the host cwd', async () => {
    const calls: Array<{ command: string; args: readonly string[]; cwd: string }> = [];
    const port = createGitHostPromotionPort({
      run: async (command, args, options) => {
        calls.push({ command, args, cwd: options.cwd });
        if (args.join(' ') === 'rev-parse --show-toplevel')
          return { exitCode: 0, stdout: '/repo/.brunch/cook/runs/run-1/worktree\n', stderr: '' };
        if (args.join(' ') === 'cat-file -e commit123^{commit}')
          return { exitCode: 0, stdout: '', stderr: '' };
        if (args.join(' ') === 'rev-parse commit123^')
          return { exitCode: 0, stdout: 'base123\n', stderr: '' };
        if (args.join(' ') === 'diff --name-only base123 commit123') {
          return { exitCode: 0, stdout: 'worker-proof.txt\nsrc/changed.ts\n', stderr: '' };
        }
        if (args.join(' ') === 'diff --stat --summary base123 commit123') {
          return { exitCode: 0, stdout: ' worker-proof.txt | 1 +\n src/changed.ts | 2 ++\n', stderr: '' };
        }
        return { exitCode: 1, stdout: '', stderr: `unexpected ${args.join(' ')}` };
      },
    });

    const result = await port.preflight({
      cwd: '/repo',
      worktreeDir: '/repo/.brunch/cook/runs/run-1/worktree',
      commitSha: 'commit123',
    });

    expect(calls).toEqual([
      {
        command: 'git',
        args: ['rev-parse', '--show-toplevel'],
        cwd: '/repo/.brunch/cook/runs/run-1/worktree',
      },
      {
        command: 'git',
        args: ['cat-file', '-e', 'commit123^{commit}'],
        cwd: '/repo/.brunch/cook/runs/run-1/worktree',
      },
      { command: 'git', args: ['rev-parse', 'commit123^'], cwd: '/repo/.brunch/cook/runs/run-1/worktree' },
      {
        command: 'git',
        args: ['diff', '--name-only', 'base123', 'commit123'],
        cwd: '/repo/.brunch/cook/runs/run-1/worktree',
      },
      {
        command: 'git',
        args: ['diff', '--stat', '--summary', 'base123', 'commit123'],
        cwd: '/repo/.brunch/cook/runs/run-1/worktree',
      },
    ]);
    expect(calls.map((call) => call.cwd)).not.toContain('/repo');
    expect(result).toEqual({
      status: 'ok',
      baseSha: 'base123',
      commitSha: 'commit123',
      changedFiles: ['worker-proof.txt', 'src/changed.ts'],
      patchSummary: 'worker-proof.txt | 1 +\nsrc/changed.ts | 2 ++',
    });
  });

  it('fails closed when the promoted commit cannot be resolved', async () => {
    const port = createGitHostPromotionPort({
      run: async (_command, args) =>
        args.join(' ') === 'rev-parse --show-toplevel'
          ? { exitCode: 0, stdout: '/repo/.brunch/cook/runs/run-1/worktree\n', stderr: '' }
          : { exitCode: 128, stdout: '', stderr: 'fatal: Not a valid object name commit123' },
    });

    await expect(
      port.preflight({
        cwd: '/repo',
        worktreeDir: '/repo/.brunch/cook/runs/run-1/worktree',
        commitSha: 'commit123',
      }),
    ).resolves.toEqual({
      status: 'failed',
      message: 'fatal: Not a valid object name commit123',
    });
  });

  it('checks and applies the promoted patch to the host cwd without staging or committing', async () => {
    const calls: Array<{ command: string; args: readonly string[]; cwd: string; stdin: string | undefined }> =
      [];
    const port = createGitHostPromotionPort({
      run: async (command, args, options) => {
        calls.push({ command, args, cwd: options.cwd, stdin: options.stdin });
        if (args.join(' ') === 'rev-parse --show-toplevel')
          return { exitCode: 0, stdout: '/repo/.brunch/cook/runs/run-1/worktree\n', stderr: '' };
        if (args.join(' ') === 'diff --no-ext-diff --binary base123 commit123') {
          return { exitCode: 0, stdout: 'diff --git a/host-proof.txt b/host-proof.txt\n', stderr: '' };
        }
        if (args.join(' ') === 'apply --check -') return { exitCode: 0, stdout: '', stderr: '' };
        if (args.join(' ') === 'apply -') return { exitCode: 0, stdout: '', stderr: '' };
        return { exitCode: 1, stdout: '', stderr: `unexpected ${args.join(' ')}` };
      },
    });

    await expect(
      port.apply({
        cwd: '/repo',
        worktreeDir: '/repo/.brunch/cook/runs/run-1/worktree',
        baseSha: 'base123',
        commitSha: 'commit123',
        changedFiles: ['host-proof.txt'],
      }),
    ).resolves.toEqual({ status: 'applied', changedFiles: ['host-proof.txt'] });
    expect(calls).toEqual([
      {
        command: 'git',
        args: ['rev-parse', '--show-toplevel'],
        cwd: '/repo/.brunch/cook/runs/run-1/worktree',
        stdin: undefined,
      },
      {
        command: 'git',
        args: ['diff', '--no-ext-diff', '--binary', 'base123', 'commit123'],
        cwd: '/repo/.brunch/cook/runs/run-1/worktree',
        stdin: undefined,
      },
      {
        command: 'git',
        args: ['apply', '--check', '-'],
        cwd: '/repo',
        stdin: 'diff --git a/host-proof.txt b/host-proof.txt\n',
      },
      {
        command: 'git',
        args: ['apply', '-'],
        cwd: '/repo',
        stdin: 'diff --git a/host-proof.txt b/host-proof.txt\n',
      },
    ]);
  });

  it('does not apply when the patch check fails', async () => {
    const calls: string[] = [];
    const port = createGitHostPromotionPort({
      run: async (_command, args) => {
        calls.push(args.join(' '));
        if (args.join(' ') === 'rev-parse --show-toplevel')
          return { exitCode: 0, stdout: '/repo/.brunch/cook/runs/run-1/worktree\n', stderr: '' };
        if (args[0] === 'diff') return { exitCode: 0, stdout: 'patch', stderr: '' };
        return { exitCode: 1, stdout: '', stderr: 'patch failed' };
      },
    });

    await expect(
      port.apply({
        cwd: '/repo',
        worktreeDir: '/repo/.brunch/cook/runs/run-1/worktree',
        baseSha: 'base123',
        commitSha: 'commit123',
        changedFiles: ['host-proof.txt'],
      }),
    ).resolves.toEqual({ status: 'failed', message: 'patch failed' });
    expect(calls).toEqual([
      'rev-parse --show-toplevel',
      'diff --no-ext-diff --binary base123 commit123',
      'apply --check -',
    ]);
  });

  it('refuses preflight when git resolves the run worktree to the host repository', async () => {
    const port = createGitHostPromotionPort({
      run: async () => ({ exitCode: 0, stdout: '/repo\n', stderr: '' }),
    });

    await expect(
      port.preflight({
        cwd: '/repo',
        worktreeDir: '/repo/.brunch/cook/runs/run-1/worktree',
        commitSha: 'commit123',
      }),
    ).resolves.toEqual({
      status: 'failed',
      message: 'refusing host promotion from non-isolated worktree: git root is /repo',
    });
  });

  it('applies a real promoted git patch to host files without staging or committing', async () => {
    const { hostDir, worktreeDir, baseSha, commitSha } = await createHostAndRunRepos(
      'brunch-host-promotion-real-apply-',
    );
    const beforeHead = await git(hostDir, ['rev-parse', 'HEAD']);

    const result = await createGitHostPromotionPort().apply({
      cwd: hostDir,
      worktreeDir,
      baseSha,
      commitSha,
      changedFiles: ['host-proof.txt'],
    });

    expect(result).toEqual({ status: 'applied', changedFiles: ['host-proof.txt'] });
    expect(await readFile(join(hostDir, 'host-proof.txt'), 'utf8')).toBe('promoted content\n');
    expect(await git(hostDir, ['rev-parse', 'HEAD'])).toBe(beforeHead);
    expect(await git(hostDir, ['diff', '--cached', '--name-only'])).toBe('');
    expect(await git(hostDir, ['status', '--short'])).toBe('M host-proof.txt');
  });

  it('fails real patch check without mutating conflicting host files', async () => {
    const { hostDir, worktreeDir, baseSha, commitSha } = await createHostAndRunRepos(
      'brunch-host-promotion-real-conflict-',
    );
    await writeFile(join(hostDir, 'host-proof.txt'), 'conflicting host edit\n', 'utf8');
    const beforeHostFile = await readFile(join(hostDir, 'host-proof.txt'), 'utf8');
    const beforeHead = await git(hostDir, ['rev-parse', 'HEAD']);

    const result = await createGitHostPromotionPort().apply({
      cwd: hostDir,
      worktreeDir,
      baseSha,
      commitSha,
      changedFiles: ['host-proof.txt'],
    });

    expect(result).toMatchObject({ status: 'failed' });
    expect(await readFile(join(hostDir, 'host-proof.txt'), 'utf8')).toBe(beforeHostFile);
    expect(await git(hostDir, ['rev-parse', 'HEAD'])).toBe(beforeHead);
    expect(await git(hostDir, ['diff', '--cached', '--name-only'])).toBe('');
  });
});
