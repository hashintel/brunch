import { access, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { petriNetPath } from '../cook-petri.js';
import { prepareCookPromotion, promotionReportPath } from '../cook-promotion.js';
import { reportsPath } from '../cook-report.js';
import { cookRunDir, cookRunMetadataPath } from '../cook-run.js';

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function createPetriExportedRun(cwd: string): Promise<void> {
  const runDir = cookRunDir(cwd, 'run-1');
  await mkdir(join(runDir, 'petrinaut'), { recursive: true });
  await writeFile(
    petriNetPath(cwd, 'run-1'),
    JSON.stringify({ runId: 'run-1', places: ['run_completed'], transitions: [] }),
    'utf8',
  );
  await writeFile(
    cookRunMetadataPath(cwd, 'run-1'),
    JSON.stringify({
      runId: 'run-1',
      specId: '42',
      planPath: '/tmp/plan.yaml',
      status: 'petri_exported',
      reportsPath: reportsPath(cwd, 'run-1'),
      petriPath: petriNetPath(cwd, 'run-1'),
      completedSliceIds: ['task-1'],
    }),
    'utf8',
  );
}

describe('prepareCookPromotion', () => {
  it('does not prepare promotion for a missing run', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-promotion-missing-'));

    const result = await prepareCookPromotion({ cwd, runId: 'run-1' });

    expect(result).toEqual({
      status: 'missing_run',
      runStatus: 'not_started',
      runId: 'run-1',
      metadataPath: cookRunMetadataPath(cwd, 'run-1'),
      sideEffects: [],
    });
    expect(await pathExists(promotionReportPath(cwd, 'run-1'))).toBe(false);
  });

  it('does not prepare promotion before Petri export', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-promotion-not-ready-'));
    await mkdir(cookRunDir(cwd, 'run-1'), { recursive: true });
    await writeFile(
      cookRunMetadataPath(cwd, 'run-1'),
      JSON.stringify({ runId: 'run-1', specId: '42', planPath: '/tmp/plan.yaml', status: 'run_completed' }),
      'utf8',
    );

    const result = await prepareCookPromotion({ cwd, runId: 'run-1' });

    expect(result).toEqual({
      status: 'run_not_promotable',
      runStatus: 'run_completed',
      runId: 'run-1',
      metadataPath: cookRunMetadataPath(cwd, 'run-1'),
      sideEffects: [],
    });
    expect(await pathExists(promotionReportPath(cwd, 'run-1'))).toBe(false);
  });

  it('prepares a descriptive promotion report for a Petri-exported run', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-promotion-ready-'));
    await createPetriExportedRun(cwd);

    const result = await prepareCookPromotion({ cwd, runId: 'run-1' });

    expect(result).toEqual({
      status: 'promotion_prepared',
      runStatus: 'promotion_prepared',
      runId: 'run-1',
      metadataPath: cookRunMetadataPath(cwd, 'run-1'),
      promotionPath: promotionReportPath(cwd, 'run-1'),
      sideEffects: [
        { kind: 'mkdir', path: join(cookRunDir(cwd, 'run-1'), 'promotion') },
        { kind: 'write_file', path: promotionReportPath(cwd, 'run-1'), ifExists: 'overwrite' },
        { kind: 'write_file', path: cookRunMetadataPath(cwd, 'run-1'), ifExists: 'overwrite' },
      ],
    });

    const report = JSON.parse(await readFile(promotionReportPath(cwd, 'run-1'), 'utf8'));
    expect(report).toEqual({
      runId: 'run-1',
      specId: '42',
      petriPath: petriNetPath(cwd, 'run-1'),
      reportsPath: reportsPath(cwd, 'run-1'),
      completedSliceIds: ['task-1'],
    });
    // Descriptive only: no git/branch/ref topology fields.
    expect(report).not.toHaveProperty('ref');
    expect(report).not.toHaveProperty('branch');
    expect(report).not.toHaveProperty('sha');

    expect(JSON.parse(await readFile(cookRunMetadataPath(cwd, 'run-1'), 'utf8'))).toMatchObject({
      status: 'promotion_prepared',
      promotionPath: promotionReportPath(cwd, 'run-1'),
    });

    // No topology mutation: no land branch/worktree/git ref created.
    expect(await pathExists(join(cookRunDir(cwd, 'run-1'), 'worktree'))).toBe(false);
    expect(await pathExists(join(cwd, '.git'))).toBe(false);
  });
});
