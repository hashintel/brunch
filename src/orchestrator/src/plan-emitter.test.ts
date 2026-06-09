import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';
import { stringify as stringifyYaml } from 'yaml';

import { checkPlan } from './plan-contract.js';
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

  it('threads snapshot-derived relation hints into the planning prompt (FE-829 slice 3)', async () => {
    const relationalSnapshot: CompletedSpecSnapshot = {
      requirements: [
        { id: 10, content: 'First requirement', kindOrdinal: 1 },
        { id: 11, content: 'Second requirement', kindOrdinal: 2 },
      ],
      criteria: [],
      edges: [{ fromItemId: 11, toItemId: 10, relation: 'depends_on' }],
    };

    let capturedPrompt = '';
    const runModel: RunModel = async (prompt) => {
      capturedPrompt = prompt;
      return { sliceDependencies: [], epics: [], nonBuildableSliceIds: [] };
    };

    await emitPlanFromSnapshot(relationalSnapshot, { runModel });

    expect(capturedPrompt).toContain('req-11 depends_on req-10');
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

  it('emits a plan accepted by the strict (emitted) contract profile', async () => {
    const enrichment: PlanningEnrichment = {
      sliceDependencies: [{ sliceId: 'req-11', dependsOn: ['req-10'] }],
      epics: [{ id: 'core', summary: 'Core', sliceIds: ['req-10', 'req-11'] }],
      nonBuildableSliceIds: [],
    };
    const result = await emitPlanFromSnapshot(snapshot, { runModel: async () => enrichment });

    expect(checkPlan(result.plan, { profile: 'emitted' }).ok).toBe(true);
  });

  it('synthesizes the integration seam on a multi-slice epic and surfaces it as a typed warning', async () => {
    const enrichment: PlanningEnrichment = {
      sliceDependencies: [{ sliceId: 'req-11', dependsOn: ['req-10'] }],
      epics: [{ id: 'core', summary: 'Core', sliceIds: ['req-10', 'req-11'] }],
      nonBuildableSliceIds: [],
    };
    const result = await emitPlanFromSnapshot(snapshot, { runModel: async () => enrichment });

    const core = result.plan.epics.find((e) => e.id === 'core')!;
    expect(core.verification).toContainEqual({
      kind: 'integration-test',
      target: 'tests/core.integration.test.ts',
    });

    const seam = result.warnings.find((w) => w.code === 'synthesized-integration-seam');
    expect(seam).toEqual({
      code: 'synthesized-integration-seam',
      epicId: 'core',
      target: 'tests/core.integration.test.ts',
    });
    expect(emitterWarningCategory(seam!)).toBe('synthesis');
    expect(formatEmitterWarning(seam!)).toContain('synthesized-integration-seam');
  });

  it('does not synthesize a seam when every epic is single-slice', async () => {
    const enrichment: PlanningEnrichment = {
      sliceDependencies: [],
      epics: [
        { id: 'one', summary: 'One', sliceIds: ['req-10'] },
        { id: 'two', summary: 'Two', sliceIds: ['req-11'] },
      ],
      nonBuildableSliceIds: [],
    };
    const result = await emitPlanFromSnapshot(snapshot, { runModel: async () => enrichment });
    expect(result.warnings.some((w) => w.code === 'synthesized-integration-seam')).toBe(false);
    expect(checkPlan(result.plan, { profile: 'emitted' }).ok).toBe(true);
  });

  it('resolves the toolchain from the spec profile — brunch profile yields co-located targets', async () => {
    const enrichment: PlanningEnrichment = {
      sliceDependencies: [{ sliceId: 'req-11', dependsOn: ['req-10'] }],
      epics: [{ id: 'core', summary: 'Core', sliceIds: ['req-10', 'req-11'] }],
      nonBuildableSliceIds: [],
    };
    const result = await emitPlanFromSnapshot(
      { ...snapshot, profile: 'brunch' },
      { runModel: async () => enrichment },
    );

    expect(result.plan.profile).toBe('brunch');
    // Co-located convention: no `tests/` prefix on slice or epic targets.
    for (const slice of result.plan.slices) {
      expect(slice.verification).toEqual([{ kind: 'unit-test', target: `${slice.id}.test.ts` }]);
    }
    const core = result.plan.epics.find((e) => e.id === 'core')!;
    expect(core.verification).toContainEqual({
      kind: 'integration-test',
      target: 'core.integration.test.ts',
    });
  });

  it('defaults to the bun toolchain when the spec carries no profile', async () => {
    const result = await emitPlanFromSnapshot(snapshot, {
      runModel: async () => ({ sliceDependencies: [], epics: [], nonBuildableSliceIds: [] }),
    });
    for (const slice of result.plan.slices) {
      expect(slice.verification).toEqual([{ kind: 'unit-test', target: `tests/${slice.id}.test.ts` }]);
    }
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
