import { describe, expect, it } from 'vitest';

import type { NetBlueprint, TransitionSkeleton } from './net-blueprint.js';
import { compileTopology } from './net-compiler.js';
import { createNetFolding, SLICE_COLOUR_TYPE_ID } from './petrinaut-fold.js';
import type { Plan } from './types.js';

// A compact two-slice blueprint exercising every fold rule without depending on
// the compiler: uniform lifecycle transitions (evaluate:dispatch), a divergent
// dependency gate (slice-ready, slice-b carries a dep-signal input slice-a
// lacks), a per-edge dep-signal place, and unfolded epic/pool nodes.
function tx(id: string, inputs: string[], outputs: string[]): TransitionSkeleton {
  return {
    id,
    inputs,
    contract: { kind: 'structural', lane: 'mechanical' },
    handler: { kind: 'passthrough', outputs: outputs.map((place) => ({ place, sliceId: '', epicId: '' })) },
  };
}

const blueprint: NetBlueprint = {
  places: [
    'pool:test-agent',
    'slice:slice-a:eligible',
    'slice:slice-a:spec-ready',
    'slice:slice-a:evaluate:running',
    'slice:slice-b:eligible',
    'slice:slice-b:spec-ready',
    'slice:slice-b:evaluate:running',
    'slice:slice-a:dep-signal:slice-b',
    'epic:epic-1:done',
  ],
  transitions: [
    tx('slice-ready:slice-a', ['slice:slice-a:eligible'], ['slice:slice-a:spec-ready']),
    tx(
      'slice-ready:slice-b',
      ['slice:slice-b:eligible', 'slice:slice-a:dep-signal:slice-b'],
      ['slice:slice-b:spec-ready'],
    ),
    tx(
      'slice-a:evaluate:dispatch',
      ['slice:slice-a:spec-ready', 'pool:test-agent'],
      ['slice:slice-a:evaluate:running'],
    ),
    tx(
      'slice-b:evaluate:dispatch',
      ['slice:slice-b:spec-ready', 'pool:test-agent'],
      ['slice:slice-b:evaluate:running'],
    ),
    tx(
      'epic-complete:epic-1',
      ['slice:slice-a:spec-ready', 'slice:slice-b:spec-ready'],
      ['epic:epic-1:done'],
    ),
  ],
  initialTokens: [
    { place: 'slice:slice-a:eligible', token: { sliceId: 'slice-a', epicId: 'epic-1' } },
    { place: 'slice:slice-b:eligible', token: { sliceId: 'slice-b', epicId: 'epic-1' } },
    { place: 'pool:test-agent', token: { sliceId: '', epicId: '' } },
  ],
};

describe('createNetFolding — foldedPlaces', () => {
  const folding = createNetFolding(blueprint);

  it('strips slice:<sid>: and dedupes the lifecycle places to one each', () => {
    const ids = folding.foldedPlaces().map((p) => p.id);
    expect(ids.filter((id) => id === 'spec-ready')).toHaveLength(1);
    expect(ids.filter((id) => id === 'evaluate:running')).toHaveLength(1);
    expect(ids.every((id) => !id.startsWith('slice:'))).toBe(true);
  });

  it('keeps per-edge dep-signal and epic/pool places unchanged', () => {
    const ids = folding.foldedPlaces().map((p) => p.id);
    expect(ids).toContain('dep-signal:slice-b');
    expect(ids).toContain('epic:epic-1:done');
    expect(ids).toContain('pool:test-agent');
  });

  it('tags folded slice places with the colour type and leaves pool/epic untyped', () => {
    const byId = new Map(folding.foldedPlaces().map((p) => [p.id, p]));
    expect(byId.get('spec-ready')!.typeId).toBe(SLICE_COLOUR_TYPE_ID);
    expect(byId.get('pool:test-agent')!.typeId).toBeUndefined();
    expect(byId.get('epic:epic-1:done')!.typeId).toBeUndefined();
  });
});

describe('createNetFolding — foldedTransitions / foldTransition', () => {
  const folding = createNetFolding(blueprint);

  it('collapses uniform per-slice transitions to one folded node', () => {
    const ids = folding.foldedTransitions().map((t) => t.id);
    expect(ids.filter((id) => id === 'evaluate:dispatch')).toHaveLength(1);
    const dispatch = folding.foldedTransitions().find((t) => t.id === 'evaluate:dispatch')!;
    expect(dispatch.inputs).toEqual(['spec-ready', 'pool:test-agent']);
    expect(dispatch.outputs).toEqual(['evaluate:running']);
    expect(folding.foldTransition('slice-a:evaluate:dispatch')).toBe('evaluate:dispatch');
    expect(folding.foldTransition('slice-b:evaluate:dispatch')).toBe('evaluate:dispatch');
  });

  it('keeps divergent dependency gates at their concrete ids', () => {
    const ids = new Set(folding.foldedTransitions().map((t) => t.id));
    expect(ids.has('slice-ready:slice-a')).toBe(true);
    expect(ids.has('slice-ready:slice-b')).toBe(true);
    expect(ids.has('slice-ready')).toBe(false);
    expect(folding.foldTransition('slice-ready:slice-a')).toBe('slice-ready:slice-a');
  });

  it('leaves epic transitions (no slice-id segment) unchanged', () => {
    expect(folding.foldTransition('epic-complete:epic-1')).toBe('epic-complete:epic-1');
  });
});

describe('createNetFolding — foldedMarking', () => {
  const folding = createNetFolding(blueprint);

  it('merges token lists for places that fold together and preserves empty keys', () => {
    const folded = folding.foldedMarking([
      ['slice:slice-a:eligible', ['a']],
      ['slice:slice-b:eligible', ['b']],
      ['pool:test-agent', []],
    ]);
    expect(folded.get('eligible')).toEqual(['a', 'b']);
    expect(folded.get('pool:test-agent')).toEqual([]);
  });
});

describe('createNetFolding — tokenTypes', () => {
  it('declares the SliceColour type when slice places are present', () => {
    const types = createNetFolding(blueprint).tokenTypes();
    expect(types.map((t) => t.id)).toEqual([SLICE_COLOUR_TYPE_ID]);
  });
});

describe('createNetFolding — divergence is bounded to dependency gates', () => {
  // Card #3: the only transitions allowed to keep a per-slice (concrete) id are
  // the dependency gates whose arcs genuinely differ per slice. Anything else
  // staying slice-scoped means a uniform lifecycle transition silently failed
  // to fold — the graph re-expands while reading as "fold worked".
  const depPlan: Plan = {
    epics: [{ id: 'epic-1', summary: 'E', depends_on: [], verification: [] }],
    slices: [
      {
        id: 'slice-a',
        epic_id: 'epic-1',
        definition: 'A',
        depends_on: [],
        verification: [{ kind: 'unit-test', target: 'ta' }],
      },
      {
        id: 'slice-b',
        epic_id: 'epic-1',
        definition: 'B',
        depends_on: ['slice-a'],
        verification: [{ kind: 'unit-test', target: 'tb' }],
      },
    ],
  };

  it('keeps exactly the dependency gates (slice-ready, return-done) concrete and folds everything else', () => {
    const compiled = compileTopology(depPlan, { maxRetries: 3 });
    const folding = createNetFolding(compiled);
    const sliceIds = ['slice-a', 'slice-b'];

    // A folded transition is "still slice-scoped" iff its id carries a slice-id segment.
    const stillSliceScoped = folding
      .foldedTransitions()
      .map((t) => t.id)
      .filter((id) => id.split(':').some((seg) => sliceIds.includes(seg)));

    expect(new Set(stillSliceScoped)).toEqual(
      new Set(['slice-ready:slice-a', 'slice-ready:slice-b', 'slice-a:return-done', 'slice-b:return-done']),
    );
  });
});
