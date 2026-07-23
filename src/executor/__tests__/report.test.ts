import { access, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { appendPetriEvent, petriEventsPath } from '../petri-events.js';
import * as petriLifecycleReconciliation from '../petri-lifecycle-reconciliation.js';
import { preparePetriObservation } from '../petri.js';
import { planFilePath } from '../plan-file.js';
import { populateWorktree } from '../populate.js';
import { initializeReports, reportsPath } from '../report.js';
import { runDirPath, runMetadataPath, readRunMetadata, createRun } from '../run.js';
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

async function createSourceCopiedRun(cwd: string): Promise<void> {
  const planPath = planFilePath(cwd, '42');
  await mkdir(join(cwd, 'src'), { recursive: true });
  await writeFile(join(cwd, 'src', 'app.ts'), 'export const app = true;\n', 'utf8');
  await mkdir(join(cwd, '.brunch', 'cook', 'specs', '42'), { recursive: true });
  await writeFile(planPath, '{"mode":"greenfield","epics":[],"slices":[]}', 'utf8');
  await createRun({ cwd, specId: '42', runId: 'run-1' });
  await createWorktree({ cwd, runId: 'run-1', gitWorktree: createFakeGitWorktreePort() });
  await populateWorktree({ cwd, runId: 'run-1' });
  await selectSourcePolicy({ cwd, runId: 'run-1', policy: 'host_source_deferred' });
  await copyHostSource({ cwd, runId: 'run-1' });
}

describe('initializeReports', () => {
  it('does not create reports when run metadata is missing', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-report-missing-run-'));
    const result = await initializeReports({ cwd, runId: 'run-1' });

    expect(result).toEqual({
      status: 'missing_run',
      runStatus: 'not_started',
      runId: 'run-1',
      metadataPath: runMetadataPath(cwd, 'run-1'),
      sideEffects: [],
    });
  });

  it('does not create reports until host source has been copied', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-report-not-ready-'));
    const planPath = planFilePath(cwd, '42');
    await mkdir(join(cwd, '.brunch', 'cook', 'specs', '42'), { recursive: true });
    await writeFile(planPath, '{"mode":"greenfield","epics":[],"slices":[]}', 'utf8');
    await createRun({ cwd, specId: '42', runId: 'run-1' });

    const result = await initializeReports({ cwd, runId: 'run-1' });

    expect(result).toEqual({
      status: 'source_not_copied',
      runStatus: 'created',
      runId: 'run-1',
      metadataPath: runMetadataPath(cwd, 'run-1'),
      sideEffects: [],
    });
    expect(await pathExists(reportsPath(cwd, 'run-1'))).toBe(false);
  });

  it('writes a report log initialization event only', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-report-ready-'));
    await createSourceCopiedRun(cwd);

    const result = await initializeReports({ cwd, runId: 'run-1' });

    expect(result).toEqual({
      status: 'reports_initialized',
      runStatus: 'reports_initialized',
      runId: 'run-1',
      metadataPath: runMetadataPath(cwd, 'run-1'),
      reportsPath: reportsPath(cwd, 'run-1'),
      sideEffects: [
        { kind: 'write_file', path: reportsPath(cwd, 'run-1'), ifExists: 'overwrite' },
        { kind: 'write_file', path: runMetadataPath(cwd, 'run-1'), ifExists: 'overwrite' },
      ],
    });
    const reports = (await readFile(reportsPath(cwd, 'run-1'), 'utf8'))
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    expect(reports).toEqual([
      {
        event: 'run_ready',
        runId: 'run-1',
        status: 'reports_initialized',
      },
    ]);
    expect(JSON.parse(await readFile(runMetadataPath(cwd, 'run-1'), 'utf8'))).toMatchObject({
      status: 'reports_initialized',
      reportsPath: reportsPath(cwd, 'run-1'),
    });
    expect(await pathExists(join(runDirPath(cwd, 'run-1'), 'petrinaut'))).toBe(false);
  });

  it('reports a blocked prepared-journal reconciliation after persisting report initialization', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-report-blocked-journal-'));
    await createSourceCopiedRun(cwd);
    const reconcile = vi
      .spyOn(petriLifecycleReconciliation, 'reconcilePreparedLifecycleJournal')
      .mockResolvedValueOnce({ status: 'synchronized' })
      .mockResolvedValueOnce({ status: 'blocked', reason: 'petri_input_unreadable' });

    try {
      await expect(initializeReports({ cwd, runId: 'run-1' })).resolves.toEqual({
        status: 'petri_input_unreadable',
        runStatus: 'reports_initialized',
        runId: 'run-1',
        metadataPath: runMetadataPath(cwd, 'run-1'),
        reportsPath: reportsPath(cwd, 'run-1'),
        sideEffects: [
          { kind: 'write_file', path: reportsPath(cwd, 'run-1'), ifExists: 'overwrite' },
          { kind: 'write_file', path: runMetadataPath(cwd, 'run-1'), ifExists: 'overwrite' },
        ],
      });
    } finally {
      reconcile.mockRestore();
    }
    await expect(readRunMetadata(runMetadataPath(cwd, 'run-1'))).resolves.toMatchObject({
      status: 'reports_initialized',
    });
  });

  it('does not initialize reports after the prepared journal records a terminal', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-report-terminal-journal-'));
    await createSourceCopiedRun(cwd);
    await preparePetriObservation({ cwd, runId: 'run-1' });
    await appendPetriEvent({
      cwd,
      runId: 'run-1',
      event: {
        kind: 'net_halted',
        runId: 'run-1',
        runStatus: 'source_copied',
        step: 'report_init',
        reason: 'operator_halt',
        failedSliceIds: [],
      },
    });
    const journalBefore = await readFile(petriEventsPath(cwd, 'run-1'), 'utf8');

    await expect(initializeReports({ cwd, runId: 'run-1' })).resolves.toEqual({
      status: 'petri_terminal_recorded',
      runStatus: 'source_copied',
      runId: 'run-1',
      metadataPath: runMetadataPath(cwd, 'run-1'),
      sideEffects: [],
    });
    await expect(readRunMetadata(runMetadataPath(cwd, 'run-1'))).resolves.toMatchObject({
      status: 'source_copied',
    });
    await expect(pathExists(reportsPath(cwd, 'run-1'))).resolves.toBe(false);
    await expect(readFile(petriEventsPath(cwd, 'run-1'), 'utf8')).resolves.toBe(journalBefore);
  });
});
