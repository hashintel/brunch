import { access, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { populatedPlanPath } from '../populate.js';
import { reportsPath } from '../report.js';
import { completeRun } from '../run-complete.js';
import { runDirPath, runMetadataPath } from '../run.js';

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function createSliceCompletedRun(cwd: string, completedSliceIds: string[]): Promise<void> {
  const runDir = runDirPath(cwd, 'run-1');
  const reportPath = reportsPath(cwd, 'run-1');
  const planPath = populatedPlanPath(cwd, 'run-1');
  await mkdir(join(runDir, 'worktree', '.brunch', 'cook'), { recursive: true });
  await writeFile(
    planPath,
    JSON.stringify({
      slices: [
        { id: 'task-1', epic_id: 'frontier-1' },
        { id: 'task-2', epic_id: 'frontier-1' },
      ],
    }),
    'utf8',
  );
  await writeFile(reportPath, '{"event":"run_ready"}\n', 'utf8');
  await writeFile(
    runMetadataPath(cwd, 'run-1'),
    JSON.stringify({
      runId: 'run-1',
      specId: '42',
      planPath: '/tmp/plan.yaml',
      populatedPlanPath: planPath,
      reportsPath: reportPath,
      status: 'slice_completed',
      completedSliceIds,
    }),
    'utf8',
  );
}

describe('completeRun', () => {
  it('does not complete before all plan slices are complete', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-run-complete-incomplete-'));
    await createSliceCompletedRun(cwd, ['task-1']);

    const result = await completeRun({ cwd, runId: 'run-1' });

    expect(result).toEqual({
      status: 'slices_incomplete',
      runStatus: 'slice_completed',
      runId: 'run-1',
      metadataPath: runMetadataPath(cwd, 'run-1'),
      completedSliceIds: ['task-1'],
      expectedSliceIds: ['task-1', 'task-2'],
      sideEffects: [],
    });
  });

  it('marks the run complete without Petri or promotion when all slices are complete', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-run-complete-ready-'));
    await createSliceCompletedRun(cwd, ['task-1', 'task-2']);

    const result = await completeRun({ cwd, runId: 'run-1' });

    expect(result).toEqual({
      status: 'run_completed',
      runStatus: 'run_completed',
      runId: 'run-1',
      metadataPath: runMetadataPath(cwd, 'run-1'),
      reportsPath: reportsPath(cwd, 'run-1'),
      sideEffects: [
        { kind: 'append_file', path: reportsPath(cwd, 'run-1') },
        { kind: 'write_file', path: runMetadataPath(cwd, 'run-1'), ifExists: 'overwrite' },
      ],
    });
    expect(
      (await readFile(reportsPath(cwd, 'run-1'), 'utf8'))
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line))
        .at(-1),
    ).toEqual({ event: 'run_completed', runId: 'run-1', status: 'run_completed' });
    expect(JSON.parse(await readFile(runMetadataPath(cwd, 'run-1'), 'utf8'))).toMatchObject({
      status: 'run_completed',
    });
    expect(await pathExists(join(runDirPath(cwd, 'run-1'), 'petrinaut'))).toBe(false);
    expect(await pathExists(join(runDirPath(cwd, 'run-1'), 'promotion'))).toBe(false);
  });
});
