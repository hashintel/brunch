import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { LaunchCurrentProjection } from '../launch.js';
import { planFilePath, planProvenancePath } from '../plan-file.js';
import { recommendRunReplan } from '../run-replan-recommendation.js';
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

describe('recommendRunReplan', () => {
  it('recommends starting a new run when the run is missing', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-run-recommend-missing-'));

    const recommendation = await recommendRunReplan({ cwd, runId: 'run-1', current });

    expect(recommendation).toMatchObject({
      status: 'missing_run',
      recommendedAction: 'start_new_run',
      allowedActions: ['start_new_run'],
    });
    expect(recommendation.diagnosis).toContain('does not exist');
  });

  it('recommends retrying the current step when the run is fresh and active', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-run-recommend-fresh-'));
    await writePlan(cwd);
    await writeRun(cwd, 'test_result_ingested');

    const recommendation = await recommendRunReplan({ cwd, runId: 'run-1', current });

    expect(recommendation).toMatchObject({
      status: 'retry_current_run',
      runStatus: 'test_result_ingested',
      recommendedAction: 'retry_current_step',
      allowedActions: ['retry_current_step', 'inspect_run', 'abandon_run'],
    });
    expect(recommendation.diagnosis).toContain('Retry the current step');
  });

  it('recommends regenerating the plan for stale early runs', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-run-recommend-replan-'));
    await writePlan(cwd, 10);
    await writeRun(cwd, 'worktree_created');

    const recommendation = await recommendRunReplan({ cwd, runId: 'run-1', current });

    expect(recommendation).toMatchObject({
      status: 'replan_before_retry',
      recommendedAction: 'regenerate_plan',
      allowedActions: ['regenerate_plan', 'start_new_run', 'abandon_run'],
    });
    expect(recommendation.diagnosis).toContain('Regenerate the plan');
  });

  it('recommends a new run for stale runs that already have execution evidence', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-run-recommend-new-run-'));
    await writePlan(cwd, 10);
    await writeRun(cwd, 'agent_result_ingested');

    const recommendation = await recommendRunReplan({ cwd, runId: 'run-1', current });

    expect(recommendation).toMatchObject({
      status: 'start_new_run_required',
      recommendedAction: 'start_new_run',
      allowedActions: ['start_new_run', 'inspect_run', 'abandon_run'],
    });
    expect(recommendation.diagnosis).toContain('Start a new run');
  });

  it('recommends inspection for terminal runs', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-run-recommend-terminal-'));
    await writePlan(cwd);
    await writeRun(cwd, 'run_completed');

    const recommendation = await recommendRunReplan({ cwd, runId: 'run-1', current });

    expect(recommendation).toMatchObject({
      status: 'terminal_run',
      recommendedAction: 'inspect_run',
      allowedActions: ['inspect_run'],
    });
    expect(recommendation.diagnosis).toContain('terminal');
  });
});
