import { access, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { planFilePath } from '../plan-file.js';
import { populateWorktree } from '../populate.js';
import { initializeReports, reportsPath } from '../report.js';
import { runDirPath, runMetadataPath, persistRunMetadata, readRunMetadata, createRun } from '../run.js';
import { startSlice } from '../slice-start.js';
import { copyHostSource } from '../source-copy.js';
import { selectSourcePolicy } from '../source-policy.js';
import { createWorktree } from '../worktree.js';
import { createFakeGitWorktreePort } from './fake-ports.js';

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function createReportReadyRun(cwd: string): Promise<void> {
  const planPath = planFilePath(cwd, '42');
  await mkdir(join(cwd, 'src'), { recursive: true });
  await writeFile(join(cwd, 'src', 'app.ts'), 'export const app = true;\n', 'utf8');
  await mkdir(join(cwd, '.brunch', 'cook', 'specs', '42'), { recursive: true });
  await writeFile(
    planPath,
    JSON.stringify({
      mode: 'greenfield',
      epics: [{ id: 'frontier-1', summary: 'Build feature', depends_on: [], verification: [] }],
      slices: [
        {
          id: 'task-1',
          epic_id: 'frontier-1',
          definition: 'Build the first task.',
          depends_on: [],
          verification: [],
          derived_from: ['REQ1'],
        },
      ],
    }),
    'utf8',
  );
  await createRun({ cwd, specId: '42', runId: 'run-1' });
  await createWorktree({ cwd, runId: 'run-1', gitWorktree: createFakeGitWorktreePort() });
  await populateWorktree({ cwd, runId: 'run-1' });
  await selectSourcePolicy({ cwd, runId: 'run-1', policy: 'host_source_deferred' });
  await copyHostSource({ cwd, runId: 'run-1' });
  await initializeReports({ cwd, runId: 'run-1' });
}

async function createTwoSliceReportReadyRun(cwd: string): Promise<void> {
  const planPath = planFilePath(cwd, '42');
  await mkdir(join(cwd, 'src'), { recursive: true });
  await writeFile(join(cwd, 'src', 'app.ts'), 'export const app = true;\n', 'utf8');
  await mkdir(join(cwd, '.brunch', 'cook', 'specs', '42'), { recursive: true });
  await writeFile(
    planPath,
    JSON.stringify({
      mode: 'greenfield',
      epics: [{ id: 'frontier-1', summary: 'Build feature', depends_on: [], verification: [] }],
      slices: [
        { id: 'task-1', epic_id: 'frontier-1', definition: 'First.', depends_on: [], verification: [] },
        { id: 'task-2', epic_id: 'frontier-1', definition: 'Second.', depends_on: [], verification: [] },
      ],
    }),
    'utf8',
  );
  await createRun({ cwd, specId: '42', runId: 'run-1' });
  await createWorktree({ cwd, runId: 'run-1', gitWorktree: createFakeGitWorktreePort() });
  await populateWorktree({ cwd, runId: 'run-1' });
  await selectSourcePolicy({ cwd, runId: 'run-1', policy: 'host_source_deferred' });
  await copyHostSource({ cwd, runId: 'run-1' });
  await initializeReports({ cwd, runId: 'run-1' });
}

async function createDependencyReportReadyRun(cwd: string): Promise<void> {
  const planPath = planFilePath(cwd, '42');
  await mkdir(join(cwd, 'src'), { recursive: true });
  await writeFile(join(cwd, 'src', 'app.ts'), 'export const app = true;\n', 'utf8');
  await mkdir(join(cwd, '.brunch', 'cook', 'specs', '42'), { recursive: true });
  await writeFile(
    planPath,
    JSON.stringify({
      mode: 'greenfield',
      epics: [{ id: 'frontier-1', summary: 'Build feature', depends_on: [], verification: [] }],
      slices: [
        { id: 'task-1', epic_id: 'frontier-1', definition: 'First.', depends_on: [], verification: [] },
        {
          id: 'task-2',
          epic_id: 'frontier-1',
          definition: 'Second.',
          depends_on: ['task-1'],
          verification: [],
        },
        { id: 'task-3', epic_id: 'frontier-1', definition: 'Third.', depends_on: [], verification: [] },
      ],
    }),
    'utf8',
  );
  await createRun({ cwd, specId: '42', runId: 'run-1' });
  await createWorktree({ cwd, runId: 'run-1', gitWorktree: createFakeGitWorktreePort() });
  await populateWorktree({ cwd, runId: 'run-1' });
  await selectSourcePolicy({ cwd, runId: 'run-1', policy: 'host_source_deferred' });
  await copyHostSource({ cwd, runId: 'run-1' });
  await initializeReports({ cwd, runId: 'run-1' });
}

describe('startSlice', () => {
  it('does not start a slice when reports are not initialized', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-slice-start-missing-report-'));
    const result = await startSlice({ cwd, runId: 'run-1' });

    expect(result).toEqual({
      status: 'missing_run',
      runStatus: 'not_started',
      runId: 'run-1',
      metadataPath: runMetadataPath(cwd, 'run-1'),
      sideEffects: [],
    });
  });

  it('appends one slice-start marker for the first plan slice without running agents', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-slice-start-ready-'));
    await createReportReadyRun(cwd);

    const result = await startSlice({ cwd, runId: 'run-1' });

    expect(result).toEqual({
      status: 'slice_started',
      runStatus: 'slice_started',
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
      event: 'slice_started',
      runId: 'run-1',
      epicId: 'frontier-1',
      sliceId: 'task-1',
      status: 'slice_started',
    });
    expect(JSON.parse(await readFile(runMetadataPath(cwd, 'run-1'), 'utf8'))).toMatchObject({
      status: 'slice_started',
      activeSliceId: 'task-1',
      activeEpicId: 'frontier-1',
    });
    expect(await pathExists(join(runDirPath(cwd, 'run-1'), 'petrinaut'))).toBe(false);
    expect(await pathExists(join(runDirPath(cwd, 'run-1'), 'agent-output'))).toBe(false);
  });

  it('starts the next incomplete slice after a previous slice has completed', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-slice-start-next-'));
    await createTwoSliceReportReadyRun(cwd);

    const first = await startSlice({ cwd, runId: 'run-1' });
    expect(first.status).toBe('slice_started');
    expect(first.status === 'slice_started' && first.sliceId).toBe('task-1');

    // Simulate the first slice completing (agent + test ingest + slice complete).
    const metadata = await readRunMetadata(runMetadataPath(cwd, 'run-1'));
    expect(metadata).toBeDefined();
    await persistRunMetadata(runMetadataPath(cwd, 'run-1'), {
      ...metadata!,
      status: 'slice_completed',
      completedSliceIds: ['task-1'],
    });

    const second = await startSlice({ cwd, runId: 'run-1' });
    expect(second).toMatchObject({
      status: 'slice_started',
      runStatus: 'slice_started',
      sliceId: 'task-2',
      epicId: 'frontier-1',
    });
    expect(JSON.parse(await readFile(runMetadataPath(cwd, 'run-1'), 'utf8'))).toMatchObject({
      status: 'slice_started',
      activeSliceId: 'task-2',
    });
  });

  it('does not let an explicit slice id skip the next incomplete slice', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-slice-start-explicit-skip-'));
    await createDependencyReportReadyRun(cwd);

    const result = await startSlice({ cwd, runId: 'run-1', sliceId: 'task-2' });

    expect(result).toEqual({
      status: 'no_slice',
      runStatus: 'reports_initialized',
      runId: 'run-1',
      metadataPath: runMetadataPath(cwd, 'run-1'),
      reportsPath: reportsPath(cwd, 'run-1'),
      sideEffects: [],
    });
    expect(JSON.parse(await readFile(runMetadataPath(cwd, 'run-1'), 'utf8'))).toMatchObject({
      status: 'reports_initialized',
    });
  });

  it('accepts an explicit slice id when that slice is dependency-ready in the current frontier', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-slice-start-explicit-ready-'));
    await createDependencyReportReadyRun(cwd);

    const result = await startSlice({ cwd, runId: 'run-1', sliceId: 'task-3' });

    expect(result).toMatchObject({
      status: 'slice_started',
      runStatus: 'slice_started',
      sliceId: 'task-3',
      epicId: 'frontier-1',
    });
    expect(JSON.parse(await readFile(runMetadataPath(cwd, 'run-1'), 'utf8'))).toMatchObject({
      status: 'slice_started',
      activeSliceId: 'task-3',
    });
  });

  it('reports no remaining slice once every slice has completed', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-slice-start-exhausted-'));
    await createTwoSliceReportReadyRun(cwd);
    await startSlice({ cwd, runId: 'run-1' });

    const metadata = await readRunMetadata(runMetadataPath(cwd, 'run-1'));
    await persistRunMetadata(runMetadataPath(cwd, 'run-1'), {
      ...metadata!,
      status: 'slice_completed',
      completedSliceIds: ['task-1', 'task-2'],
    });

    const result = await startSlice({ cwd, runId: 'run-1' });
    expect(result).toEqual({
      status: 'no_slice',
      runStatus: 'slice_completed',
      runId: 'run-1',
      metadataPath: runMetadataPath(cwd, 'run-1'),
      reportsPath: reportsPath(cwd, 'run-1'),
      sideEffects: [],
    });
  });
});
