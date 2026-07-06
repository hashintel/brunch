import { access, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { reportsPath } from '../report.js';
import { runDirPath, runMetadataPath } from '../run.js';
import { completeSlice } from '../slice-complete.js';

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function createTestResultRun(cwd: string): Promise<void> {
  const runDir = runDirPath(cwd, 'run-1');
  const reportPath = reportsPath(cwd, 'run-1');
  const metadataPath = runMetadataPath(cwd, 'run-1');
  await mkdir(join(runDir, 'agent-output', 'task-1'), { recursive: true });
  await writeFile(reportPath, '{"event":"run_ready"}\n', 'utf8');
  await writeFile(
    metadataPath,
    JSON.stringify({
      runId: 'run-1',
      specId: '42',
      planPath: '/tmp/plan.yaml',
      status: 'test_result_ingested',
      reportsPath: reportPath,
      activeSliceId: 'task-1',
      activeEpicId: 'frontier-1',
    }),
    'utf8',
  );
}

describe('completeSlice', () => {
  it('does not complete when run metadata is missing', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-slice-complete-missing-run-'));
    const result = await completeSlice({ cwd, runId: 'run-1' });

    expect(result).toEqual({
      status: 'missing_run',
      runStatus: 'not_started',
      runId: 'run-1',
      metadataPath: runMetadataPath(cwd, 'run-1'),
      sideEffects: [],
    });
  });

  it('does not complete before test result ingestion', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-slice-complete-not-ready-'));
    await mkdir(runDirPath(cwd, 'run-1'), { recursive: true });
    await writeFile(
      runMetadataPath(cwd, 'run-1'),
      JSON.stringify({
        runId: 'run-1',
        specId: '42',
        planPath: '/tmp/plan.yaml',
        status: 'agent_result_ingested',
      }),
      'utf8',
    );

    const result = await completeSlice({ cwd, runId: 'run-1' });

    expect(result).toEqual({
      status: 'test_result_not_ingested',
      runStatus: 'agent_result_ingested',
      runId: 'run-1',
      metadataPath: runMetadataPath(cwd, 'run-1'),
      sideEffects: [],
    });
  });

  it('marks the active slice complete without Petri or promotion', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-slice-complete-ready-'));
    await createTestResultRun(cwd);

    const result = await completeSlice({ cwd, runId: 'run-1' });

    expect(result).toEqual({
      status: 'slice_completed',
      runStatus: 'slice_completed',
      runId: 'run-1',
      sliceId: 'task-1',
      epicId: 'frontier-1',
      metadataPath: runMetadataPath(cwd, 'run-1'),
      reportsPath: reportsPath(cwd, 'run-1'),
      sideEffects: [
        { kind: 'append_file', path: reportsPath(cwd, 'run-1') },
        { kind: 'write_file', path: runMetadataPath(cwd, 'run-1'), ifExists: 'overwrite' },
      ],
    });
    const reports = (await readFile(reportsPath(cwd, 'run-1'), 'utf8'))
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    expect(reports.at(-1)).toEqual({
      event: 'slice_completed',
      runId: 'run-1',
      epicId: 'frontier-1',
      sliceId: 'task-1',
      status: 'slice_completed',
    });
    expect(JSON.parse(await readFile(runMetadataPath(cwd, 'run-1'), 'utf8'))).toMatchObject({
      status: 'slice_completed',
      completedSliceIds: ['task-1'],
    });
    expect(await pathExists(join(runDirPath(cwd, 'run-1'), 'petrinaut'))).toBe(false);
    expect(await pathExists(join(runDirPath(cwd, 'run-1'), 'promotion'))).toBe(false);
  });
});
