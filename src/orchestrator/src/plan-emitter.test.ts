import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { stringify as stringifyYaml } from 'yaml';

import type { ArchitectDraft, RunModel } from './plan-architect.js';
import { checkPlan } from './plan-contract.js';
import { emitPlanFromSnapshot, emitterWarningCategory, formatEmitterWarning } from './plan-emitter.js';
import { evaluatePlanShape } from './plan-eval.js';
import { loadPlan } from './plan-loader.js';
import type { CompletedSpecSnapshot } from './plan-projection.js';
import type { ProfileDetection } from './project-detect.js';

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

  it('falls back when the architect authors zero slices and marks every requirement non-buildable', async () => {
    // Degenerate draft: no slices, no epics, but all projected requirements
    // declared non-buildable so coverage is vacuously satisfied. Without the
    // guard this passes the emitted contract and ships an empty plan.yaml.
    const draft: ArchitectDraft = {
      epics: [],
      slices: [],
      nonBuildableRequirementIds: ['req-10', 'req-11'],
    };
    const result = await emitPlanFromSnapshot(snapshot, { runModel: draftModel(draft) });

    // The deterministic projection re-establishes the req-* slices.
    expect(result.plan.slices.map((s) => s.id)).toEqual(['req-10', 'req-11']);
    const fb = result.warnings.find((w) => w.code === 'architect-failed-fallback-to-projection');
    expect(fb).toBeDefined();
    if (fb && fb.code === 'architect-failed-fallback-to-projection') {
      expect(fb.reason).toContain('no buildable slices');
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

  it('stamps the bun default when the snapshot has no profile', async () => {
    const result = await emitPlanFromSnapshot(snapshot, { runModel: draftModel(coveringDraft()) });
    expect(result.plan.profile).toBe('bun');
  });

  it('explicit profile option wins over the snapshot profile', async () => {
    const result = await emitPlanFromSnapshot(
      { ...snapshot, profile: 'brunch' },
      { runModel: draftModel(coveringDraft()), profile: 'node-vitest' },
    );

    expect(result.plan.profile).toBe('node-vitest');
    // Targets follow the override, not the snapshot profile.
    for (const slice of result.plan.slices) {
      expect(slice.verification).toEqual([{ kind: 'unit-test', target: `tests/${slice.id}.test.ts` }]);
    }
  });

  it('uses the architect-classified profile when flag and snapshot are silent', async () => {
    const result = await emitPlanFromSnapshot(snapshot, {
      runModel: draftModel({ ...coveringDraft(), profile: 'deno' }),
    });
    expect(result.plan.profile).toBe('deno');
  });

  it('snapshot profile beats the architect-classified one; flag beats both', async () => {
    const draft = { ...coveringDraft(), profile: 'deno' as const };

    const fromSnapshot = await emitPlanFromSnapshot(
      { ...snapshot, profile: 'brunch' },
      { runModel: draftModel(draft) },
    );
    expect(fromSnapshot.plan.profile).toBe('brunch');

    const fromFlag = await emitPlanFromSnapshot(
      { ...snapshot, profile: 'brunch' },
      { runModel: draftModel(draft), profile: 'node-vitest' },
    );
    expect(fromFlag.plan.profile).toBe('node-vitest');
  });

  it('a hallucinated architect profile fails authoring and falls back to bun', async () => {
    const result = await emitPlanFromSnapshot(snapshot, {
      runModel: draftModel({ ...coveringDraft(), profile: 'rust' } as never),
    });

    expect(result.architectResult.status).toBe('failed');
    expect(result.plan.profile).toBe('bun');
    expect(result.warnings.some((w) => w.code === 'architect-failed-fallback-to-projection')).toBe(true);
  });

  it('stamps the resolved profile on the fallback path too', async () => {
    const throwingModel: RunModel = async () => {
      throw new Error('boom');
    };
    const result = await emitPlanFromSnapshot(snapshot, {
      runModel: throwingModel,
      profile: 'node-vitest',
    });

    expect(result.architectResult.status).toBe('failed');
    expect(result.plan.profile).toBe('node-vitest');
  });

  it('brownfield detection resolves the profile and beats the spec profile', async () => {
    const detect = (): ProfileDetection => ({ detected: true, profile: 'node-vitest', evidence: 'stub' });
    const result = await emitPlanFromSnapshot(
      { ...snapshot, mode: 'brownfield', profile: 'brunch' },
      { runModel: draftModel(coveringDraft()), repoDir: '/repo', detect },
    );
    expect(result.plan.profile).toBe('node-vitest');
  });

  it('the --profile flag beats detection and skips reading the repo', async () => {
    const detect = (): ProfileDetection => {
      throw new Error('detect should not run when --profile is set');
    };
    const result = await emitPlanFromSnapshot(
      { ...snapshot, mode: 'brownfield' },
      { runModel: draftModel(coveringDraft()), profile: 'deno', repoDir: '/repo', detect },
    );
    expect(result.plan.profile).toBe('deno');
  });

  it('a failed detection falls through to an explicit spec profile, not bun', async () => {
    const detect = (): ProfileDetection => ({ detected: false, reason: 'no recognizable manifest' });
    const result = await emitPlanFromSnapshot(
      { ...snapshot, mode: 'brownfield', profile: 'brunch' },
      { runModel: draftModel(coveringDraft()), repoDir: '/repo', detect },
    );
    expect(result.plan.profile).toBe('brunch');
  });

  it('a failed detection with no spec/architect signal fails loudly instead of defaulting to bun', async () => {
    const detect = (): ProfileDetection => ({ detected: false, reason: 'no recognizable manifest' });
    await expect(
      emitPlanFromSnapshot(
        { ...snapshot, mode: 'brownfield' },
        { runModel: draftModel(coveringDraft()), repoDir: '/repo', detect },
      ),
    ).rejects.toThrow(/brunch detect/);
  });

  it('greenfield never detects even when a repoDir is supplied (protecting invariant)', async () => {
    const detect = (): ProfileDetection => {
      throw new Error('greenfield must not detect');
    };
    const result = await emitPlanFromSnapshot(snapshot, {
      runModel: draftModel(coveringDraft()),
      repoDir: '/repo',
      detect,
    });
    expect(result.plan.profile).toBe('bun');
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

// Opt-in middle-loop smoke. Skipped unless both PLANNING_REAL_LLM=1 and
// ANTHROPIC_API_KEY are set, so it stays out of CI and the default local
// `npm run verify`. Exercises the production architect adapter end-to-end and
// scores its output through the eval harness (the I134-K acceptance gate),
// codifying that real emitted plans pass the same oracle as the reference
// fixtures. Run with:
//   PLANNING_REAL_LLM=1 ANTHROPIC_API_KEY=… npx vitest run \
//     src/orchestrator/src/plan-emitter.test.ts
describe('emitPlanFromSnapshot — real LLM eval smoke', () => {
  const realLlmEnabled = process.env.PLANNING_REAL_LLM === '1' && Boolean(process.env.ANTHROPIC_API_KEY);
  const itReal = realLlmEnabled ? it : it.skip;

  itReal(
    'the real architect emits a plan the eval harness accepts',
    async () => {
      const fixturePath = join(
        dirname(fileURLToPath(import.meta.url)),
        '__fixtures__',
        'brunch-graphs-snapshot.json',
      );
      const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as CompletedSpecSnapshot;

      // No runModel override → the production defaultArchitectRunModel.
      const { plan } = await emitPlanFromSnapshot(fixture);
      const report = evaluatePlanShape(plan);

      expect(report.hardFailures).toEqual([]);
      expect(report.verdict).toBe('accept');
    },
    60_000,
  );
});
