import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';
import { stringify as stringifyYaml } from 'yaml';

import { emitCookPlanFromSnapshot } from './cook-plan-emitter.js';
import type { PlanningEnrichment, RunModel } from './cook-plan-llm-planning.js';
import type { CompletedSpecSnapshot } from './cook-plan-projection.js';
import { loadPlan } from './plan-loader.js';

const snapshot: CompletedSpecSnapshot = {
  requirements: [
    { id: 10, content: 'First requirement', kindOrdinal: 1 },
    { id: 11, content: 'Second requirement', kindOrdinal: 2 },
  ],
  criteria: [{ id: 20, content: 'A criterion', kindOrdinal: 1 }],
  edges: [{ fromItemId: 20, toItemId: 10, relation: 'verifies' }],
};

describe('emitCookPlanFromSnapshot', () => {
  it('composes projection + planning + reconciliation with an injected runModel', async () => {
    const enrichment: PlanningEnrichment = {
      sliceDependencies: [{ sliceId: 'req-2', dependsOn: ['req-1'] }],
      epics: [{ id: 'core', summary: 'Core', sliceIds: ['req-1', 'req-2'] }],
      nonBuildableSliceIds: [],
    };
    const runModel: RunModel = async () => enrichment;

    const result = await emitCookPlanFromSnapshot(snapshot, { runModel });

    expect(result.planningResult.status).toBe('succeeded');
    expect(result.plan.slices.map((s) => s.id)).toEqual(['req-1', 'req-2']);
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

    const result = await emitCookPlanFromSnapshot(snapshot, { runModel });

    expect(result.planningResult.status).toBe('failed');
    if (result.planningResult.status === 'failed') {
      expect(result.planningResult.reason).toContain('boom');
    }
    // Plan still usable — slices present, synthesized verification, no deps.
    expect(result.plan.slices.map((s) => s.id)).toEqual(['req-1', 'req-2']);
    for (const slice of result.plan.slices) {
      expect(slice.depends_on).toEqual([]);
      expect(slice.verification).toEqual([{ kind: 'unit-test', target: `tests/${slice.id}.test.ts` }]);
    }
  });

  it('round-trips through loadPlan after YAML serialization', async () => {
    const runModel: RunModel = async () => ({
      sliceDependencies: [],
      epics: [],
      nonBuildableSliceIds: [],
    });

    const result = await emitCookPlanFromSnapshot(snapshot, { runModel });

    const dir = mkdtempSync(join(tmpdir(), 'cook-plan-emitter-'));
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
