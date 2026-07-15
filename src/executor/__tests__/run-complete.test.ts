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

async function createSliceCompletedRun(
  cwd: string,
  completedSliceIds: string[],
  testResults: readonly { readonly sliceId: string; readonly status: 'passed' | 'failed' }[] = [],
): Promise<void> {
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
  await writeFile(
    reportPath,
    [
      { event: 'run_ready' },
      ...testResults.map((result) => ({
        event: 'slice_test_result',
        runId: 'run-1',
        epicId: 'frontier-1',
        sliceId: result.sliceId,
        status: result.status,
        exitCode: result.status === 'passed' ? 0 : 1,
      })),
    ]
      .map((event) => JSON.stringify(event))
      .join('\n') + '\n',
    'utf8',
  );
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

async function createEmptyPlanRun(cwd: string): Promise<void> {
  const runDir = runDirPath(cwd, 'run-1');
  const reportPath = reportsPath(cwd, 'run-1');
  const planPath = populatedPlanPath(cwd, 'run-1');
  await mkdir(join(runDir, 'worktree', '.brunch', 'cook'), { recursive: true });
  await writeFile(planPath, JSON.stringify({ slices: [] }), 'utf8');
  await writeFile(reportPath, '{"event":"run_ready"}\n', 'utf8');
  await writeFile(
    runMetadataPath(cwd, 'run-1'),
    JSON.stringify({
      runId: 'run-1',
      specId: '42',
      planPath: '/tmp/plan.yaml',
      populatedPlanPath: planPath,
      reportsPath: reportPath,
      status: 'reports_initialized',
    }),
    'utf8',
  );
}

async function addRequiredEpic(
  cwd: string,
  options: { readonly completed?: boolean; readonly verdict?: 'passed' | 'failed' } = {},
): Promise<void> {
  const planPath = populatedPlanPath(cwd, 'run-1');
  const plan = JSON.parse(await readFile(planPath, 'utf8'));
  await writeFile(
    planPath,
    JSON.stringify({
      ...plan,
      epics: [{ id: 'frontier-1', verification: [{ kind: 'criterion', target: 'provenance' }] }],
    }),
    'utf8',
  );
  const metadataPath = runMetadataPath(cwd, 'run-1');
  const metadata = JSON.parse(await readFile(metadataPath, 'utf8'));
  await writeFile(
    metadataPath,
    JSON.stringify({
      ...metadata,
      ...(options.completed ? { completedEpicIds: ['frontier-1'] } : {}),
    }),
    'utf8',
  );
  if (options.verdict) {
    await writeFile(
      reportsPath(cwd, 'run-1'),
      `${await readFile(reportsPath(cwd, 'run-1'), 'utf8')}${JSON.stringify({
        event: 'epic_test_result',
        epicId: 'frontier-1',
        status: options.verdict,
      })}\n`,
      'utf8',
    );
  }
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

  it('does not complete an empty plan without any executed slices', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-run-complete-empty-plan-'));
    await createEmptyPlanRun(cwd);

    const result = await completeRun({ cwd, runId: 'run-1' });

    expect(result).toEqual({
      status: 'slices_incomplete',
      runStatus: 'reports_initialized',
      runId: 'run-1',
      metadataPath: runMetadataPath(cwd, 'run-1'),
      completedSliceIds: [],
      expectedSliceIds: [],
      sideEffects: [],
    });
    expect(JSON.parse(await readFile(runMetadataPath(cwd, 'run-1'), 'utf8'))).toMatchObject({
      status: 'reports_initialized',
    });
  });

  it('marks the run complete without Petri or promotion when all slices are complete', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-run-complete-ready-'));
    await createSliceCompletedRun(
      cwd,
      ['task-1', 'task-2'],
      [
        { sliceId: 'task-1', status: 'passed' },
        { sliceId: 'task-2', status: 'passed' },
      ],
    );

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

  it('does not append another report when the run is already complete', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-run-complete-idempotent-'));
    await createSliceCompletedRun(
      cwd,
      ['task-1', 'task-2'],
      [
        { sliceId: 'task-1', status: 'passed' },
        { sliceId: 'task-2', status: 'passed' },
      ],
    );
    await completeRun({ cwd, runId: 'run-1' });
    const reportBeforeSecondCompletion = await readFile(reportsPath(cwd, 'run-1'), 'utf8');

    const result = await completeRun({ cwd, runId: 'run-1' });

    expect(result).toEqual({
      status: 'already_completed',
      runStatus: 'run_completed',
      runId: 'run-1',
      metadataPath: runMetadataPath(cwd, 'run-1'),
      reportsPath: reportsPath(cwd, 'run-1'),
      sideEffects: [],
    });
    expect(await readFile(reportsPath(cwd, 'run-1'), 'utf8')).toBe(reportBeforeSecondCompletion);
  });

  it('does not complete before every epic lifecycle reaches completion', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-run-complete-epic-incomplete-'));
    await createSliceCompletedRun(
      cwd,
      ['task-1', 'task-2'],
      [
        { sliceId: 'task-1', status: 'passed' },
        { sliceId: 'task-2', status: 'passed' },
      ],
    );
    await addRequiredEpic(cwd, { verdict: 'passed' });

    await expect(completeRun({ cwd, runId: 'run-1' })).resolves.toMatchObject({
      status: 'epics_incomplete',
      completedEpicIds: [],
      expectedEpicIds: ['frontier-1'],
    });
  });

  it.each([
    { label: 'missing', verdict: undefined, expected: 'epic_verification_missing' },
    { label: 'failed', verdict: 'failed' as const, expected: 'epic_verification_failed' },
  ])('does not complete when required epic verification is $label', async ({ verdict, expected }) => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-run-complete-epic-verdict-'));
    await createSliceCompletedRun(
      cwd,
      ['task-1', 'task-2'],
      [
        { sliceId: 'task-1', status: 'passed' },
        { sliceId: 'task-2', status: 'passed' },
      ],
    );
    await addRequiredEpic(cwd, { completed: true, ...(verdict ? { verdict } : {}) });

    await expect(completeRun({ cwd, runId: 'run-1' })).resolves.toMatchObject({
      status: expected,
      epicIds: ['frontier-1'],
    });
    expect(await readFile(reportsPath(cwd, 'run-1'), 'utf8')).not.toContain('run_completed');
  });

  it('does not complete when a completed slice has failed verification', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-run-complete-failed-verification-'));
    await createSliceCompletedRun(
      cwd,
      ['task-1', 'task-2'],
      [
        { sliceId: 'task-1', status: 'passed' },
        { sliceId: 'task-2', status: 'failed' },
      ],
    );

    const result = await completeRun({ cwd, runId: 'run-1' });

    expect(result).toEqual({
      status: 'verification_failed',
      runStatus: 'slice_completed',
      runId: 'run-1',
      metadataPath: runMetadataPath(cwd, 'run-1'),
      reportsPath: reportsPath(cwd, 'run-1'),
      failedSliceIds: ['task-2'],
      sideEffects: [],
    });
    expect((await readFile(reportsPath(cwd, 'run-1'), 'utf8')).includes('run_completed')).toBe(false);
    expect(JSON.parse(await readFile(runMetadataPath(cwd, 'run-1'), 'utf8'))).toMatchObject({
      status: 'slice_completed',
    });
  });

  it('does not complete when completed slices are missing verification evidence', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-run-complete-missing-verification-'));
    await createSliceCompletedRun(cwd, ['task-1', 'task-2'], [{ sliceId: 'task-1', status: 'passed' }]);

    const result = await completeRun({ cwd, runId: 'run-1' });

    expect(result).toEqual({
      status: 'verification_missing',
      runStatus: 'slice_completed',
      runId: 'run-1',
      metadataPath: runMetadataPath(cwd, 'run-1'),
      reportsPath: reportsPath(cwd, 'run-1'),
      missingSliceIds: ['task-2'],
      sideEffects: [],
    });
    expect((await readFile(reportsPath(cwd, 'run-1'), 'utf8')).includes('run_completed')).toBe(false);
    expect(JSON.parse(await readFile(runMetadataPath(cwd, 'run-1'), 'utf8'))).toMatchObject({
      status: 'slice_completed',
    });
  });

  it('treats corrupt report lines as missing verification instead of crashing', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-run-complete-corrupt-report-'));
    await createSliceCompletedRun(cwd, ['task-1', 'task-2'], [{ sliceId: 'task-1', status: 'passed' }]);
    await writeFile(
      reportsPath(cwd, 'run-1'),
      [
        JSON.stringify({ event: 'run_ready' }),
        JSON.stringify({
          event: 'slice_test_result',
          runId: 'run-1',
          epicId: 'frontier-1',
          sliceId: 'task-1',
          status: 'passed',
          exitCode: 0,
        }),
        '{"event":"slice_test_result","sliceId":"task-2",',
      ].join('\n') + '\n',
      'utf8',
    );

    const result = await completeRun({ cwd, runId: 'run-1' });

    expect(result).toEqual({
      status: 'verification_missing',
      runStatus: 'slice_completed',
      runId: 'run-1',
      metadataPath: runMetadataPath(cwd, 'run-1'),
      reportsPath: reportsPath(cwd, 'run-1'),
      missingSliceIds: ['task-2'],
      sideEffects: [],
    });
  });
});
