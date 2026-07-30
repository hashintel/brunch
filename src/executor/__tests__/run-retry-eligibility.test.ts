import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { LaunchCurrentProjection } from '../launch.js';
import { petriEventsPath } from '../petri-events.js';
import { planFilePath, planProvenancePath } from '../plan-file.js';
import { assessRunRetryEligibility } from '../run-retry-eligibility.js';
import { runMetadataPath, type RunMetadata } from '../run.js';

const current: LaunchCurrentProjection = {
  specId: '42',
  mode: 'greenfield',
  source: { graphLsn: 11, visibility: 'active' },
  checkStatus: 'ok',
};

async function writeRun(cwd: string, status: RunMetadata['status']): Promise<void> {
  const metadataPath = runMetadataPath(cwd, 'run-1');
  await mkdir(dirname(metadataPath), { recursive: true });
  await writeFile(
    metadataPath,
    `${JSON.stringify(
      { runId: 'run-1', specId: '42', planPath: planFilePath(cwd, '42'), status },
      null,
      2,
    )}\n`,
    'utf8',
  );
}

async function writePlan(cwd: string, graphLsn = current.source.graphLsn): Promise<void> {
  const planPath = planFilePath(cwd, '42');
  await mkdir(dirname(planPath), { recursive: true });
  await writeFile(planPath, '{"mode":"greenfield","epics":[],"slices":[]}', 'utf8');
  await writeFile(
    planProvenancePath(cwd, '42'),
    `${JSON.stringify({
      schemaVersion: 1,
      specId: '42',
      mode: 'greenfield',
      source: { graphLsn, visibility: 'active' },
    })}\n`,
    'utf8',
  );
}

describe('assessRunRetryEligibility', () => {
  it('allows starting a new run when the requested run is missing', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-run-retry-missing-'));

    const result = await assessRunRetryEligibility({ cwd, runId: 'run-1', current });

    expect(result).toEqual({
      status: 'missing_run',
      runStatus: 'not_started',
      runId: 'run-1',
      metadataPath: runMetadataPath(cwd, 'run-1'),
      freshness: {
        status: 'missing_run',
        runStatus: 'not_started',
        runId: 'run-1',
        metadataPath: runMetadataPath(cwd, 'run-1'),
        sideEffects: [],
      },
      allowedActions: ['start_new_run'],
      sideEffects: [],
    });
  });

  it('allows retrying the current step for a fresh non-terminal run', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-run-retry-fresh-'));
    await writePlan(cwd);
    await writeRun(cwd, 'agent_result_ingested');

    const result = await assessRunRetryEligibility({ cwd, runId: 'run-1', current });

    expect(result).toMatchObject({
      status: 'retry_current_run',
      runStatus: 'agent_result_ingested',
      freshness: { status: 'run_fresh' },
      allowedActions: ['retry_current_step', 'inspect_run', 'abandon_run'],
    });
  });

  it('allows in-place replanning before retry for stale runs before plan population', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-run-retry-early-stale-'));
    await writePlan(cwd, 10);
    await writeRun(cwd, 'worktree_created');

    const result = await assessRunRetryEligibility({ cwd, runId: 'run-1', current });

    expect(result).toMatchObject({
      status: 'replan_before_retry',
      runStatus: 'worktree_created',
      freshness: { status: 'run_plan_stale' },
      allowedActions: ['regenerate_plan', 'start_new_run', 'abandon_run'],
    });
  });

  it('requires a new run when stale after the run-local plan was populated', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-run-retry-populated-stale-'));
    await writePlan(cwd, 10);
    await writeRun(cwd, 'worktree_populated');

    const result = await assessRunRetryEligibility({ cwd, runId: 'run-1', current });

    expect(result).toMatchObject({
      status: 'start_new_run_required',
      runStatus: 'worktree_populated',
      freshness: { status: 'run_plan_stale' },
      allowedActions: ['start_new_run', 'inspect_run', 'abandon_run'],
    });
  });

  it('requires a new run when stale after execution evidence exists', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-run-retry-started-stale-'));
    await writePlan(cwd, 10);
    await writeRun(cwd, 'slice_execution_requested');

    const result = await assessRunRetryEligibility({ cwd, runId: 'run-1', current });

    expect(result).toMatchObject({
      status: 'start_new_run_required',
      runStatus: 'slice_execution_requested',
      freshness: { status: 'run_plan_stale' },
      allowedActions: ['start_new_run', 'inspect_run', 'abandon_run'],
    });
  });

  it('does not classify a blocked current projection as stale replanning', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-run-retry-blocked-'));
    await writePlan(cwd);
    await writeRun(cwd, 'created');

    const result = await assessRunRetryEligibility({
      cwd,
      runId: 'run-1',
      current: { ...current, checkStatus: 'blocked' },
    });

    expect(result).toMatchObject({
      status: 'projection_blocked',
      runStatus: 'created',
      freshness: { status: 'run_projection_blocked' },
      allowedActions: ['inspect_run', 'abandon_run'],
    });
  });

  it('does not offer mutation actions for terminal runs', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-run-retry-terminal-'));
    await writePlan(cwd);
    await writeRun(cwd, 'promotion_prepared');

    const result = await assessRunRetryEligibility({ cwd, runId: 'run-1', current });

    expect(result).toMatchObject({
      status: 'terminal_run',
      runStatus: 'promotion_prepared',
      freshness: { status: 'run_fresh' },
      allowedActions: ['inspect_run'],
    });
  });

  it('refuses retry when the Petri journal is terminal but run metadata is stale', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-run-retry-petri-terminal-'));
    await writePlan(cwd);
    await writeRun(cwd, 'slice_execution_requested');
    const journalPath = petriEventsPath(cwd, 'run-1');
    await mkdir(dirname(journalPath), { recursive: true });
    await writeFile(
      journalPath,
      `${JSON.stringify({
        kind: 'net_halted',
        runId: 'run-1',
        runStatus: 'slice_execution_requested',
        step: 'agent_result',
        reason: 'agent_exhausted',
        failedSliceIds: ['task-1'],
        ts: new Date().toISOString(),
      })}\n`,
      'utf8',
    );

    const result = await assessRunRetryEligibility({ cwd, runId: 'run-1', current });

    expect(result).toMatchObject({
      status: 'terminal_run',
      runStatus: 'slice_execution_requested',
      allowedActions: ['start_new_run', 'inspect_run', 'abandon_run'],
      terminal: { kind: 'net_halted', reason: 'agent_exhausted' },
      sideEffects: [],
    });
  });
});
