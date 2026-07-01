import { access, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { petriNetPath } from '../petri.js';
import { preparePromotion, promotionReportPath } from '../promotion.js';
import { reportsPath } from '../report.js';
import { runDirPath, runMetadataPath } from '../run.js';
import { createFakeGitLandPort } from './fake-ports.js';

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function createPetriExportedRun(cwd: string): Promise<void> {
  const runDir = runDirPath(cwd, 'run-1');
  await mkdir(join(runDir, 'petrinaut'), { recursive: true });
  await writeFile(
    petriNetPath(cwd, 'run-1'),
    JSON.stringify({ runId: 'run-1', places: ['run_completed'], transitions: [] }),
    'utf8',
  );
  await writeFile(
    runMetadataPath(cwd, 'run-1'),
    JSON.stringify({
      runId: 'run-1',
      specId: '42',
      planPath: '/tmp/plan.yaml',
      status: 'petri_exported',
      reportsPath: reportsPath(cwd, 'run-1'),
      petriPath: petriNetPath(cwd, 'run-1'),
      completedSliceIds: ['task-1'],
      worktreeDir: join(runDir, 'worktree'),
    }),
    'utf8',
  );
}

describe('preparePromotion', () => {
  it('does not prepare promotion for a missing run', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-promotion-missing-'));

    const result = await preparePromotion({ cwd, runId: 'run-1', gitLand: createFakeGitLandPort() });

    expect(result).toEqual({
      status: 'missing_run',
      runStatus: 'not_started',
      runId: 'run-1',
      metadataPath: runMetadataPath(cwd, 'run-1'),
      sideEffects: [],
    });
    expect(await pathExists(promotionReportPath(cwd, 'run-1'))).toBe(false);
  });

  it('does not prepare promotion before Petri export', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-promotion-not-ready-'));
    await mkdir(runDirPath(cwd, 'run-1'), { recursive: true });
    await writeFile(
      runMetadataPath(cwd, 'run-1'),
      JSON.stringify({ runId: 'run-1', specId: '42', planPath: '/tmp/plan.yaml', status: 'run_completed' }),
      'utf8',
    );

    const result = await preparePromotion({ cwd, runId: 'run-1', gitLand: createFakeGitLandPort() });

    expect(result).toEqual({
      status: 'run_not_promotable',
      runStatus: 'run_completed',
      runId: 'run-1',
      metadataPath: runMetadataPath(cwd, 'run-1'),
      sideEffects: [],
    });
    expect(await pathExists(promotionReportPath(cwd, 'run-1'))).toBe(false);
  });

  it('prepares a descriptive promotion report for a Petri-exported run', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-promotion-ready-'));
    await createPetriExportedRun(cwd);

    const result = await preparePromotion({ cwd, runId: 'run-1', gitLand: createFakeGitLandPort() });

    expect(result).toEqual({
      status: 'promotion_prepared',
      runStatus: 'promotion_prepared',
      runId: 'run-1',
      metadataPath: runMetadataPath(cwd, 'run-1'),
      promotionPath: promotionReportPath(cwd, 'run-1'),
      sideEffects: [
        { kind: 'write_file', path: runMetadataPath(cwd, 'run-1'), ifExists: 'overwrite' },
        { kind: 'git_commit', path: '/worktree', sha: 'abc123' },
        { kind: 'mkdir', path: join(runDirPath(cwd, 'run-1'), 'promotion') },
        { kind: 'write_file', path: promotionReportPath(cwd, 'run-1'), ifExists: 'overwrite' },
        { kind: 'write_file', path: runMetadataPath(cwd, 'run-1'), ifExists: 'overwrite' },
      ],
    });

    const report = JSON.parse(await readFile(promotionReportPath(cwd, 'run-1'), 'utf8'));
    expect(report).toEqual({
      runId: 'run-1',
      specId: '42',
      petriPath: petriNetPath(cwd, 'run-1'),
      reportsPath: reportsPath(cwd, 'run-1'),
      completedSliceIds: ['task-1'],
      land: { status: 'promoted', commitSha: 'abc123' },
    });
    expect(report).not.toHaveProperty('branch');

    expect(JSON.parse(await readFile(runMetadataPath(cwd, 'run-1'), 'utf8'))).toMatchObject({
      status: 'promotion_prepared',
      promotionPath: promotionReportPath(cwd, 'run-1'),
      promotionBaseSha: 'base123',
      promotionCommitSha: 'abc123',
    });

    // No host topology mutation: no host land branch/ref created.
    expect(await pathExists(join(cwd, '.git'))).toBe(false);
  });

  it('does not advance metadata when the land port reports no changes', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-promotion-no-changes-'));
    await createPetriExportedRun(cwd);

    const result = await preparePromotion({
      cwd,
      runId: 'run-1',
      gitLand: createFakeGitLandPort({
        status: 'no_changes',
        message: 'nothing to promote',
        commitSha: 'base123',
        sideEffects: [],
      }),
    });

    expect(result).toEqual({
      status: 'promotion_no_changes',
      runStatus: 'petri_exported',
      runId: 'run-1',
      worktreeDir: join(runDirPath(cwd, 'run-1'), 'worktree'),
      metadataPath: runMetadataPath(cwd, 'run-1'),
      message: 'nothing to promote',
      sideEffects: [{ kind: 'write_file', path: runMetadataPath(cwd, 'run-1'), ifExists: 'overwrite' }],
    });
    expect(JSON.parse(await readFile(runMetadataPath(cwd, 'run-1'), 'utf8'))).toMatchObject({
      status: 'petri_exported',
      promotionBaseSha: 'base123',
    });
    expect(await pathExists(promotionReportPath(cwd, 'run-1'))).toBe(false);
  });

  it('recovers promotion metadata when the report exists but run metadata did not advance', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-promotion-recovery-'));
    await createPetriExportedRun(cwd);
    await mkdir(join(runDirPath(cwd, 'run-1'), 'promotion'), { recursive: true });
    await writeFile(
      promotionReportPath(cwd, 'run-1'),
      JSON.stringify({
        runId: 'run-1',
        specId: '42',
        petriPath: petriNetPath(cwd, 'run-1'),
        reportsPath: reportsPath(cwd, 'run-1'),
        completedSliceIds: ['task-1'],
        land: { status: 'promoted', commitSha: 'abc123' },
      }),
      'utf8',
    );

    const result = await preparePromotion({
      cwd,
      runId: 'run-1',
      gitLand: createFakeGitLandPort(
        {
          status: 'no_changes',
          message: 'nothing to promote',
          sideEffects: [],
        },
        'abc123',
      ),
    });

    expect(result).toEqual({
      status: 'promotion_prepared',
      runStatus: 'promotion_prepared',
      runId: 'run-1',
      metadataPath: runMetadataPath(cwd, 'run-1'),
      promotionPath: promotionReportPath(cwd, 'run-1'),
      sideEffects: [{ kind: 'write_file', path: runMetadataPath(cwd, 'run-1'), ifExists: 'overwrite' }],
    });
    expect(JSON.parse(await readFile(runMetadataPath(cwd, 'run-1'), 'utf8'))).toMatchObject({
      status: 'promotion_prepared',
      promotionPath: promotionReportPath(cwd, 'run-1'),
      promotionCommitSha: 'abc123',
    });
  });

  it('does not recover a prewritten promotion report whose commit is not current HEAD', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-promotion-stale-report-'));
    await createPetriExportedRun(cwd);
    await mkdir(join(runDirPath(cwd, 'run-1'), 'promotion'), { recursive: true });
    await writeFile(
      promotionReportPath(cwd, 'run-1'),
      JSON.stringify({
        runId: 'run-1',
        specId: '42',
        petriPath: petriNetPath(cwd, 'run-1'),
        reportsPath: reportsPath(cwd, 'run-1'),
        completedSliceIds: ['task-1'],
        land: { status: 'promoted', commitSha: 'stale123' },
      }),
      'utf8',
    );

    const result = await preparePromotion({
      cwd,
      runId: 'run-1',
      gitLand: createFakeGitLandPort(
        {
          status: 'failed',
          message: 'must not trust stale report',
          sideEffects: [],
        },
        'abc123',
      ),
    });

    expect(result).toMatchObject({
      status: 'promotion_failed',
      runStatus: 'petri_exported',
      message: 'must not trust stale report',
    });
    expect(JSON.parse(await readFile(runMetadataPath(cwd, 'run-1'), 'utf8'))).toMatchObject({
      status: 'petri_exported',
    });
    expect(JSON.parse(await readFile(runMetadataPath(cwd, 'run-1'), 'utf8'))).not.toMatchObject({
      promotionCommitSha: 'stale123',
    });
  });

  it('recovers promotion metadata when the commit exists but the report was never written', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-promotion-recovery-no-report-'));
    await createPetriExportedRun(cwd);

    const result = await preparePromotion({
      cwd,
      runId: 'run-1',
      gitLand: createFakeGitLandPort({
        status: 'no_changes',
        message: 'already promoted',
        commitSha: 'abc123',
        sideEffects: [],
      }),
    });

    expect(result).toEqual({
      status: 'promotion_prepared',
      runStatus: 'promotion_prepared',
      runId: 'run-1',
      metadataPath: runMetadataPath(cwd, 'run-1'),
      promotionPath: promotionReportPath(cwd, 'run-1'),
      sideEffects: [
        { kind: 'write_file', path: runMetadataPath(cwd, 'run-1'), ifExists: 'overwrite' },
        { kind: 'mkdir', path: join(runDirPath(cwd, 'run-1'), 'promotion') },
        { kind: 'write_file', path: promotionReportPath(cwd, 'run-1'), ifExists: 'overwrite' },
        { kind: 'write_file', path: runMetadataPath(cwd, 'run-1'), ifExists: 'overwrite' },
      ],
    });
    expect(JSON.parse(await readFile(promotionReportPath(cwd, 'run-1'), 'utf8'))).toMatchObject({
      land: { status: 'promoted', commitSha: 'abc123' },
    });
    expect(JSON.parse(await readFile(runMetadataPath(cwd, 'run-1'), 'utf8'))).toMatchObject({
      status: 'promotion_prepared',
      promotionBaseSha: 'base123',
      promotionCommitSha: 'abc123',
    });
  });

  it('does not advance metadata when the land port fails', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-promotion-failed-'));
    await createPetriExportedRun(cwd);

    const result = await preparePromotion({
      cwd,
      runId: 'run-1',
      gitLand: createFakeGitLandPort({ status: 'failed', message: 'git commit failed', sideEffects: [] }),
    });

    expect(result).toMatchObject({
      status: 'promotion_failed',
      runStatus: 'petri_exported',
      message: 'git commit failed',
      sideEffects: [{ kind: 'write_file', path: runMetadataPath(cwd, 'run-1'), ifExists: 'overwrite' }],
    });
    expect(JSON.parse(await readFile(runMetadataPath(cwd, 'run-1'), 'utf8'))).toMatchObject({
      status: 'petri_exported',
      promotionBaseSha: 'base123',
    });
  });
});
