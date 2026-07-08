import { access, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { LaunchCurrentProjection } from '../launch.js';
import { prepareLaunch } from '../launch.js';
import { planFilePath, planProvenancePath } from '../plan-file.js';

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

describe('prepareLaunch', () => {
  it('reports a missing spec-scoped plan without creating run resources', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-cook-launch-missing-'));
    const result = await prepareLaunch({ cwd, specId: '42', current });

    expect(result).toEqual({
      status: 'missing_plan',
      runStatus: 'not_started',
      planPath: planFilePath(cwd, '42'),
      current,
      sideEffects: [],
    });
    expect(await pathExists(join(cwd, '.brunch', 'cook', 'runs'))).toBe(false);
  });

  it('requires provenance before reporting a bounded plan file ready', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-cook-launch-ready-'));
    const planPath = planFilePath(cwd, '42');
    await mkdir(join(cwd, '.brunch', 'cook', 'specs', '42'), { recursive: true });
    await writeFile(planPath, '{"mode":"greenfield","epics":[],"slices":[]}', 'utf8');

    const result = await prepareLaunch({ cwd, specId: '42', current });

    expect(result).toEqual({
      status: 'missing_provenance',
      runStatus: 'not_started',
      planPath,
      current,
      sideEffects: [],
    });
    expect(await pathExists(join(cwd, '.brunch', 'cook', 'runs'))).toBe(false);
    expect(await pathExists(join(cwd, '.brunch', 'cook', 'petrinaut'))).toBe(false);
  });

  it('reports stale when plan provenance does not match the current graph projection', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-cook-launch-stale-'));
    const planPath = planFilePath(cwd, '42');
    const provenancePath = planProvenancePath(cwd, '42');
    await mkdir(join(cwd, '.brunch', 'cook', 'specs', '42'), { recursive: true });
    await writeFile(planPath, '{"mode":"greenfield","epics":[],"slices":[]}', 'utf8');
    const staleProvenance = {
      schemaVersion: 1,
      specId: '42',
      mode: 'greenfield',
      source: { graphLsn: 10, visibility: 'active' },
    };
    await writeFile(provenancePath, `${JSON.stringify(staleProvenance)}\n`, 'utf8');

    const result = await prepareLaunch({ cwd, specId: '42', current });

    expect(result).toEqual({
      status: 'stale_plan',
      runStatus: 'not_started',
      planPath,
      current,
      provenance: staleProvenance,
      sideEffects: [],
    });
  });

  it('blocks launch when the current projection is blocked even if an old plan exists', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-cook-launch-blocked-'));
    const planPath = planFilePath(cwd, '42');
    await mkdir(join(cwd, '.brunch', 'cook', 'specs', '42'), { recursive: true });
    await writeFile(planPath, '{"mode":"greenfield","epics":[],"slices":[]}', 'utf8');
    await writeFile(
      planProvenancePath(cwd, '42'),
      `${JSON.stringify({ schemaVersion: 1, specId: '42', mode: 'greenfield', source: current.source })}\n`,
      'utf8',
    );
    const blocked = { ...current, checkStatus: 'blocked' as const };

    const result = await prepareLaunch({ cwd, specId: '42', current: blocked });

    expect(result).toEqual({
      status: 'blocked_projection',
      runStatus: 'not_started',
      planPath,
      current: blocked,
      sideEffects: [],
    });
  });

  it('reports a ready request when plan provenance matches current graph projection', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-cook-launch-ready-'));
    const planPath = planFilePath(cwd, '42');
    const provenance = {
      schemaVersion: 1 as const,
      specId: '42',
      mode: 'greenfield' as const,
      source: current.source,
    };
    await mkdir(join(cwd, '.brunch', 'cook', 'specs', '42'), { recursive: true });
    await writeFile(planPath, '{"mode":"greenfield","epics":[],"slices":[]}', 'utf8');
    await writeFile(planProvenancePath(cwd, '42'), `${JSON.stringify(provenance)}\n`, 'utf8');

    const result = await prepareLaunch({ cwd, specId: '42', current });

    expect(result).toEqual({
      status: 'ready',
      runStatus: 'not_started',
      planPath,
      current,
      provenance,
      sideEffects: [],
    });
    expect(await pathExists(join(cwd, '.brunch', 'cook', 'runs'))).toBe(false);
    expect(await pathExists(join(cwd, '.brunch', 'cook', 'petrinaut'))).toBe(false);
  });

  it('rejects an explicit plan path outside the selected spec plan file without probing it', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-cook-launch-bounded-'));
    const outside = join(await mkdtemp(join(tmpdir(), 'brunch-cook-launch-outside-')), 'plan.yaml');
    await writeFile(outside, '{"mode":"greenfield","epics":[],"slices":[]}', 'utf8');

    const result = await prepareLaunch({ cwd, specId: '42', planPath: outside, current });

    expect(result).toEqual({
      status: 'invalid_plan_path',
      runStatus: 'not_started',
      planPath: outside,
      current,
      sideEffects: [],
    });
  });
});
