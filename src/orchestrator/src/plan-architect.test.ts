// FE-829 slice 4B: tests for the build-architect AUTHORING stage.
//
// Deterministic plumbing only — schema validation, prompt construction,
// recoverable failure. Model decomposition QUALITY is deferred to the
// slice-5 eval harness + the opt-in real-LLM smoke.

import { describe, expect, it } from 'vitest';

import { architectDraftSchema, architectPlan, DEFAULT_ARCHITECT_MODEL_ID } from './plan-architect.js';
import type { Plan } from './types.js';

const projected: Plan = {
  mode: 'greenfield',
  profile: undefined,
  epics: [{ id: 'default', summary: 'All requirements', depends_on: [], verification: [] }],
  slices: [
    {
      id: 'req-1',
      epic_id: 'default',
      definition: 'First requirement',
      depends_on: [],
      verification: [{ kind: 'criterion', target: 'the widget renders within 100ms' }],
    },
    { id: 'req-2', epic_id: 'default', definition: 'Second requirement', depends_on: [], verification: [] },
  ],
};

const wellFormed = {
  epics: [{ id: 'core', summary: 'Core' }],
  slices: [
    {
      id: 'scaffold',
      epic_id: 'core',
      definition: 'setup',
      depends_on: [],
      writes: ['package.json'],
      derivedFrom: [],
    },
    {
      id: 'a',
      epic_id: 'core',
      definition: 'A',
      depends_on: ['scaffold'],
      writes: ['src/a.ts'],
      derivedFrom: ['req-1'],
    },
  ],
  nonBuildableRequirementIds: ['req-2'],
};

describe('architectPlan', () => {
  it('defaults the production architect to the current Opus model', () => {
    expect(DEFAULT_ARCHITECT_MODEL_ID).toBe('claude-opus-4-8');
  });

  it('parses a well-formed authored draft', async () => {
    const result = await architectPlan(projected, async () => wellFormed);
    expect(result.status).toBe('succeeded');
    if (result.status === 'succeeded') {
      expect(result.draft.slices.map((s) => s.id)).toEqual(['scaffold', 'a']);
      expect(result.draft.slices[1]!.writes).toEqual(['src/a.ts']);
      expect(result.draft.slices[1]!.derivedFrom).toEqual(['req-1']);
      expect(result.draft.nonBuildableRequirementIds).toEqual(['req-2']);
    }
  });

  it('rejects duplicate epic ids in the architect draft schema', () => {
    const parsed = architectDraftSchema.safeParse({
      epics: [
        { id: 'core', summary: 'Core' },
        { id: 'core', summary: 'Duplicate core' },
      ],
      slices: [
        {
          id: 'a',
          epic_id: 'core',
          definition: 'A',
          depends_on: [],
          writes: ['src/a.ts'],
          derivedFrom: ['req-1'],
        },
      ],
      nonBuildableRequirementIds: [],
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((issue) => issue.message.includes('Duplicate epic id'))).toBe(true);
    }
  });

  it('fails when a slice is missing writes or derivedFrom', async () => {
    const malformed = {
      epics: [{ id: 'core', summary: 'Core' }],
      slices: [{ id: 'a', epic_id: 'core', definition: 'A', depends_on: [] }],
      nonBuildableRequirementIds: [],
    };
    const result = await architectPlan(projected, async () => malformed);
    expect(result.status).toBe('failed');
  });

  it('collapses a thrown runModel to a recoverable failure', async () => {
    const result = await architectPlan(projected, async () => {
      throw new Error('upstream timeout');
    });
    expect(result.status).toBe('failed');
    if (result.status === 'failed') expect(result.reason).toContain('upstream timeout');
  });

  it('short-circuits an empty projection without calling runModel', async () => {
    let called = false;
    const empty: Plan = { mode: 'greenfield', epics: [], slices: [] };
    const result = await architectPlan(empty, async () => {
      called = true;
      return wellFormed;
    });
    expect(called).toBe(false);
    expect(result.status).toBe('succeeded');
  });

  it('accepts an optional profile classification (id or null) in the draft schema', async () => {
    const withProfile = await architectPlan(projected, async () => ({ ...wellFormed, profile: 'deno' }));
    expect(withProfile.status).toBe('succeeded');
    if (withProfile.status === 'succeeded') expect(withProfile.draft.profile).toBe('deno');

    const silent = await architectPlan(projected, async () => ({ ...wellFormed, profile: null }));
    expect(silent.status).toBe('succeeded');

    const invalid = await architectPlan(projected, async () => ({ ...wellFormed, profile: 'rust' }));
    expect(invalid.status).toBe('failed');
  });

  it('accepts an optional harnessNotes string in the draft schema (FE-894 ① 1b)', async () => {
    const notes = 'Code-split routes mount via the real router; React Flow needs a headless shim.';
    const withNotes = await architectPlan(projected, async () => ({ ...wellFormed, harnessNotes: notes }));
    expect(withNotes.status).toBe('succeeded');
    if (withNotes.status === 'succeeded') expect(withNotes.draft.harnessNotes).toBe(notes);

    // omitting it stays valid (optional)
    const without = await architectPlan(projected, async () => wellFormed);
    expect(without.status).toBe('succeeded');
    if (without.status === 'succeeded') expect(without.draft.harnessNotes).toBeUndefined();
  });

  it('prompts the architect to emit harness prior-art, not test-runner conventions (FE-894 ① 1b)', async () => {
    let prompt = '';
    await architectPlan(projected, async (p) => {
      prompt = p;
      return wellFormed;
    });
    expect(prompt).toContain('`harnessNotes`');
  });

  it('prompts for profile classification from spec prose only, listing valid ids', async () => {
    let prompt = '';
    await architectPlan(projected, async (p) => {
      prompt = p;
      return wellFormed;
    });

    expect(prompt).toContain('`profile`');
    expect(prompt).toContain('node-vitest');
    expect(prompt).toContain('null');
  });

  it('builds a prompt that demands writes, derivedFrom, decomposition, and criteria + bans test authoring', async () => {
    let prompt = '';
    await architectPlan(
      projected,
      async (p) => {
        prompt = p;
        return wellFormed;
      },
      { relations: [{ fromSliceId: 'req-2', relation: 'depends_on', toSliceId: 'req-1' }] },
    );

    expect(prompt).toContain('`writes`');
    expect(prompt).toContain('`derivedFrom`');
    expect(prompt).toContain('Decompose');
    // requirement criteria carried into the prompt
    expect(prompt).toContain('the widget renders within 100ms');
    // relation hint threaded
    expect(prompt).toContain('req-2 depends_on req-1');
    // exemplars present
    expect(prompt).toContain('parallel-utils');
    // no test authoring
    expect(prompt).toContain('Do NOT author tests');
  });

  it('includes brownfield package anchors when supplied', async () => {
    let prompt = '';
    await architectPlan(
      projected,
      async (p) => {
        prompt = p;
        return wellFormed;
      },
      {
        relations: [],
        project: {
          packages: [
            { dir: 'libs/@hashintel/petrinaut-core', name: '@hashintel/petrinaut-core' },
            { dir: 'tests/hash-backend-integration', name: '@hashintel/hash-backend-integration' },
          ],
        },
      },
    );

    expect(prompt).toContain('@hashintel/petrinaut-core at libs/@hashintel/petrinaut-core');
    expect(prompt).toContain('Do not put product');
    expect(prompt).toContain('unrelated integration-test package');
  });
});
