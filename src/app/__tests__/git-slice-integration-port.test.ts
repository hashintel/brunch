import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { describe, expect, it } from 'vitest';

import {
  createFakeGitHostPromotionPort,
  createFakeGitLandPort,
  createFakeGitWorktreePort,
  createFakeTestRunnerPort,
} from '../../executor/__tests__/fake-ports.js';
import type { ExecutionPorts } from '../../executor/execution-ports.js';
import {
  drive,
  frontierFiringPolicy,
  linearScheduler,
  petriScheduler,
  serialFiringPolicy,
} from '../../executor/orchestrate.js';
import { planFilePath } from '../../executor/plan-file.js';
import { createRun } from '../../executor/run.js';
import { sliceWorkspacePath } from '../../executor/slice-workspace.js';
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

  it('never commits .brunch run bookkeeping while committing sibling slice output', async () => {
    const { root, runWorktreeDir } = await createRunWorkspace('brunch-hygiene-');
    const port = createGitSliceIntegrationPort();
    const sliceDir = join(root, 'slices', 'first');
    const prepared = await port.prepare({ runWorktreeDir, sliceWorktreeDir: sliceDir, sliceId: 'first' });
    if (prepared.status !== 'prepared') throw new Error('workspace setup failed');

    await writeFile(join(sliceDir, 'first.txt'), 'first\n', 'utf8');
    await mkdir(join(sliceDir, '.brunch', 'cook'), { recursive: true });
    await writeFile(join(sliceDir, '.brunch', 'cook', 'plan.json'), '{"planted":true}\n', 'utf8');

    const integration = await port.integrate({
      runWorktreeDir,
      sliceWorktreeDir: sliceDir,
      sliceId: 'first',
      baseSha: prepared.baseSha,
    });

    expect(integration.status).toBe('integrated');
    await expect(readFile(join(runWorktreeDir, 'first.txt'), 'utf8')).resolves.toBe('first\n');
    expect(await git(runWorktreeDir, ['ls-tree', '-r', '--name-only', 'HEAD'])).not.toContain('.brunch');
    // The bookkeeping stays on disk in the slice workspace; it just never enters a commit.
    await expect(readFile(join(sliceDir, '.brunch', 'cook', 'plan.json'), 'utf8')).resolves.toBe(
      '{"planted":true}\n',
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

  it('rejects a foreign repository at the slice path before invoking the agent or mutating it', async () => {
    await mkdir(testScratchRoot, { recursive: true });
    const cwd = await mkdtemp(join(testScratchRoot, 'foreign-'));
    await mkdir(join(cwd, '.brunch', 'cook', 'specs', '42'), { recursive: true });
    await writeFile(
      planFilePath(cwd, '42'),
      JSON.stringify({
        mode: 'greenfield',
        epics: [{ id: 'epic-1', depends_on: [], verification: [] }],
        slices: [{ id: 'task-1', epic_id: 'epic-1', definition: 'task', depends_on: [], verification: [] }],
      }),
      'utf8',
    );
    await createRun({ cwd, specId: '42', runId: 'run-1', substrate: 'empty_dir' });
    const integration = createGitSliceIntegrationPort();
    let agentCalls = 0;
    const ports: ExecutionPorts = {
      gitWorktree: createFakeGitWorktreePort(),
      gitSliceIntegration: integration,
      agentRunner: {
        async run() {
          agentCalls += 1;
          return { status: 'completed' };
        },
      },
      testRunner: createFakeTestRunnerPort(),
      gitLand: createFakeGitLandPort(),
      gitHostPromotion: createFakeGitHostPromotionPort({}),
    };
    await drive({ cwd, runId: 'run-1', ports }, linearScheduler, serialFiringPolicy, { maxFirings: 5 });
    const foreignDir = sliceWorkspacePath(cwd, 'run-1', 'task-1');
    await mkdir(foreignDir, { recursive: true });
    await git(foreignDir, ['init']);
    await writeFile(join(foreignDir, 'foreign.txt'), 'do not touch\n', 'utf8');
    await git(foreignDir, ['add', '.']);
    await git(foreignDir, [...TEST_GIT_AUTHOR, 'commit', '-m', 'foreign base']);
    const foreignHead = await git(foreignDir, ['rev-parse', 'HEAD']);

    await expect(
      drive({ cwd, runId: 'run-1', ports }, petriScheduler, frontierFiringPolicy),
    ).resolves.toMatchObject({
      status: 'halted',
      step: 'slice_execute',
      reason: 'slice_workspace_failed',
    });
    expect(agentCalls).toBe(0);
    expect(await git(foreignDir, ['rev-parse', 'HEAD'])).toBe(foreignHead);
    await expect(readFile(join(foreignDir, 'foreign.txt'), 'utf8')).resolves.toBe('do not touch\n');
    expect(await git(foreignDir, ['status', '--porcelain'])).toBe('');
  });
});
