import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { LaunchCurrentProjection } from '../launch.js';
import { planFilePath, planProvenancePath } from '../plan-file.js';
import { checkRunFreshness } from '../run-freshness.js';
import { runMetadataPath } from '../run.js';

const current: LaunchCurrentProjection = {
  specId: '42',
  mode: 'greenfield',
  source: { graphLsn: 11, visibility: 'active' },
  checkStatus: 'ok',
};

async function writeRun(cwd: string, planPath = planFilePath(cwd, '42')): Promise<void> {
  const metadataPath = runMetadataPath(cwd, 'run-1');
  await mkdir(dirname(metadataPath), { recursive: true });
  await writeFile(
    metadataPath,
    `${JSON.stringify({ runId: 'run-1', specId: '42', planPath, status: 'created' }, null, 2)}\n`,
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

describe('checkRunFreshness', () => {
  it('reports missing_run without touching run artifacts', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-run-freshness-missing-'));

    await expect(checkRunFreshness({ cwd, runId: 'run-1', current })).resolves.toEqual({
      status: 'missing_run',
      runStatus: 'not_started',
      runId: 'run-1',
      metadataPath: runMetadataPath(cwd, 'run-1'),
      sideEffects: [],
    });
  });

  it('reports run_fresh when the run plan provenance matches the current graph projection', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-run-freshness-ready-'));
    await writePlan(cwd);
    await writeRun(cwd);

    const result = await checkRunFreshness({ cwd, runId: 'run-1', current });

    expect(result).toMatchObject({
      status: 'run_fresh',
      runStatus: 'not_started',
      runId: 'run-1',
      planPath: planFilePath(cwd, '42'),
      launch: { status: 'ready' },
      sideEffects: [],
    });
  });

  it('reports run_plan_stale when provenance lags the current graph projection', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-run-freshness-stale-'));
    await writePlan(cwd, 10);
    await writeRun(cwd);

    const result = await checkRunFreshness({ cwd, runId: 'run-1', current });

    expect(result).toMatchObject({
      status: 'run_plan_stale',
      launch: { status: 'stale_plan' },
    });
  });

  it('reports run_provenance_missing when the run plan has no provenance sidecar', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-run-freshness-no-provenance-'));
    const planPath = planFilePath(cwd, '42');
    await mkdir(dirname(planPath), { recursive: true });
    await writeFile(planPath, '{"mode":"greenfield","epics":[],"slices":[]}', 'utf8');
    await writeRun(cwd);

    const result = await checkRunFreshness({ cwd, runId: 'run-1', current });

    expect(result).toMatchObject({
      status: 'run_provenance_missing',
      launch: { status: 'missing_provenance' },
    });
  });

  it('reports run_projection_blocked before accepting an otherwise matching plan', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-run-freshness-blocked-'));
    await writePlan(cwd);
    await writeRun(cwd);
    const blocked = { ...current, checkStatus: 'blocked' as const };

    const result = await checkRunFreshness({ cwd, runId: 'run-1', current: blocked });

    expect(result).toMatchObject({
      status: 'run_projection_blocked',
      launch: { status: 'blocked_projection' },
    });
  });
});
