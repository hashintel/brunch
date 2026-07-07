import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { listRuns, readRunDetail } from '../observer-read.js';
import { runDirPath, runMetadataPath, type RunMetadata } from '../run.js';

async function fixtureCwd(prefix: string): Promise<string> {
  return mkdtemp(join(tmpdir(), prefix));
}

async function writeRun(cwd: string, runId: string, metadata: Partial<RunMetadata>): Promise<string> {
  const runDir = runDirPath(cwd, runId);
  await mkdir(runDir, { recursive: true });
  const payload = {
    runId,
    specId: '42',
    planPath: '/plan.yaml',
    status: 'created',
    ...metadata,
  };
  await writeFile(runMetadataPath(cwd, runId), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return runDir;
}

describe('listRuns', () => {
  it('returns an empty list when no runs directory exists', async () => {
    const cwd = await fixtureCwd('brunch-observer-empty-');
    expect(await listRuns(cwd)).toEqual([]);
  });

  it('summarizes readable runs with presence flags and marks torn metadata unreadable', async () => {
    const cwd = await fixtureCwd('brunch-observer-list-');
    const freshDir = await writeRun(cwd, 'run-a', { status: 'created' });
    await writeRun(cwd, 'run-b', { status: 'slice_started', activeSliceId: 's1' });
    await mkdir(join(runDirPath(cwd, 'run-b'), 'worktree'), { recursive: true });
    await writeFile(join(runDirPath(cwd, 'run-b'), 'reports.jsonl'), '{"event":"run_ready"}\n', 'utf8');
    const tornDir = runDirPath(cwd, 'run-c');
    await mkdir(tornDir, { recursive: true });
    await writeFile(join(tornDir, 'run.json'), '{"runId":"run-c","spec', 'utf8');

    const entries = await listRuns(cwd);

    expect(entries).toEqual([
      {
        runId: 'run-a',
        specId: '42',
        status: 'created',
        presence: { worktree: false, reports: false, petri: false, promotion: false },
      },
      {
        runId: 'run-b',
        specId: '42',
        status: 'slice_started',
        activeSliceId: 's1',
        presence: { worktree: true, reports: true, petri: false, promotion: false },
      },
      { runId: 'run-c', unreadable: true },
    ]);
    expect(freshDir).toContain('run-a');
  });

  it('marks invalid run directories unreadable instead of failing the full list', async () => {
    const cwd = await fixtureCwd('brunch-observer-invalid-dir-');
    await writeRun(cwd, 'run-a', { status: 'created' });
    await mkdir(join(cwd, '.brunch', 'cook', 'runs', 'bad run id'), { recursive: true });

    expect(await listRuns(cwd)).toEqual([
      { runId: 'bad run id', unreadable: true },
      {
        runId: 'run-a',
        specId: '42',
        status: 'created',
        presence: { worktree: false, reports: false, petri: false, promotion: false },
      },
    ]);
  });
});

describe('readRunDetail', () => {
  it('returns undefined for an unknown runId', async () => {
    const cwd = await fixtureCwd('brunch-observer-missing-');
    expect(await readRunDetail(cwd, 'run-x')).toBeUndefined();
  });

  it('marks a run with torn metadata unreadable instead of throwing', async () => {
    const cwd = await fixtureCwd('brunch-observer-torn-');
    const runDir = runDirPath(cwd, 'run-t');
    await mkdir(runDir, { recursive: true });
    await writeFile(join(runDir, 'run.json'), '{"truncated', 'utf8');

    expect(await readRunDetail(cwd, 'run-t')).toEqual({ runId: 'run-t', unreadable: true });
  });

  it('returns the reports tail, skipping an in-flight partial trailing line', async () => {
    const cwd = await fixtureCwd('brunch-observer-detail-');
    const runDir = await writeRun(cwd, 'run-d', {
      status: 'slice_execution_requested',
      activeSliceId: 's1',
    });
    const events = [
      '{"event":"run_ready","runId":"run-d"}',
      '{"event":"slice_started","runId":"run-d","sliceId":"s1"}',
      '{"event":"slice_execution_requested","runId":"run-d","sliceId":"s1"}',
    ];
    await writeFile(join(runDir, 'reports.jsonl'), `${events.join('\n')}\n{"event":"slice_agent_res`, 'utf8');

    const detail = await readRunDetail(cwd, 'run-d');

    expect(detail).toMatchObject({
      runId: 'run-d',
      planPath: '/plan.yaml',
      reportsTotal: 3,
      presence: { worktree: false, reports: true, petri: false, promotion: false },
    });
    expect(detail && 'reportsTail' in detail ? detail.reportsTail.map((e) => e.event) : []).toEqual([
      'run_ready',
      'slice_started',
      'slice_execution_requested',
    ]);
  });

  it('carries the raw parsed petri net when the artifact exists and parses', async () => {
    const cwd = await fixtureCwd('brunch-observer-petri-');
    const runDir = await writeRun(cwd, 'run-p', { status: 'petri_exported' });
    const net = { places: [{ id: 'p1' }], transitions: [] };
    await mkdir(join(runDir, 'petrinaut'), { recursive: true });
    await writeFile(join(runDir, 'petrinaut', 'net.json'), JSON.stringify(net), 'utf8');

    const detail = await readRunDetail(cwd, 'run-p');

    expect(detail).toMatchObject({
      presence: { petri: true },
      petriNet: net,
    });
  });

  it('omits the petri payload when the artifact is missing or unparseable', async () => {
    const cwd = await fixtureCwd('brunch-observer-petri-bad-');
    await writeRun(cwd, 'run-none', { status: 'run_completed' });
    const tornDir = await writeRun(cwd, 'run-torn-petri', { status: 'petri_exported' });
    await mkdir(join(tornDir, 'petrinaut'), { recursive: true });
    await writeFile(join(tornDir, 'petrinaut', 'net.json'), '{"places": [', 'utf8');

    const missing = await readRunDetail(cwd, 'run-none');
    const torn = await readRunDetail(cwd, 'run-torn-petri');

    expect(missing && 'petriNet' in missing ? missing.petriNet : 'absent').toBe('absent');
    expect(torn).toMatchObject({ presence: { petri: true } });
    expect(torn && 'petriNet' in torn ? torn.petriNet : 'absent').toBe('absent');
  });

  it('limits the reports tail while reporting the full total', async () => {
    const cwd = await fixtureCwd('brunch-observer-tail-limit-');
    const runDir = await writeRun(cwd, 'run-l', { status: 'run_completed' });
    const lines = Array.from({ length: 5 }, (_, i) => `{"event":"e${i}"}`);
    await writeFile(join(runDir, 'reports.jsonl'), `${lines.join('\n')}\n`, 'utf8');

    const detail = await readRunDetail(cwd, 'run-l', { reportsTailLimit: 2 });

    expect(detail).toMatchObject({ reportsTotal: 5 });
    expect(detail && 'reportsTail' in detail ? detail.reportsTail.map((e) => e.event) : []).toEqual([
      'e3',
      'e4',
    ]);
  });

  it('builds requirement statuses from the populated plan snapshot when available', async () => {
    const cwd = await fixtureCwd('brunch-observer-populated-plan-');
    const runDir = await writeRun(cwd, 'run-populated', {
      status: 'slice_completed',
      completedSliceIds: ['task-1'],
    });
    const stalePlanPath = join(runDir, 'stale-plan.json');
    const populatedPlanPath = join(runDir, 'worktree', '.brunch', 'cook', 'plan.yaml');
    await mkdir(join(runDir, 'worktree', '.brunch', 'cook'), { recursive: true });
    await writeFile(
      stalePlanPath,
      JSON.stringify({
        spec: { requirements: [{ item_id: 'REQ_STALE', content: 'Stale requirement' }] },
        slices: [{ id: 'stale-task', derived_from: ['REQ_STALE'] }],
      }),
      'utf8',
    );
    await writeFile(
      populatedPlanPath,
      JSON.stringify({
        spec: {
          requirements: [{ item_id: 'REQ1', content: 'Populated requirement' }],
          criteria: [{ item_id: 'AC1', verifies: ['REQ1'] }],
        },
        slices: [{ id: 'task-1', derived_from: ['REQ1'] }],
      }),
      'utf8',
    );
    await writeFile(
      join(runDir, 'reports.jsonl'),
      '{"event":"slice_test_result","sliceId":"task-1","status":"passed"}\n',
      'utf8',
    );
    await writeFile(
      runMetadataPath(cwd, 'run-populated'),
      `${JSON.stringify({
        runId: 'run-populated',
        specId: '42',
        planPath: stalePlanPath,
        populatedPlanPath,
        status: 'slice_completed',
        completedSliceIds: ['task-1'],
      })}\n`,
      'utf8',
    );

    const detail = await readRunDetail(cwd, 'run-populated');

    expect(detail && 'requirements' in detail ? detail.requirements : []).toEqual([
      {
        requirementId: 'REQ1',
        content: 'Populated requirement',
        status: 'passed',
        sliceIds: ['task-1'],
        completedSliceIds: ['task-1'],
        failedSliceIds: [],
        missingVerificationSliceIds: [],
        criterionIds: ['AC1'],
      },
    ]);
  });
});
