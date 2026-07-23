import { access, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { appendPetriEvent, petriEventsPath } from '../petri-events.js';
import * as petriLifecycleReconciliation from '../petri-lifecycle-reconciliation.js';
import { writePetriMarkingSnapshot } from '../petri-marking.js';
import { preparePetriObservation } from '../petri.js';
import { planFilePath } from '../plan-file.js';
import { populateWorktree } from '../populate.js';
import { initializeReports, reportsPath } from '../report.js';
import { withRunExecutionAuthority } from '../run-execution-authority.js';
import { runDirPath, runMetadataPath, persistRunMetadata, readRunMetadata, createRun } from '../run.js';
import { startSlice, startSliceWithExecutionAuthority } from '../slice-start.js';
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

async function createReportReadyRun(cwd: string, prepareObservation = false): Promise<void> {
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
  if (prepareObservation) await preparePetriObservation({ cwd, runId: 'run-1' });
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
        {
          id: 'task-2',
          epic_id: 'frontier-1',
          definition: 'Second.',
          depends_on: ['task-1'],
          verification: [],
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

  it.each(['created', 'worktree_created'] as const)(
    'returns reports_not_initialized for %s before reading plan or journal artifacts',
    async (status) => {
      const cwd = await mkdtemp(join(tmpdir(), 'brunch-slice-start-early-status-'));
      await mkdir(runDirPath(cwd, 'run-1'), { recursive: true });
      await writeFile(
        runMetadataPath(cwd, 'run-1'),
        `${JSON.stringify({ runId: 'run-1', specId: '42', planPath: '/missing/plan.json', status })}\n`,
        'utf8',
      );

      await expect(startSlice({ cwd, runId: 'run-1' })).resolves.toEqual({
        status: 'reports_not_initialized',
        runStatus: status,
        runId: 'run-1',
        metadataPath: runMetadataPath(cwd, 'run-1'),
        sideEffects: [],
      });
    },
  );

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

  it('starts directly from a reconciled prepared journal instead of reporting a parallel batch', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-slice-start-prepared-journal-'));
    await createReportReadyRun(cwd, true);

    await expect(startSliceWithExecutionAuthority({ cwd, runId: 'run-1' })).resolves.toMatchObject({
      status: 'slice_started',
      runStatus: 'slice_started',
      sliceId: 'task-1',
    });
    const transitionIds = (await readFile(petriEventsPath(cwd, 'run-1'), 'utf8'))
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line))
      .flatMap((event) => (event.kind === 'transition_fired' ? [event.transitionId] : []));
    expect(transitionIds).toEqual([
      'worktree_create',
      'populate',
      'source_policy',
      'source_copy',
      'report_init',
      'slice_start:task-1',
    ]);
  });

  it('reports a blocked reconciliation after persisting the slice-start transition', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-slice-start-post-reconciliation-block-'));
    await createReportReadyRun(cwd);
    const reconcile = vi
      .spyOn(petriLifecycleReconciliation, 'reconcilePreparedLifecycleJournal')
      .mockResolvedValueOnce({ status: 'synchronized' })
      .mockResolvedValueOnce({ status: 'blocked', reason: 'petri_input_unreadable' });

    try {
      await expect(startSliceWithExecutionAuthority({ cwd, runId: 'run-1' })).resolves.toEqual({
        status: 'petri_input_unreadable',
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
    } finally {
      reconcile.mockRestore();
    }
    await expect(readRunMetadata(runMetadataPath(cwd, 'run-1'))).resolves.toMatchObject({
      status: 'slice_started',
      activeSliceId: 'task-1',
    });
  });

  it('reports unreadable Petri input instead of inventing parallel authority', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-slice-start-unreadable-journal-'));
    await createReportReadyRun(cwd, true);
    await writeFile(petriEventsPath(cwd, 'run-1'), '{', 'utf8');

    await expect(startSliceWithExecutionAuthority({ cwd, runId: 'run-1' })).resolves.toEqual({
      status: 'petri_input_unreadable',
      runStatus: 'reports_initialized',
      runId: 'run-1',
      metadataPath: runMetadataPath(cwd, 'run-1'),
      sideEffects: [],
    });
  });

  it('does not start a slice after the prepared journal records a terminal', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-slice-start-terminal-journal-'));
    await createReportReadyRun(cwd, true);
    await appendPetriEvent({
      cwd,
      runId: 'run-1',
      event: {
        kind: 'net_halted',
        runId: 'run-1',
        runStatus: 'reports_initialized',
        step: 'slice_start',
        reason: 'operator_halt',
        failedSliceIds: [],
      },
    });
    const journalBefore = await readFile(petriEventsPath(cwd, 'run-1'), 'utf8');
    const reportsBefore = await readFile(reportsPath(cwd, 'run-1'), 'utf8');

    await expect(startSliceWithExecutionAuthority({ cwd, runId: 'run-1' })).resolves.toEqual({
      status: 'petri_terminal_recorded',
      runStatus: 'reports_initialized',
      runId: 'run-1',
      metadataPath: runMetadataPath(cwd, 'run-1'),
      sideEffects: [],
    });
    const metadata = await readRunMetadata(runMetadataPath(cwd, 'run-1'));
    expect(metadata).toMatchObject({ status: 'reports_initialized' });
    expect(metadata?.activeSliceId).toBeUndefined();
    await expect(readFile(reportsPath(cwd, 'run-1'), 'utf8')).resolves.toBe(reportsBefore);
    await expect(readFile(petriEventsPath(cwd, 'run-1'), 'utf8')).resolves.toBe(journalBefore);
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

  it('does not let an explicit slice id bypass an incomplete dependency', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-slice-start-explicit-skip-'));
    await createDependencyReportReadyRun(cwd);

    const result = await startSlice({ cwd, runId: 'run-1', sliceId: 'task-2' });

    expect(result).toEqual({
      status: 'no_slice',
      runStatus: 'reports_initialized',
      runId: 'run-1',
      metadataPath: runMetadataPath(cwd, 'run-1'),
      reportsPath: reportsPath(cwd, 'run-1'),
      blockedSteps: [
        {
          kind: 'slice_start',
          sliceId: 'task-2',
          epicId: 'frontier-1',
          blockers: [{ kind: 'dependency', sliceId: 'task-1' }],
        },
      ],
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

  it('refuses a standalone start while the run execution owner is active', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-slice-start-run-authority-'));
    await createReportReadyRun(cwd);
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let entered!: () => void;
    const acquired = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const owner = withRunExecutionAuthority({
      cwd,
      runId: 'run-1',
      async execute() {
        entered();
        await held;
        return 'owner';
      },
    });
    await acquired;

    await expect(startSliceWithExecutionAuthority({ cwd, runId: 'run-1' })).resolves.toEqual({
      status: 'run_execution_active',
      runStatus: 'reports_initialized',
      runId: 'run-1',
      metadataPath: runMetadataPath(cwd, 'run-1'),
      sideEffects: [],
    });
    expect((await readRunMetadata(runMetadataPath(cwd, 'run-1')))?.activeSliceId).toBeUndefined();
    release();
    await owner;
  });

  it('refuses a standalone start when durable parallel batch authority is active', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-slice-start-parallel-authority-'));
    await createTwoSliceReportReadyRun(cwd);
    await writePetriMarkingSnapshot({
      cwd,
      runId: 'run-1',
      snapshot: {
        currentMarking: { 'slice:task-1:started': 1, 'slice:task-2:started': 1 },
        firedTransitionCount: 7,
        lifecycleProvenance: { runStatus: 'reports_initialized' },
        parallelSliceBatch: { claimedSliceIds: ['task-1', 'task-2'], settlements: [] },
      },
    });

    await expect(startSliceWithExecutionAuthority({ cwd, runId: 'run-1' })).resolves.toEqual({
      status: 'parallel_batch_active',
      runStatus: 'reports_initialized',
      runId: 'run-1',
      metadataPath: runMetadataPath(cwd, 'run-1'),
      sideEffects: [],
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
      blockedSteps: [],
      sideEffects: [],
    });
  });

  it('requires persisted epic completion before starting a dependent epic slice', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-slice-start-epic-dependency-'));
    await createTwoSliceReportReadyRun(cwd);
    const planPath = planFilePath(cwd, '42');
    await writeFile(
      planPath,
      JSON.stringify({
        mode: 'greenfield',
        epics: [
          { id: 'epic-1', depends_on: [], verification: [] },
          { id: 'epic-2', depends_on: ['epic-1'], verification: [] },
        ],
        slices: [
          { id: 'task-1', epic_id: 'epic-1', depends_on: [], verification: [] },
          { id: 'task-2', epic_id: 'epic-2', depends_on: [], verification: [] },
        ],
      }),
      'utf8',
    );
    await writeFile(
      join(cwd, '.brunch', 'cook', 'runs', 'run-1', 'worktree', '.brunch', 'cook', 'plan.json'),
      await readFile(planPath, 'utf8'),
      'utf8',
    );
    const metadata = (await readRunMetadata(runMetadataPath(cwd, 'run-1')))!;
    await persistRunMetadata(runMetadataPath(cwd, 'run-1'), {
      ...metadata,
      status: 'slice_completed',
      completedSliceIds: ['task-1'],
    });

    await expect(startSlice({ cwd, runId: 'run-1', sliceId: 'task-2' })).resolves.toMatchObject({
      status: 'no_slice',
      blockedSteps: [
        {
          sliceId: 'task-2',
          blockers: [{ kind: 'epic_dependency', epicId: 'epic-1' }],
        },
      ],
    });
    await persistRunMetadata(runMetadataPath(cwd, 'run-1'), {
      ...metadata,
      status: 'slice_completed',
      completedSliceIds: ['task-1'],
      completedEpicIds: ['epic-1'],
    });
    await expect(startSlice({ cwd, runId: 'run-1', sliceId: 'task-2' })).resolves.toMatchObject({
      status: 'slice_started',
      sliceId: 'task-2',
      epicId: 'epic-2',
    });
  });
});
