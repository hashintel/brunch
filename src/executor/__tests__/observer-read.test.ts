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
});
