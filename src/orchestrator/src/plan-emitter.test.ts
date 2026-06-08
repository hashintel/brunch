import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';
import { stringify as stringifyYaml } from 'yaml';

import { emitPlanFromSnapshot, emitterWarningCategory, formatEmitterWarning } from './plan-emitter.js';
import type { PlanningEnrichment, RunModel } from './plan-llm-planning.js';
import { loadPlan } from './plan-loader.js';
import type { CompletedSpecSnapshot } from './plan-projection.js';

const snapshot: CompletedSpecSnapshot = {
  requirements: [
    { id: 10, content: 'First requirement', kindOrdinal: 1 },
    { id: 11, content: 'Second requirement', kindOrdinal: 2 },
  ],
  criteria: [{ id: 20, content: 'A criterion', kindOrdinal: 1 }],
  edges: [{ fromItemId: 20, toItemId: 10, relation: 'verifies' }],
};

describe('emitPlanFromSnapshot', () => {
  it('composes projection + planning + reconciliation with an injected runModel', async () => {
    const enrichment: PlanningEnrichment = {
      sliceDependencies: [{ sliceId: 'req-11', dependsOn: ['req-10'] }],
      epics: [{ id: 'core', summary: 'Core', sliceIds: ['req-10', 'req-11'] }],
      nonBuildableSliceIds: [],
    };
    const runModel: RunModel = async () => enrichment;

    const result = await emitPlanFromSnapshot(snapshot, { runModel });

    expect(result.planningResult.status).toBe('succeeded');
    expect(result.plan.slices.map((s) => s.id)).toEqual(['req-10', 'req-11']);
    expect(result.plan.epics.map((e) => e.id)).toEqual(['core']);
    for (const slice of result.plan.slices) {
      expect(slice.verification).toEqual([{ kind: 'unit-test', target: `tests/${slice.id}.test.ts` }]);
    }
    // Reconciliation warning surfaces synthesis events at minimum.
    expect(result.warnings.some((w) => w.code === 'synthesized-verification-target')).toBe(true);
  });

  it('falls back to an empty enrichment when the runModel throws — plan still emits, planningResult is failed', async () => {
    const runModel: RunModel = async () => {
      throw new Error('boom');
    };

    const result = await emitPlanFromSnapshot(snapshot, { runModel });

    expect(result.planningResult.status).toBe('failed');
    if (result.planningResult.status === 'failed') {
      expect(result.planningResult.reason).toContain('boom');
    }
    // Plan still usable — slices present, synthesized verification, no deps.
    expect(result.plan.slices.map((s) => s.id)).toEqual(['req-10', 'req-11']);
    for (const slice of result.plan.slices) {
      expect(slice.depends_on).toEqual([]);
      expect(slice.verification).toEqual([{ kind: 'unit-test', target: `tests/${slice.id}.test.ts` }]);
    }
  });

  it('pushes exactly one planning-failed warning when the runModel throws (single audit stream)', async () => {
    const runModel: RunModel = async () => {
      throw new Error('llm-down');
    };

    const result = await emitPlanFromSnapshot(snapshot, { runModel });

    const failures = result.warnings.filter((w) => w.code === 'planning-failed');
    expect(failures).toHaveLength(1);
    expect(failures[0]!.code).toBe('planning-failed');
    if (failures[0]!.code === 'planning-failed') {
      expect(failures[0]!.reason).toContain('llm-down');
    }
  });

  it('does not push a planning-failed warning when the runModel succeeds', async () => {
    const runModel: RunModel = async () => ({
      sliceDependencies: [],
      epics: [],
      nonBuildableSliceIds: [],
    });

    const result = await emitPlanFromSnapshot(snapshot, { runModel });

    expect(result.warnings.some((w) => w.code === 'planning-failed')).toBe(false);
  });

  it('categorizes planning-failed as failure and delegates other codes to reconciliation', async () => {
    const failure = await emitPlanFromSnapshot(snapshot, {
      runModel: async () => {
        throw new Error('x');
      },
    });
    const failureWarning = failure.warnings.find((w) => w.code === 'planning-failed')!;
    expect(emitterWarningCategory(failureWarning)).toBe('failure');
    expect(formatEmitterWarning(failureWarning)).toContain('planning-failed');

    const success = await emitPlanFromSnapshot(snapshot, {
      runModel: async () => ({ sliceDependencies: [], epics: [], nonBuildableSliceIds: [] }),
    });
    const synthesis = success.warnings.find((w) => w.code === 'synthesized-verification-target')!;
    expect(emitterWarningCategory(synthesis)).toBe('synthesis');
  });

  it('round-trips through loadPlan after YAML serialization', async () => {
    const runModel: RunModel = async () => ({
      sliceDependencies: [],
      epics: [],
      nonBuildableSliceIds: [],
    });

    const result = await emitPlanFromSnapshot(snapshot, { runModel });

    const dir = mkdtempSync(join(tmpdir(), 'plan-emitter-'));
    const yamlPath = join(dir, 'plan.yaml');
    writeFileSync(yamlPath, stringifyYaml(result.plan));
    const reloaded = loadPlan(yamlPath);

    expect(reloaded).toEqual(result.plan);

    const epicIds = new Set(reloaded.epics.map((e) => e.id));
    for (const slice of reloaded.slices) {
      expect(epicIds.has(slice.epic_id)).toBe(true);
    }
  });
});
