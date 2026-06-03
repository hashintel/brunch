import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { defaultRunModel, planExecutionOrdering } from './cook-plan-llm-planning.js';
import { projectCookPlanFromSpec, type CompletedSpecSnapshot } from './cook-plan-projection.js';
import type { Plan } from './types.js';

const samplePlan: Plan = {
  epics: [{ id: 'default', summary: 'All requirements', depends_on: [], verification: [] }],
  slices: [
    { id: 'req-1', epic_id: 'default', definition: 'First requirement', depends_on: [], verification: [] },
    { id: 'req-2', epic_id: 'default', definition: 'Second requirement', depends_on: [], verification: [] },
  ],
};

describe('planExecutionOrdering', () => {
  it('returns succeeded with a parsed enrichment for a well-formed LLM response', async () => {
    const stubModelOutput = {
      sliceDependencies: [
        { sliceId: 'req-1', dependsOn: [] },
        { sliceId: 'req-2', dependsOn: ['req-1'] },
      ],
      epics: [
        { id: 'foundation', summary: 'Foundational work', sliceIds: ['req-1'] },
        { id: 'follow-on', summary: 'Built on the foundation', sliceIds: ['req-2'] },
      ],
      nonBuildableSliceIds: [],
    };

    const result = await planExecutionOrdering(samplePlan, async () => stubModelOutput);

    expect(result).toEqual({
      status: 'succeeded',
      enrichment: stubModelOutput,
    });
  });

  it('returns failed with the error message when runModel throws', async () => {
    const result = await planExecutionOrdering(samplePlan, async () => {
      throw new Error('upstream timeout');
    });

    expect(result.status).toBe('failed');
    if (result.status === 'failed') {
      expect(result.reason).toContain('upstream timeout');
    }
  });

  it('returns failed when the LLM output misses a required field', async () => {
    // Missing `nonBuildableSliceIds` — schema-required.
    const malformed = {
      sliceDependencies: [],
      epics: [],
    };

    const result = await planExecutionOrdering(samplePlan, async () => malformed);

    expect(result.status).toBe('failed');
    if (result.status === 'failed') {
      expect(result.reason.length).toBeGreaterThan(0);
    }
  });

  it('returns failed when the LLM output has a wrongly-typed field', async () => {
    const malformed = {
      sliceDependencies: [{ sliceId: 'req-1', dependsOn: 'not-an-array' }],
      epics: [],
      nonBuildableSliceIds: [],
    };

    const result = await planExecutionOrdering(samplePlan, async () => malformed);

    expect(result.status).toBe('failed');
  });

  it('does NOT semantically validate referenced ids — hallucinated slice ids parse as succeeded', async () => {
    // Slice 2 deliberately defers id-existence / cycle / dangle checks
    // to slice 3 (deterministic reconciliation). The schema must accept
    // a well-typed but semantically wrong response; this regression pin
    // protects that contract.
    const semanticallyWrong = {
      sliceDependencies: [{ sliceId: 'req-1', dependsOn: ['req-999-does-not-exist'] }],
      epics: [{ id: 'ghost-epic', summary: '', sliceIds: ['req-1', 'never-projected'] }],
      nonBuildableSliceIds: ['also-never-projected'],
    };

    const result = await planExecutionOrdering(samplePlan, async () => semanticallyWrong);

    expect(result.status).toBe('succeeded');
    if (result.status === 'succeeded') {
      expect(result.enrichment.sliceDependencies[0]!.dependsOn).toEqual(['req-999-does-not-exist']);
      expect(result.enrichment.nonBuildableSliceIds).toEqual(['also-never-projected']);
    }
  });

  it('includes every slice id and definition in the prompt the model receives', async () => {
    let capturedPrompt = '';
    await planExecutionOrdering(samplePlan, async (prompt) => {
      capturedPrompt = prompt;
      return {
        sliceDependencies: [],
        epics: [],
        nonBuildableSliceIds: [],
      };
    });

    for (const slice of samplePlan.slices) {
      expect(capturedPrompt).toContain(slice.id);
      expect(capturedPrompt).toContain(slice.definition);
    }
  });

  it('short-circuits on an empty Plan without calling runModel', async () => {
    const emptyPlan: Plan = {
      epics: [{ id: 'default', summary: 'All requirements', depends_on: [], verification: [] }],
      slices: [],
    };
    let runModelCalled = false;

    const result = await planExecutionOrdering(emptyPlan, async () => {
      runModelCalled = true;
      return {};
    });

    expect(runModelCalled).toBe(false);
    expect(result).toEqual({
      status: 'succeeded',
      enrichment: { sliceDependencies: [], epics: [], nonBuildableSliceIds: [] },
    });
  });

  // Opt-in middle-loop test. Skipped unless both PLANNING_REAL_LLM=1 and
  // ANTHROPIC_API_KEY are set, so it stays out of CI and the default
  // local `npm run verify`. Run with:
  //   PLANNING_REAL_LLM=1 ANTHROPIC_API_KEY=… npx vitest run \
  //     src/orchestrator/src/cook-plan-llm-planning.test.ts
  const realLlmEnabled = process.env.PLANNING_REAL_LLM === '1' && Boolean(process.env.ANTHROPIC_API_KEY);
  const itReal = realLlmEnabled ? it : it.skip;

  itReal(
    'real LLM: brunch_graphs fixture yields well-formed enrichment with non-trivial signal',
    async () => {
      const fixturePath = join(
        dirname(fileURLToPath(import.meta.url)),
        '__fixtures__',
        'brunch-graphs-snapshot.json',
      );
      const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as CompletedSpecSnapshot;
      const projected = projectCookPlanFromSpec(fixture);

      const result = await planExecutionOrdering(projected, defaultRunModel);

      expect(result.status).toBe('succeeded');
      if (result.status === 'succeeded') {
        const hasOrdering = result.enrichment.sliceDependencies.some((entry) => entry.dependsOn.length > 0);
        const hasNonBuildable = result.enrichment.nonBuildableSliceIds.length > 0;
        // The model should produce SOME signal on a non-trivial spec —
        // either an ordering edge or a non-buildable flag. If both come
        // back empty, the prompt is failing to convey what we want.
        expect(hasOrdering || hasNonBuildable).toBe(true);
      }
    },
    30_000,
  );
});
