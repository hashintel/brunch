import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';
import { stringify as stringifyYaml } from 'yaml';

import type { ArchitectDraft, RunModel } from './plan-architect.js';
import { checkPlan } from './plan-contract.js';
import { emitPlanFromSnapshot, emitterWarningCategory, formatEmitterWarning } from './plan-emitter.js';
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

/** A well-formed authored draft covering both requirements (req-10, req-11). */
function coveringDraft(): ArchitectDraft {
  return {
    epics: [{ id: 'core', summary: 'Core' }],
    slices: [
      {
        id: 'scaffold',
        epic_id: 'core',
        definition: 'Project setup',
        depends_on: [],
        writes: ['package.json'],
        derivedFrom: [],
      },
      {
        id: 'feat-a',
        epic_id: 'core',
        definition: 'Behaviour A',
        depends_on: ['scaffold'],
        writes: ['src/a.ts'],
        derivedFrom: ['req-10'],
      },
      {
        id: 'feat-b',
        epic_id: 'core',
        definition: 'Behaviour B',
        depends_on: ['scaffold'],
        writes: ['src/b.ts'],
        derivedFrom: ['req-11'],
      },
    ],
    nonBuildableRequirementIds: [],
  };
}

const draftModel =
  (draft: ArchitectDraft): RunModel =>
  async () =>
    draft;

describe('emitPlanFromSnapshot', () => {
  it('materializes an authored, decomposed plan (FE-829 slice 4B)', async () => {
    const result = await emitPlanFromSnapshot(snapshot, { runModel: draftModel(coveringDraft()) });

    expect(result.architectResult.status).toBe('succeeded');
    expect(result.plan.slices.map((s) => s.id)).toEqual(['scaffold', 'feat-a', 'feat-b']);
    expect(result.plan.epics.map((e) => e.id)).toEqual(['core']);
    // Authored writes survive.
    expect(result.plan.slices.find((s) => s.id === 'feat-a')!.writes).toEqual(['src/a.ts']);
    // Verification targets are synthesized deterministically (architect authors none).
    for (const slice of result.plan.slices) {
      expect(slice.verification).toEqual([{ kind: 'unit-test', target: `tests/${slice.id}.test.ts` }]);
    }
    // Contract gate passes under the strict emitted profile.
    expect(checkPlan(result.plan, { profile: 'emitted' }).ok).toBe(true);
  });

  it('appends a requirement\u2019s acceptance criteria into the derived slice definition', async () => {
    const result = await emitPlanFromSnapshot(snapshot, { runModel: draftModel(coveringDraft()) });
    // feat-a derivedFrom req-10, which criterion 20 verifies.
    const featA = result.plan.slices.find((s) => s.id === 'feat-a')!;
    expect(featA.definition).toContain('A criterion');
  });

  it('threads snapshot-derived relation hints into the architect prompt (FE-829 slice 3)', async () => {
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
      return coveringDraft();
    };

    await emitPlanFromSnapshot(relationalSnapshot, { runModel });

    expect(capturedPrompt).toContain('req-11 depends_on req-10');
  });

  it('drops an unknown requirement ref with a typed warning', async () => {
    const draft = coveringDraft();
    draft.slices[1]!.derivedFrom = ['req-10', 'req-999'];
    const result = await emitPlanFromSnapshot(snapshot, { runModel: draftModel(draft) });

    const dropped = result.warnings.find((w) => w.code === 'dropped-unknown-requirement-ref');
    expect(dropped).toEqual({
      code: 'dropped-unknown-requirement-ref',
      sliceId: 'feat-a',
      requirementId: 'req-999',
    });
  });

  it('falls back to the projected plan when the runModel throws (no second LLM call)', async () => {
    const runModel: RunModel = async () => {
      throw new Error('boom');
    };
    const result = await emitPlanFromSnapshot(snapshot, { runModel });

    expect(result.architectResult.status).toBe('failed');
    // Deterministic fallback emits the projected req-* slices.
    expect(result.plan.slices.map((s) => s.id)).toEqual(['req-10', 'req-11']);
    const fb = result.warnings.find((w) => w.code === 'architect-failed-fallback-to-projection');
    expect(fb).toBeDefined();
    if (fb && fb.code === 'architect-failed-fallback-to-projection') {
      expect(fb.reason).toContain('boom');
    }
    expect(checkPlan(result.plan, { profile: 'emitted' }).ok).toBe(true);
  });

  it('falls back when the authored plan leaves a requirement uncovered', async () => {
    const draft = coveringDraft();
    // feat-b no longer derives from req-11 → req-11 uncovered.
    draft.slices[2]!.derivedFrom = [];
    const result = await emitPlanFromSnapshot(snapshot, { runModel: draftModel(draft) });

    expect(result.plan.slices.map((s) => s.id)).toEqual(['req-10', 'req-11']);
    const fb = result.warnings.find((w) => w.code === 'architect-failed-fallback-to-projection');
    expect(fb).toBeDefined();
    if (fb && fb.code === 'architect-failed-fallback-to-projection') {
      expect(fb.reason).toContain('uncovered-requirement');
    }
  });

  it('falls back when the architect output is malformed (parse error)', async () => {
    const result = await emitPlanFromSnapshot(snapshot, {
      runModel: async () => ({ epics: [], slices: [{ id: 'x' }] }),
    });
    expect(result.architectResult.status).toBe('failed');
    expect(result.warnings.some((w) => w.code === 'architect-failed-fallback-to-projection')).toBe(true);
  });

  it('surfaces a file-write-conflict as a warning but still emits (FE-829 slice 4)', async () => {
    const draft = coveringDraft();
    draft.slices[1]!.writes = ['src/shared.ts'];
    draft.slices[2]!.writes = ['src/shared.ts'];
    const result = await emitPlanFromSnapshot(snapshot, { runModel: draftModel(draft) });

    expect(result.architectResult.status).toBe('succeeded');
    const conflict = result.warnings.find((w) => w.code === 'file-write-conflict');
    expect(conflict).toEqual({
      code: 'file-write-conflict',
      severity: 'warning',
      path: 'src/shared.ts',
      sliceIds: ['feat-a', 'feat-b'],
    });
  });

  it('synthesizes the integration seam on the multi-slice epic as a typed warning', async () => {
    const result = await emitPlanFromSnapshot(snapshot, { runModel: draftModel(coveringDraft()) });
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
  });

  it('categorizes and formats the new emitter warning codes', async () => {
    const failure = await emitPlanFromSnapshot(snapshot, {
      runModel: async () => {
        throw new Error('x');
      },
    });
    const fb = failure.warnings.find((w) => w.code === 'architect-failed-fallback-to-projection')!;
    expect(emitterWarningCategory(fb)).toBe('failure');
    expect(formatEmitterWarning(fb)).toContain('architect-failed-fallback-to-projection');

    const success = await emitPlanFromSnapshot(snapshot, { runModel: draftModel(coveringDraft()) });
    const synthesis = success.warnings.find((w) => w.code === 'synthesized-verification-target')!;
    expect(emitterWarningCategory(synthesis)).toBe('synthesis');
  });

  it('resolves the toolchain from the spec profile — brunch yields co-located targets', async () => {
    const result = await emitPlanFromSnapshot(
      { ...snapshot, profile: 'brunch' },
      { runModel: draftModel(coveringDraft()) },
    );

    expect(result.plan.profile).toBe('brunch');
    for (const slice of result.plan.slices) {
      expect(slice.verification).toEqual([{ kind: 'unit-test', target: `${slice.id}.test.ts` }]);
    }
    const core = result.plan.epics.find((e) => e.id === 'core')!;
    expect(core.verification).toContainEqual({
      kind: 'integration-test',
      target: 'core.integration.test.ts',
    });
  });

  it('round-trips the emitted plan (incl. writes) through loadPlan after YAML serialization', async () => {
    const result = await emitPlanFromSnapshot(snapshot, { runModel: draftModel(coveringDraft()) });

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
