import { access, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { LaunchCurrentProjection } from '../launch.js';
import { petriEventsPath } from '../petri-events.js';
import { petriPlanSnapshotPath } from '../petri-plan-snapshot.js';
import { petriNetPath, petriSdcpnPath } from '../petri.js';
import { planFilePath, planProvenancePath } from '../plan-file.js';
import { withRunExecutionAuthority } from '../run-execution-authority.js';
import { createSupersedingRun } from '../run-supersession.js';
import { readRunMetadata, runDirPath, runMetadataPath, type RunMetadata } from '../run.js';

const current: LaunchCurrentProjection = {
  specId: '42',
  mode: 'greenfield',
  source: { graphLsn: 11, visibility: 'active' },
  checkStatus: 'ok',
};

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
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

async function writeRun(
  cwd: string,
  runId: string,
  status: RunMetadata['status'] = 'agent_result_ingested',
): Promise<RunMetadata> {
  const metadata: RunMetadata = {
    runId,
    specId: '42',
    planPath: planFilePath(cwd, '42'),
    status,
  };
  const metadataPath = runMetadataPath(cwd, runId);
  await mkdir(dirname(metadataPath), { recursive: true });
  await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
  return metadata;
}

describe('createSupersedingRun', () => {
  it('refuses while the previous run mutation authority is active', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-run-supersede-contended-'));
    await writePlan(cwd);
    await writeRun(cwd, 'run-old');
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
      runId: 'run-old',
      execute: () => {
        entered();
        return held;
      },
    });
    await acquired;

    await expect(
      createSupersedingRun({ cwd, previousRunId: 'run-old', runId: 'run-new', current }),
    ).resolves.toEqual({
      status: 'run_execution_active',
      runStatus: 'not_started',
      runId: 'run-old',
      sideEffects: [],
    });
    expect(await pathExists(runDirPath(cwd, 'run-new'))).toBe(false);
    release();
    await owner;
  });

  it('refuses when the previous run is missing', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-run-supersede-missing-'));

    const result = await createSupersedingRun({
      cwd,
      previousRunId: 'run-old',
      runId: 'run-new',
      current,
    });

    expect(result).toEqual({
      status: 'missing_previous_run',
      runStatus: 'not_started',
      previousRunId: 'run-old',
      previousMetadataPath: runMetadataPath(cwd, 'run-old'),
      sideEffects: [],
    });
    expect(await pathExists(runDirPath(cwd, 'run-new'))).toBe(false);
  });

  it('refuses when the current plan is not launch-ready', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-run-supersede-stale-'));
    await writePlan(cwd, 10);
    await writeRun(cwd, 'run-old');

    const result = await createSupersedingRun({
      cwd,
      previousRunId: 'run-old',
      runId: 'run-new',
      current,
    });

    expect(result).toMatchObject({
      status: 'launch_not_ready',
      runStatus: 'not_started',
      previousRunId: 'run-old',
      planPath: planFilePath(cwd, '42'),
      launch: { status: 'stale_plan' },
      sideEffects: [],
    });
    expect(await pathExists(runDirPath(cwd, 'run-new'))).toBe(false);
  });

  it('refuses to overwrite an existing target run id', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-run-supersede-existing-'));
    await writePlan(cwd);
    await writeRun(cwd, 'run-old');
    await writeRun(cwd, 'run-new', 'created');

    const result = await createSupersedingRun({
      cwd,
      previousRunId: 'run-old',
      runId: 'run-new',
      current,
    });

    expect(result).toEqual({
      status: 'target_run_exists',
      runStatus: 'not_started',
      previousRunId: 'run-old',
      runId: 'run-new',
      metadataPath: runMetadataPath(cwd, 'run-new'),
      sideEffects: [],
    });
  });

  it('refuses to attach metadata to an existing target run directory', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-run-supersede-existing-dir-'));
    await writePlan(cwd);
    await writeRun(cwd, 'run-old');
    await mkdir(runDirPath(cwd, 'run-new'), { recursive: true });
    await writeFile(join(runDirPath(cwd, 'run-new'), 'stale-artifact.txt'), 'old run residue', 'utf8');

    const result = await createSupersedingRun({
      cwd,
      previousRunId: 'run-old',
      runId: 'run-new',
      current,
    });

    expect(result).toEqual({
      status: 'target_run_exists',
      runStatus: 'not_started',
      previousRunId: 'run-old',
      runId: 'run-new',
      metadataPath: runMetadataPath(cwd, 'run-new'),
      sideEffects: [],
    });
    await expect(readFile(join(runDirPath(cwd, 'run-new'), 'stale-artifact.txt'), 'utf8')).resolves.toBe(
      'old run residue',
    );
  });

  it('creates a new linked run without mutating the previous run', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-run-supersede-create-'));
    await writePlan(cwd);
    const previous = await writeRun(cwd, 'run-old');

    const result = await createSupersedingRun({
      cwd,
      previousRunId: 'run-old',
      runId: 'run-new',
      current,
    });

    expect(result).toEqual({
      status: 'created',
      runStatus: 'created',
      previousRunId: 'run-old',
      runId: 'run-new',
      runDir: runDirPath(cwd, 'run-new'),
      metadataPath: runMetadataPath(cwd, 'run-new'),
      planPath: planFilePath(cwd, '42'),
      sideEffects: [
        { kind: 'mkdir', path: runDirPath(cwd, 'run-new') },
        { kind: 'write_file', path: runMetadataPath(cwd, 'run-new'), ifExists: 'overwrite' },
        { kind: 'mkdir', path: dirname(petriNetPath(cwd, 'run-new')) },
        { kind: 'write_file', path: petriPlanSnapshotPath(cwd, 'run-new') },
        { kind: 'write_file', path: petriNetPath(cwd, 'run-new') },
        { kind: 'write_file', path: petriSdcpnPath(cwd, 'run-new') },
        { kind: 'write_file', path: petriEventsPath(cwd, 'run-new') },
      ],
    });
    await expect(readFile(runMetadataPath(cwd, 'run-old'), 'utf8')).resolves.toBe(
      `${JSON.stringify(previous, null, 2)}\n`,
    );
    await expect(readFile(runMetadataPath(cwd, 'run-new'), 'utf8')).resolves.toContain(
      '"supersedesRunId": "run-old"',
    );
    await expect(readRunMetadata(runMetadataPath(cwd, 'run-new'))).resolves.toMatchObject({
      petriObservationPrepared: true,
    });
    await expect(pathExists(petriPlanSnapshotPath(cwd, 'run-new'))).resolves.toBe(true);
    await expect(pathExists(petriNetPath(cwd, 'run-new'))).resolves.toBe(true);
    await expect(pathExists(petriSdcpnPath(cwd, 'run-new'))).resolves.toBe(true);
    await expect(readFile(petriEventsPath(cwd, 'run-new'), 'utf8')).resolves.toBe('');
  });

  it('removes an unpublished replacement run when observer preparation fails', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-run-supersede-observer-failure-'));
    await writePlan(cwd);
    await writeRun(cwd, 'run-old');
    await writeFile(planFilePath(cwd, '42'), '{', 'utf8');

    await expect(
      createSupersedingRun({ cwd, previousRunId: 'run-old', runId: 'run-new', current }),
    ).rejects.toThrow();
    await expect(pathExists(runDirPath(cwd, 'run-new'))).resolves.toBe(false);
    await expect(pathExists(runMetadataPath(cwd, 'run-old'))).resolves.toBe(true);
  });

  it('preserves the previous run environment policy on the superseding run', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-run-supersede-environment-'));
    await writePlan(cwd);
    const previous = await writeRun(cwd, 'run-old');
    const previousWithEnvironment: RunMetadata = {
      ...previous,
      substrate: 'empty_dir',
      verifyTarget: { command: 'npm', args: ['test'] },
    };
    await writeFile(
      runMetadataPath(cwd, 'run-old'),
      `${JSON.stringify(previousWithEnvironment, null, 2)}\n`,
      'utf8',
    );

    const result = await createSupersedingRun({
      cwd,
      previousRunId: 'run-old',
      runId: 'run-new',
      current,
    });

    expect(result.status).toBe('created');
    await expect(readFile(runMetadataPath(cwd, 'run-new'), 'utf8')).resolves.toContain(
      '"substrate": "empty_dir"',
    );
    await expect(readFile(runMetadataPath(cwd, 'run-new'), 'utf8')).resolves.toContain('"command": "npm"');
  });
});
