import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { describe, expect, it } from 'vitest';

import { createGitSliceIntegrationPort } from '../git-slice-integration-port.js';

const execFileAsync = promisify(execFile);
const TEST_GIT_AUTHOR = ['-c', 'user.name=Brunch Test', '-c', 'user.email=brunch@example.test'] as const;
const testScratchRoot = join(process.cwd(), 'tmp', 'git-slice-integration-port');

async function git(cwd: string, args: readonly string[]): Promise<string> {
  const result = await execFileAsync('git', [...args], { cwd });
  return result.stdout.trimEnd();
}

async function createRunWorkspace(prefix: string): Promise<{ root: string; runWorktreeDir: string }> {
  await mkdir(testScratchRoot, { recursive: true });
  const root = await mkdtemp(join(testScratchRoot, prefix));
  const runWorktreeDir = join(root, 'run-worktree');
  await git(root, ['init', runWorktreeDir]);
  await writeFile(join(runWorktreeDir, 'shared.txt'), 'base\n', 'utf8');
  await git(runWorktreeDir, ['add', '.']);
  await git(runWorktreeDir, [...TEST_GIT_AUTHOR, 'commit', '-m', 'run base']);
  return { root, runWorktreeDir };
}

describe('createGitSliceIntegrationPort', () => {
  it('creates stable per-slice workspaces and integrates non-conflicting commits in call order', async () => {
    const { root, runWorktreeDir } = await createRunWorkspace('ordered-');
    const port = createGitSliceIntegrationPort();
    const firstDir = join(root, 'slices', 'first');
    const secondDir = join(root, 'slices', 'second');

    const first = await port.prepare({ runWorktreeDir, sliceWorktreeDir: firstDir, sliceId: 'first' });
    expect(first.status).toBe('prepared');
    await expect(
      port.prepare({ runWorktreeDir, sliceWorktreeDir: firstDir, sliceId: 'first' }),
    ).resolves.toMatchObject({ status: 'prepared', sideEffects: [] });
    await writeFile(join(firstDir, 'first.txt'), 'first\n', 'utf8');
    const firstIntegration = await port.integrate({
      runWorktreeDir,
      sliceWorktreeDir: firstDir,
      sliceId: 'first',
      baseSha: first.status === 'prepared' ? first.baseSha : '',
    });

    const second = await port.prepare({ runWorktreeDir, sliceWorktreeDir: secondDir, sliceId: 'second' });
    expect(second.status).toBe('prepared');
    await writeFile(join(secondDir, 'second.txt'), 'second\n', 'utf8');
    const secondIntegration = await port.integrate({
      runWorktreeDir,
      sliceWorktreeDir: secondDir,
      sliceId: 'second',
      baseSha: second.status === 'prepared' ? second.baseSha : '',
    });

    expect(firstIntegration.status).toBe('integrated');
    expect(secondIntegration.status).toBe('integrated');
    await expect(readFile(join(runWorktreeDir, 'first.txt'), 'utf8')).resolves.toBe('first\n');
    await expect(readFile(join(runWorktreeDir, 'second.txt'), 'utf8')).resolves.toBe('second\n');
    expect(await git(runWorktreeDir, ['log', '--format=%s', '-2'])).toBe(
      'brunch: integrate slice second\nbrunch: integrate slice first',
    );
  });

  it('preflights conflicting slice output without partially mutating the run workspace', async () => {
    const { root, runWorktreeDir } = await createRunWorkspace('conflict-');
    const port = createGitSliceIntegrationPort();
    const firstDir = join(root, 'slices', 'first');
    const secondDir = join(root, 'slices', 'second');
    const first = await port.prepare({ runWorktreeDir, sliceWorktreeDir: firstDir, sliceId: 'first' });
    const second = await port.prepare({ runWorktreeDir, sliceWorktreeDir: secondDir, sliceId: 'second' });
    if (first.status !== 'prepared' || second.status !== 'prepared')
      throw new Error('workspace setup failed');

    await writeFile(join(firstDir, 'shared.txt'), 'first\n', 'utf8');
    await writeFile(join(secondDir, 'shared.txt'), 'second\n', 'utf8');
    await port.integrate({
      runWorktreeDir,
      sliceWorktreeDir: firstDir,
      sliceId: 'first',
      baseSha: first.baseSha,
    });
    const beforeConflictSha = await git(runWorktreeDir, ['rev-parse', 'HEAD']);

    const conflict = await port.integrate({
      runWorktreeDir,
      sliceWorktreeDir: secondDir,
      sliceId: 'second',
      baseSha: second.baseSha,
    });

    expect(conflict).toMatchObject({
      status: 'conflict',
      sideEffects: [{ kind: 'git_commit', path: secondDir }],
    });
    expect(conflict.sideEffects).not.toContainEqual(expect.objectContaining({ kind: 'git_integrate' }));
    await expect(readFile(join(runWorktreeDir, 'shared.txt'), 'utf8')).resolves.toBe('first\n');
    expect(await git(runWorktreeDir, ['rev-parse', 'HEAD'])).toBe(beforeConflictSha);
    expect(await git(runWorktreeDir, ['status', '--porcelain'])).toBe('');
  });
});
