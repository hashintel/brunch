import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { GitHostLandPort } from '../execution-ports.js';
import { applyLanding, preflightLanding } from '../landing.js';
import { promotionReportPath } from '../promotion.js';
import { withRunExecutionAuthority } from '../run-execution-authority.js';
import { runDirPath, runMetadataPath } from '../run.js';
import { createFakeGitHostLandPort } from './fake-ports.js';

const TIP = 'tip456';
const REVIEW_BRANCH = 'brunch/review/run-1';

async function createPromotionPreparedRun(
  cwd: string,
  overrides: Record<string, unknown> = {},
): Promise<void> {
  const runDir = runDirPath(cwd, 'run-1');
  const promotionPath = promotionReportPath(cwd, 'run-1');
  await mkdir(dirname(promotionPath), { recursive: true });
  await mkdir(join(runDir, 'worktree'), { recursive: true });
  await writeFile(
    runMetadataPath(cwd, 'run-1'),
    JSON.stringify({
      runId: 'run-1',
      specId: '42',
      planPath: '/tmp/plan.json',
      status: 'promotion_prepared',
      worktreeDir: join(runDir, 'worktree'),
      runBaseSha: 'base123',
      promotionPath,
      promotionCommitSha: TIP,
      promotionBranch: REVIEW_BRANCH,
      ...overrides,
    }),
    'utf8',
  );
  await writeFile(
    promotionPath,
    JSON.stringify({
      runId: 'run-1',
      specId: '42',
      promotion: { status: 'promoted', commitSha: TIP, reviewBranch: REVIEW_BRANCH },
    }),
    'utf8',
  );
}

function trackingPort(calls: { integrate: unknown[]; materialize: unknown[] }): GitHostLandPort {
  return createFakeGitHostLandPort({
    async integrate(args) {
      calls.integrate.push(args);
      return {
        status: 'landed',
        via: 'fast_forward',
        branch: 'main',
        landedSha: args.expectedTipSha,
        sideEffects: [
          { kind: 'host_branch_advance', path: args.hostDir, branch: 'main', sha: args.expectedTipSha },
        ],
      };
    },
    async materialize(args) {
      calls.materialize.push(args);
      return {
        status: 'landed',
        branch: args.branch,
        landedSha: 'green789',
        targetDir: args.targetDir,
        sideEffects: [
          { kind: 'git_materialize', path: args.targetDir, branch: args.branch, sha: 'green789' },
        ],
      };
    },
  });
}

describe('preflightLanding', () => {
  it('reports a valid promotion_prepared run as ready without side effects', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-landing-preflight-'));
    await createPromotionPreparedRun(cwd);

    await expect(preflightLanding({ cwd, runId: 'run-1' })).resolves.toEqual({
      status: 'preflight_ready',
      runStatus: 'promotion_prepared',
      runId: 'run-1',
      metadataPath: runMetadataPath(cwd, 'run-1'),
      promotionPath: promotionReportPath(cwd, 'run-1'),
      worktreeDir: join(runDirPath(cwd, 'run-1'), 'worktree'),
      substrate: 'git_worktree',
      runBaseSha: 'base123',
      promotionCommitSha: TIP,
      reviewBranch: REVIEW_BRANCH,
      sideEffects: [],
    });
  });

  it('reports the empty_dir substrate for a foreign run repository', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-landing-preflight-empty-'));
    await createPromotionPreparedRun(cwd, { substrate: 'empty_dir' });

    await expect(preflightLanding({ cwd, runId: 'run-1' })).resolves.toMatchObject({
      status: 'preflight_ready',
      substrate: 'empty_dir',
    });
  });

  it('refuses a missing run, an unpromoted run, and metadata-report disagreement without effects', async () => {
    const missingCwd = await mkdtemp(join(tmpdir(), 'brunch-landing-missing-'));
    await expect(preflightLanding({ cwd: missingCwd, runId: 'run-1' })).resolves.toMatchObject({
      status: 'missing_run',
      sideEffects: [],
    });

    const notPromotedCwd = await mkdtemp(join(tmpdir(), 'brunch-landing-not-promoted-'));
    await createPromotionPreparedRun(notPromotedCwd, { status: 'petri_exported' });
    await expect(preflightLanding({ cwd: notPromotedCwd, runId: 'run-1' })).resolves.toMatchObject({
      status: 'run_not_promoted',
      runStatus: 'petri_exported',
      sideEffects: [],
    });

    const staleCwd = await mkdtemp(join(tmpdir(), 'brunch-landing-stale-report-'));
    await createPromotionPreparedRun(staleCwd, { promotionCommitSha: 'other999' });
    await expect(preflightLanding({ cwd: staleCwd, runId: 'run-1' })).resolves.toMatchObject({
      status: 'promotion_not_found',
      sideEffects: [],
    });

    const noBaseCwd = await mkdtemp(join(tmpdir(), 'brunch-landing-no-base-'));
    await createPromotionPreparedRun(noBaseCwd, { runBaseSha: undefined });
    await expect(preflightLanding({ cwd: noBaseCwd, runId: 'run-1' })).resolves.toMatchObject({
      status: 'promotion_not_found',
      message: expect.stringContaining('runBaseSha'),
      sideEffects: [],
    });
  });
});

describe('applyLanding', () => {
  it('refuses standalone landing while the run execution owner is active', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-landing-contended-'));
    await createPromotionPreparedRun(cwd);
    let release!: () => void;
    let entered!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const acquired = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const owner = withRunExecutionAuthority({
      cwd,
      runId: 'run-1',
      execute: async () => {
        entered();
        await held;
      },
    });
    await acquired;
    const calls = { integrate: [] as unknown[], materialize: [] as unknown[] };

    await expect(
      applyLanding({
        cwd,
        runId: 'run-1',
        acceptance: { promotedCommitSha: TIP },
        gitHostLand: trackingPort(calls),
      }),
    ).resolves.toMatchObject({ status: 'run_execution_active', sideEffects: [] });
    expect(calls.integrate).toHaveLength(0);
    release();
    await owner;
  });

  it('refuses stale acceptance without invoking the port', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-landing-stale-acceptance-'));
    await createPromotionPreparedRun(cwd);
    const calls = { integrate: [] as unknown[], materialize: [] as unknown[] };

    await expect(
      applyLanding({
        cwd,
        runId: 'run-1',
        acceptance: { promotedCommitSha: 'accepted-something-else' },
        gitHostLand: trackingPort(calls),
      }),
    ).resolves.toEqual({
      status: 'acceptance_stale',
      runId: 'run-1',
      acceptedCommitSha: 'accepted-something-else',
      promotionCommitSha: TIP,
      sideEffects: [],
    });
    expect(calls.integrate).toHaveLength(0);
    expect(calls.materialize).toHaveLength(0);
    expect(JSON.parse(await readFile(runMetadataPath(cwd, 'run-1'), 'utf8'))).toMatchObject({
      status: 'promotion_prepared',
    });
  });

  it('lands a git_worktree run through integrate and advances metadata exactly once', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-landing-integrate-'));
    await createPromotionPreparedRun(cwd);
    const calls = { integrate: [] as unknown[], materialize: [] as unknown[] };
    const port = trackingPort(calls);

    const result = await applyLanding({
      cwd,
      runId: 'run-1',
      acceptance: { promotedCommitSha: TIP },
      gitHostLand: port,
    });

    expect(calls.integrate).toEqual([
      {
        hostDir: cwd,
        reviewRef: REVIEW_BRANCH,
        expectedTipSha: TIP,
        message: 'brunch: land run-1',
      },
    ]);
    expect(calls.materialize).toHaveLength(0);
    expect(result).toEqual({
      status: 'landed',
      runStatus: 'landed',
      runId: 'run-1',
      via: 'fast_forward',
      landedSha: TIP,
      landedTarget: cwd,
      metadataPath: runMetadataPath(cwd, 'run-1'),
      sideEffects: [
        { kind: 'host_branch_advance', path: cwd, branch: 'main', sha: TIP },
        { kind: 'write_file', path: runMetadataPath(cwd, 'run-1'), ifExists: 'overwrite' },
      ],
    });
    const metadata = JSON.parse(await readFile(runMetadataPath(cwd, 'run-1'), 'utf8')) as Record<
      string,
      unknown
    >;
    expect(metadata).toMatchObject({
      status: 'landed',
      landedSha: TIP,
      landedVia: 'fast_forward',
      landedTarget: cwd,
    });
    expect(typeof metadata.landedAt).toBe('string');

    // Landing is once-only: a second apply replays the recorded landing.
    await expect(
      applyLanding({
        cwd,
        runId: 'run-1',
        acceptance: { promotedCommitSha: TIP },
        gitHostLand: port,
      }),
    ).resolves.toMatchObject({
      status: 'already_landed',
      landedSha: TIP,
      sideEffects: [],
    });
    expect(calls.integrate).toHaveLength(1);
  });

  it('lands an empty_dir run through materialize into the required target', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-landing-materialize-'));
    await createPromotionPreparedRun(cwd, { substrate: 'empty_dir' });
    const calls = { integrate: [] as unknown[], materialize: [] as unknown[] };
    const targetDir = join(cwd, 'new-project');

    const result = await applyLanding({
      cwd,
      runId: 'run-1',
      acceptance: { promotedCommitSha: TIP },
      targetDir,
      gitHostLand: trackingPort(calls),
    });

    expect(calls.integrate).toHaveLength(0);
    expect(calls.materialize).toEqual([
      {
        runWorktreeDir: join(runDirPath(cwd, 'run-1'), 'worktree'),
        reviewRef: REVIEW_BRANCH,
        expectedTipSha: TIP,
        targetDir,
        branch: 'main',
        message: 'brunch: land run-1',
      },
    ]);
    expect(result).toMatchObject({
      status: 'landed',
      via: 'materialized',
      landedSha: 'green789',
      landedTarget: targetDir,
    });
    expect(JSON.parse(await readFile(runMetadataPath(cwd, 'run-1'), 'utf8'))).toMatchObject({
      status: 'landed',
      landedVia: 'materialized',
      landedTarget: targetDir,
    });
  });

  it('requires a target for an empty_dir run without invoking the port', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-landing-target-required-'));
    await createPromotionPreparedRun(cwd, { substrate: 'empty_dir' });
    const calls = { integrate: [] as unknown[], materialize: [] as unknown[] };

    await expect(
      applyLanding({
        cwd,
        runId: 'run-1',
        acceptance: { promotedCommitSha: TIP },
        gitHostLand: trackingPort(calls),
      }),
    ).resolves.toMatchObject({ status: 'target_required', sideEffects: [] });
    expect(calls.materialize).toHaveLength(0);
    expect(JSON.parse(await readFile(runMetadataPath(cwd, 'run-1'), 'utf8'))).toMatchObject({
      status: 'promotion_prepared',
    });
  });

  it.each([
    {
      kind: 'refused',
      port: createFakeGitHostLandPort({
        async integrate() {
          return { status: 'refused', reason: 'dirty', paths: ['base.txt'], sideEffects: [] };
        },
      }),
      expected: { status: 'landing_refused', reason: 'dirty', paths: ['base.txt'] },
    },
    {
      kind: 'conflict',
      port: createFakeGitHostLandPort({
        async integrate() {
          return { status: 'conflict', conflictedPaths: ['src/a.ts'], sideEffects: [] };
        },
      }),
      expected: { status: 'landing_conflict', conflictedPaths: ['src/a.ts'] },
    },
    {
      kind: 'failed',
      port: createFakeGitHostLandPort({
        async integrate() {
          return { status: 'failed', message: 'git merge exploded', sideEffects: [] };
        },
      }),
      expected: { status: 'landing_failed', message: 'git merge exploded' },
    },
  ] as const)('leaves metadata unadvanced when the port reports $kind', async ({ port, expected }) => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-landing-unadvanced-'));
    await createPromotionPreparedRun(cwd);

    await expect(
      applyLanding({ cwd, runId: 'run-1', acceptance: { promotedCommitSha: TIP }, gitHostLand: port }),
    ).resolves.toMatchObject({ ...expected, sideEffects: [] });
    const metadata = JSON.parse(await readFile(runMetadataPath(cwd, 'run-1'), 'utf8')) as Record<
      string,
      unknown
    >;
    expect(metadata.status).toBe('promotion_prepared');
    expect(metadata.landedSha).toBeUndefined();
  });
});
