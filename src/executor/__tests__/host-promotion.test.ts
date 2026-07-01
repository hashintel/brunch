import { execFile } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { describe, expect, it } from 'vitest';

import { applyHostPromotion, preflightHostPromotion } from '../host-promotion.js';
import { promotionReportPath } from '../promotion.js';
import { reportsPath } from '../report.js';
import { runDirPath, runMetadataPath, type RunMetadata } from '../run.js';

const execFileAsync = promisify(execFile);

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function createPromotedRun(cwd: string, metadata: Partial<RunMetadata> = {}): Promise<void> {
  const runDir = runDirPath(cwd, 'run-1');
  const worktreeDir = join(runDir, 'worktree');
  await mkdir(join(runDir, 'promotion'), { recursive: true });
  await mkdir(worktreeDir, { recursive: true });
  const promotionPath = promotionReportPath(cwd, 'run-1');
  await writeFile(
    runMetadataPath(cwd, 'run-1'),
    `${JSON.stringify(
      {
        runId: 'run-1',
        specId: '42',
        planPath: '/tmp/plan.yaml',
        status: 'promotion_prepared',
        reportsPath: reportsPath(cwd, 'run-1'),
        worktreeDir,
        promotionPath,
        promotionCommitSha: 'commit123',
        ...metadata,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  await writeFile(
    promotionPath,
    `${JSON.stringify({ runId: 'run-1', land: { status: 'promoted', commitSha: 'commit123' } }, null, 2)}\n`,
    'utf8',
  );
}

async function git(cwd: string, args: readonly string[]): Promise<string> {
  const result = await execFileAsync('git', [...args], { cwd });
  return result.stdout.trim();
}

describe('preflightHostPromotion', () => {
  it('reports a missing run without side effects', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-host-promotion-missing-'));

    const result = await preflightHostPromotion({
      cwd,
      runId: 'run-1',
      gitHostPromotion: {
        preflight: async () => {
          throw new Error('must not inspect git for a missing run');
        },
      },
    });

    expect(result).toEqual({
      status: 'missing_run',
      runStatus: 'not_started',
      runId: 'run-1',
      metadataPath: runMetadataPath(cwd, 'run-1'),
      sideEffects: [],
    });
    expect(await pathExists(promotionReportPath(cwd, 'run-1'))).toBe(false);
  });

  it('reports an unpromoted run without reading promotion artifacts', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-host-promotion-unpromoted-'));
    await mkdir(runDirPath(cwd, 'run-1'), { recursive: true });
    await writeFile(
      runMetadataPath(cwd, 'run-1'),
      JSON.stringify({ runId: 'run-1', specId: '42', planPath: '/tmp/plan.yaml', status: 'petri_exported' }),
      'utf8',
    );

    const result = await preflightHostPromotion({
      cwd,
      runId: 'run-1',
      gitHostPromotion: {
        preflight: async () => {
          throw new Error('must not inspect git for an unpromoted run');
        },
      },
    });

    expect(result).toEqual({
      status: 'run_not_promoted',
      runStatus: 'petri_exported',
      runId: 'run-1',
      metadataPath: runMetadataPath(cwd, 'run-1'),
      sideEffects: [],
    });
  });

  it('rejects stale promotion metadata before reporting a host diff', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-host-promotion-stale-'));
    await createPromotedRun(cwd, { promotionCommitSha: 'stale123' });
    const beforeMetadata = await readFile(runMetadataPath(cwd, 'run-1'), 'utf8');

    const result = await preflightHostPromotion({
      cwd,
      runId: 'run-1',
      gitHostPromotion: {
        preflight: async () => {
          throw new Error('must not inspect git for stale promotion metadata');
        },
      },
    });

    expect(result).toEqual({
      status: 'promotion_not_found',
      runStatus: 'promotion_prepared',
      runId: 'run-1',
      metadataPath: runMetadataPath(cwd, 'run-1'),
      promotionPath: promotionReportPath(cwd, 'run-1'),
      message: 'run metadata promotionCommitSha does not match promotion report land commitSha',
      sideEffects: [],
    });
    expect(await readFile(runMetadataPath(cwd, 'run-1'), 'utf8')).toBe(beforeMetadata);
  });

  it('reports the promoted diff without mutating host files or run metadata', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-host-promotion-ready-'));
    await createPromotedRun(cwd);
    await writeFile(join(cwd, 'host-proof.txt'), 'host content\n', 'utf8');
    await git(cwd, ['init']);
    await git(cwd, ['config', 'user.name', 'Brunch Test']);
    await git(cwd, ['config', 'user.email', 'brunch@example.test']);
    await git(cwd, ['add', 'host-proof.txt']);
    await git(cwd, ['commit', '-m', 'host base']);
    const beforeHostFile = await readFile(join(cwd, 'host-proof.txt'), 'utf8');
    const beforeHostStatus = await git(cwd, ['status', '--short']);
    const beforeMetadata = await readFile(runMetadataPath(cwd, 'run-1'), 'utf8');
    const calls: unknown[] = [];

    const result = await preflightHostPromotion({
      cwd,
      runId: 'run-1',
      gitHostPromotion: {
        preflight: async (args) => {
          calls.push(args);
          return {
            status: 'ok',
            baseSha: 'base123',
            commitSha: 'commit123',
            changedFiles: ['worker-proof.txt'],
            patchSummary: 'worker-proof.txt | 1 +',
          };
        },
      },
    });

    expect(calls).toEqual([
      {
        cwd,
        worktreeDir: join(runDirPath(cwd, 'run-1'), 'worktree'),
        commitSha: 'commit123',
      },
    ]);
    expect(result).toEqual({
      status: 'preflight_ready',
      runStatus: 'promotion_prepared',
      runId: 'run-1',
      metadataPath: runMetadataPath(cwd, 'run-1'),
      promotionPath: promotionReportPath(cwd, 'run-1'),
      worktreeDir: join(runDirPath(cwd, 'run-1'), 'worktree'),
      baseSha: 'base123',
      promotionCommitSha: 'commit123',
      changedFiles: ['worker-proof.txt'],
      patchSummary: 'worker-proof.txt | 1 +',
      sideEffects: [],
    });
    expect(await readFile(join(cwd, 'host-proof.txt'), 'utf8')).toBe(beforeHostFile);
    expect(await git(cwd, ['status', '--short'])).toBe(beforeHostStatus);
    expect(await readFile(runMetadataPath(cwd, 'run-1'), 'utf8')).toBe(beforeMetadata);
  });
});

describe('applyHostPromotion', () => {
  it('requires explicit commit acceptance before host mutation', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-host-apply-needs-acceptance-'));
    await createPromotedRun(cwd);

    const result = await applyHostPromotion({
      cwd,
      runId: 'run-1',
      gitHostPromotion: {
        preflight: async () => {
          throw new Error('must not preflight before explicit acceptance');
        },
        apply: async () => {
          throw new Error('must not mutate without explicit acceptance');
        },
      },
    });

    expect(result).toEqual({
      status: 'needs_acceptance',
      runId: 'run-1',
      acceptedCommitSha: undefined,
      sideEffects: [],
    });
  });

  it('refuses a stale accepted commit after rerunning preflight', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-host-apply-stale-'));
    await createPromotedRun(cwd);
    await writeFile(join(cwd, 'host-proof.txt'), 'host content\n', 'utf8');
    await git(cwd, ['init']);
    await git(cwd, ['config', 'user.name', 'Brunch Test']);
    await git(cwd, ['config', 'user.email', 'brunch@example.test']);
    await git(cwd, ['add', 'host-proof.txt']);
    await git(cwd, ['commit', '-m', 'host base']);
    const beforeHostFile = await readFile(join(cwd, 'host-proof.txt'), 'utf8');
    const beforeHostStatus = await git(cwd, ['status', '--short']);

    const result = await applyHostPromotion({
      cwd,
      runId: 'run-1',
      acceptedCommitSha: 'stale123',
      gitHostPromotion: {
        preflight: async () => ({
          status: 'ok',
          baseSha: 'base123',
          commitSha: 'commit123',
          changedFiles: ['host-proof.txt'],
          patchSummary: 'host-proof.txt | 1 +',
        }),
        apply: async () => {
          throw new Error('must not mutate for stale acceptance');
        },
      },
    });

    expect(result).toEqual({
      status: 'acceptance_mismatch',
      runId: 'run-1',
      acceptedCommitSha: 'stale123',
      promotionCommitSha: 'commit123',
      sideEffects: [],
    });
    expect(await readFile(join(cwd, 'host-proof.txt'), 'utf8')).toBe(beforeHostFile);
    expect(await git(cwd, ['status', '--short'])).toBe(beforeHostStatus);
  });

  it('fails closed when patch check/apply fails before writing host files', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-host-apply-conflict-'));
    await createPromotedRun(cwd);
    await writeFile(join(cwd, 'host-proof.txt'), 'host content\n', 'utf8');
    await git(cwd, ['init']);
    await git(cwd, ['config', 'user.name', 'Brunch Test']);
    await git(cwd, ['config', 'user.email', 'brunch@example.test']);
    await git(cwd, ['add', 'host-proof.txt']);
    await git(cwd, ['commit', '-m', 'host base']);
    const beforeHostFile = await readFile(join(cwd, 'host-proof.txt'), 'utf8');
    const beforeHostStatus = await git(cwd, ['status', '--short']);

    const result = await applyHostPromotion({
      cwd,
      runId: 'run-1',
      acceptedCommitSha: 'commit123',
      gitHostPromotion: {
        preflight: async () => ({
          status: 'ok',
          baseSha: 'base123',
          commitSha: 'commit123',
          changedFiles: ['host-proof.txt'],
          patchSummary: 'host-proof.txt | 1 +',
        }),
        apply: async () => ({ status: 'failed', message: 'patch does not apply' }),
      },
    });

    expect(result).toEqual({
      status: 'apply_failed',
      runStatus: 'promotion_prepared',
      runId: 'run-1',
      promotionCommitSha: 'commit123',
      message: 'patch does not apply',
      sideEffects: [],
    });
    expect(await readFile(join(cwd, 'host-proof.txt'), 'utf8')).toBe(beforeHostFile);
    expect(await git(cwd, ['status', '--short'])).toBe(beforeHostStatus);
  });

  it('applies accepted promoted changes to host files without committing or staging', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-host-apply-ready-'));
    await createPromotedRun(cwd);
    await writeFile(join(cwd, 'host-proof.txt'), 'host content\n', 'utf8');
    await git(cwd, ['init']);
    await git(cwd, ['config', 'user.name', 'Brunch Test']);
    await git(cwd, ['config', 'user.email', 'brunch@example.test']);
    await git(cwd, ['add', 'host-proof.txt']);
    await git(cwd, ['commit', '-m', 'host base']);
    const beforeHead = await git(cwd, ['rev-parse', 'HEAD']);

    const result = await applyHostPromotion({
      cwd,
      runId: 'run-1',
      acceptedCommitSha: 'commit123',
      gitHostPromotion: {
        preflight: async () => ({
          status: 'ok',
          baseSha: 'base123',
          commitSha: 'commit123',
          changedFiles: ['host-proof.txt'],
          patchSummary: 'host-proof.txt | 1 +',
        }),
        apply: async () => {
          await writeFile(join(cwd, 'host-proof.txt'), 'promoted content\n', 'utf8');
          return { status: 'applied', changedFiles: ['host-proof.txt'] };
        },
      },
    });

    expect(result).toEqual({
      status: 'applied',
      runStatus: 'promotion_prepared',
      runId: 'run-1',
      promotionCommitSha: 'commit123',
      changedFiles: ['host-proof.txt'],
      sideEffects: [{ kind: 'host_worktree_apply', path: cwd, changedFiles: ['host-proof.txt'] }],
    });
    expect(await readFile(join(cwd, 'host-proof.txt'), 'utf8')).toBe('promoted content\n');
    expect(await git(cwd, ['rev-parse', 'HEAD'])).toBe(beforeHead);
    expect(await git(cwd, ['diff', '--cached', '--name-only'])).toBe('');
    expect(await git(cwd, ['status', '--short'])).toBe('M host-proof.txt\n?? .brunch/');
  });
});
