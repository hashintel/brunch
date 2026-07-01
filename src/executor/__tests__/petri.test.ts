import { access, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { exportCookPetri, petriNetPath } from '../petri.js';
import { reportsPath } from '../report.js';
import { cookRunDir, cookRunMetadataPath } from '../run.js';

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function createCompletedRun(cwd: string): Promise<void> {
  const runDir = cookRunDir(cwd, 'run-1');
  const reportPath = reportsPath(cwd, 'run-1');
  await mkdir(runDir, { recursive: true });
  await writeFile(reportPath, '{"event":"run_completed","runId":"run-1"}\n', 'utf8');
  await writeFile(
    cookRunMetadataPath(cwd, 'run-1'),
    JSON.stringify({
      runId: 'run-1',
      specId: '42',
      planPath: '/tmp/plan.yaml',
      status: 'run_completed',
      reportsPath: reportPath,
      completedSliceIds: ['task-1'],
    }),
    'utf8',
  );
}

describe('exportCookPetri', () => {
  it('does not export Petri before run completion', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-not-ready-'));
    await mkdir(cookRunDir(cwd, 'run-1'), { recursive: true });
    await writeFile(
      cookRunMetadataPath(cwd, 'run-1'),
      JSON.stringify({ runId: 'run-1', specId: '42', planPath: '/tmp/plan.yaml', status: 'slice_completed' }),
      'utf8',
    );

    const result = await exportCookPetri({ cwd, runId: 'run-1' });

    expect(result).toEqual({
      status: 'run_not_completed',
      runStatus: 'slice_completed',
      runId: 'run-1',
      metadataPath: cookRunMetadataPath(cwd, 'run-1'),
      sideEffects: [],
    });
    expect(await pathExists(petriNetPath(cwd, 'run-1'))).toBe(false);
  });

  it('exports a minimal Petri net artifact for a completed run', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-ready-'));
    await createCompletedRun(cwd);

    const result = await exportCookPetri({ cwd, runId: 'run-1' });

    expect(result).toEqual({
      status: 'petri_exported',
      runStatus: 'petri_exported',
      runId: 'run-1',
      metadataPath: cookRunMetadataPath(cwd, 'run-1'),
      petriPath: petriNetPath(cwd, 'run-1'),
      sideEffects: [
        { kind: 'mkdir', path: join(cookRunDir(cwd, 'run-1'), 'petrinaut') },
        { kind: 'write_file', path: petriNetPath(cwd, 'run-1'), ifExists: 'overwrite' },
        { kind: 'write_file', path: cookRunMetadataPath(cwd, 'run-1'), ifExists: 'overwrite' },
      ],
    });
    expect(JSON.parse(await readFile(petriNetPath(cwd, 'run-1'), 'utf8'))).toEqual({
      runId: 'run-1',
      places: ['run_completed'],
      transitions: [],
    });
    expect(JSON.parse(await readFile(cookRunMetadataPath(cwd, 'run-1'), 'utf8'))).toMatchObject({
      status: 'petri_exported',
      petriPath: petriNetPath(cwd, 'run-1'),
    });
    expect(await pathExists(join(cookRunDir(cwd, 'run-1'), 'promotion'))).toBe(false);
  });
});
