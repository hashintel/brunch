import { describe, expect, it } from 'vitest';

import type { NetBlueprint } from './net-blueprint.js';
import { compileTopology } from './net-compiler.js';
import { PETRINAUT_NET_SCHEMA_VERSION, serializeBlueprint, type PetrinautNet } from './petrinaut-export.js';
import { createNetFolding, SLICE_COLOR_TYPE_ID } from './petrinaut-fold.js';
import type { Plan } from './types.js';

/**
 * These tests pin the color-fold export shape. The identity fold is exercised
 * by petrinaut-stream-export.test.ts's engine-driven oracle.
 */
function colorFold(blueprint: NetBlueprint) {
  return createNetFolding(blueprint);
}

const simplePlan: Plan = {
  mode: 'greenfield',
  epics: [{ id: 'epic-1', summary: 'E', depends_on: [], verification: [] }],
  slices: [
    {
      id: 'slice-1',
      epic_id: 'epic-1',
      definition: 'D',
      depends_on: [],
      verification: [{ kind: 'unit-test', target: 't' }],
    },
  ],
};

const depPlan: Plan = {
  mode: 'greenfield',
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

/** Deterministic token id generator for snapshot stability in tests. */
function deterministicTokenId(): () => string {
  let n = 0;
  return () => `tok-${++n}`;
}

describe('serializeBlueprint — envelope', () => {
  it('emits schemaVersion and runId at the top level', () => {
    const blueprint = compileTopology(simplePlan, { maxRetries: 3 });
    const net = serializeBlueprint(blueprint, {
      runId: 'run-1',
      folding: colorFold(blueprint),
      tokenIdFn: deterministicTokenId(),
    });
    expect(net.schemaVersion).toBe(PETRINAUT_NET_SCHEMA_VERSION);
    expect(net.runId).toBe('run-1');
  });

  it('round-trips through JSON.parse(JSON.stringify)', () => {
    const blueprint = compileTopology(simplePlan, { maxRetries: 3 });
    const net = serializeBlueprint(blueprint, {
      runId: 'run-1',
      folding: colorFold(blueprint),
      tokenIdFn: deterministicTokenId(),
    });
    const roundTripped = JSON.parse(JSON.stringify(net)) as PetrinautNet;
    expect(roundTripped).toEqual(net);
  });

  it('declares the SliceColor token type when slice places are present', () => {
    const blueprint = compileTopology(simplePlan, { maxRetries: 3 });
    const net = serializeBlueprint(blueprint, {
      runId: 'run-1',
      folding: colorFold(blueprint),
      tokenIdFn: deterministicTokenId(),
    });
    const type = net.tokenTypes.find((t) => t.id === SLICE_COLOR_TYPE_ID)!;
    expect(type).toBeDefined();
    expect(type.dimensions.map((d) => d.name)).toEqual(['sliceId', 'epicId', 'retryCount', 'reworkCount']);
  });
});

describe('serializeBlueprint — color fold', () => {
  it('strips the slice:<id>: prefix from every folded place id', () => {
    const blueprint = compileTopology(depPlan, { maxRetries: 3 });
    const net = serializeBlueprint(blueprint, {
      runId: 'run-2',
      folding: colorFold(blueprint),
      tokenIdFn: deterministicTokenId(),
    });
    for (const p of net.places) expect(p.id.startsWith('slice:')).toBe(false);
    expect(net.places.some((p) => p.id === 'spec-ready')).toBe(true);
    expect(net.places.some((p) => p.id === 'evaluate:running')).toBe(true);
  });

  it('collapses the uniform per-slice lifecycle to one node for a 2-slice plan', () => {
    const blueprint = compileTopology(depPlan, { maxRetries: 3 });
    const net = serializeBlueprint(blueprint, {
      runId: 'run-2',
      folding: colorFold(blueprint),
      tokenIdFn: deterministicTokenId(),
    });
    // Two slices, but the shared lifecycle place/transition appears once.
    expect(net.places.filter((p) => p.id === 'spec-ready')).toHaveLength(1);
    expect(net.transitions.filter((t) => t.id === 'evaluate:dispatch')).toHaveLength(1);
    expect(net.transitions.filter((t) => t.id === 'run-tests:pass')).toHaveLength(1);
  });

  it('keeps divergent dependency gates at their concrete per-slice ids', () => {
    const blueprint = compileTopology(depPlan, { maxRetries: 3 });
    const net = serializeBlueprint(blueprint, {
      runId: 'run-2',
      folding: colorFold(blueprint),
      tokenIdFn: deterministicTokenId(),
    });
    const ids = new Set(net.transitions.map((t) => t.id));
    // slice-b's readiness gate has dep inputs slice-a's lacks → not folded.
    expect(ids.has('slice-ready:slice-a')).toBe(true);
    expect(ids.has('slice-ready:slice-b')).toBe(true);
    expect(ids.has('slice-ready')).toBe(false);
    // return-done diverges (slice-a emits a dep-signal, slice-b does not).
    expect(ids.has('slice-a:return-done')).toBe(true);
    expect(ids.has('slice-b:return-done')).toBe(true);
    // The per-edge dep-signal place keeps both endpoints (unique role).
    expect(net.places.some((p) => p.id === 'dep-signal:slice-a:slice-b')).toBe(true);
  });

  it('folds transition arcs to folded place ids that all exist as declared places', () => {
    const blueprint = compileTopology(depPlan, { maxRetries: 3 });
    const net = serializeBlueprint(blueprint, {
      runId: 'run-2',
      folding: colorFold(blueprint),
      tokenIdFn: deterministicTokenId(),
    });
    const placeIds = new Set(net.places.map((p) => p.id));
    for (const t of net.transitions) {
      for (const arc of [...t.inputs, ...t.outputs]) {
        expect(placeIds.has(arc), `transition ${t.id} references undeclared place ${arc}`).toBe(true);
      }
    }
  });

  it('tags folded slice places with the slice color type and leaves pools untyped', () => {
    const blueprint = compileTopology(simplePlan, { maxRetries: 3 });
    const net = serializeBlueprint(blueprint, {
      runId: 'run-1',
      folding: colorFold(blueprint),
      tokenIdFn: deterministicTokenId(),
    });
    expect(net.places.find((p) => p.id === 'spec-ready')!.typeId).toBe(SLICE_COLOR_TYPE_ID);
    expect(net.places.find((p) => p.id === 'pool:test-agent')!.typeId).toBeUndefined();
  });
});

describe('serializeBlueprint — transitions', () => {
  it('emits the folded evaluate dispatch/complete pair with arcs and metadata', () => {
    const blueprint = compileTopology(simplePlan, { maxRetries: 3 });
    const net = serializeBlueprint(blueprint, {
      runId: 'run-1',
      folding: colorFold(blueprint),
      tokenIdFn: deterministicTokenId(),
    });

    const evalDispatch = net.transitions.find((t) => t.id === 'evaluate:dispatch')!;
    expect(evalDispatch).toBeDefined();
    expect(evalDispatch.lane).toBe('mechanical');
    expect(evalDispatch.kind).toBe('structural');
    expect(evalDispatch.inputs).toEqual(['spec-ready', 'pool:test-agent']);
    expect(evalDispatch.outputs).toEqual(['evaluate:running']);

    const evalComplete = net.transitions.find((t) => t.id === 'evaluate:complete')!;
    expect(evalComplete).toBeDefined();
    expect(evalComplete.kind).toBe('mechanical');
    expect(evalComplete.actor).toBe('evaluator');
    expect(evalComplete.inputs).toEqual(['evaluate:running']);
    expect(evalComplete.outputs).toEqual(['evaluate:reported', 'pool:test-agent'].sort());
  });
});

describe('serializeBlueprint — initial marking', () => {
  it('groups initial tokens into folded places, one colored token per slice', () => {
    const blueprint = compileTopology(depPlan, { maxRetries: 3 });
    const net = serializeBlueprint(blueprint, {
      runId: 'run-2',
      folding: colorFold(blueprint),
      tokenIdFn: deterministicTokenId(),
    });

    const places = net.initialMarking.map((m) => m.place).sort();
    expect(places).toEqual([
      'eligible',
      'pool:code-agent',
      'pool:test-agent',
      'retry-budget',
      'semantic-budget',
    ]);

    // eligible folds both slices' seeds → two colored tokens.
    const eligible = net.initialMarking.find((m) => m.place === 'eligible')!;
    expect(eligible.tokens.map((t) => t.sliceId).sort((a, b) => String(a).localeCompare(String(b)))).toEqual([
      'slice-a',
      'slice-b',
    ]);

    // Pool seeds remain runtime-valid tokens, but export without slice color.
    const poolSeed = blueprint.initialTokens.find((t) => t.place === 'pool:test-agent')!.token;
    expect(poolSeed).toEqual({ sliceId: '', epicId: '' });

    const pool = net.initialMarking.find((m) => m.place === 'pool:test-agent')!;
    expect(pool.tokens[0]!.sliceId).toBeUndefined();
  });

  it('carries budget counters on the folded budget places', () => {
    const blueprint = compileTopology(simplePlan, { maxRetries: 3 });
    const net = serializeBlueprint(blueprint, {
      runId: 'run-1',
      folding: colorFold(blueprint),
      tokenIdFn: deterministicTokenId(),
    });
    expect(net.initialMarking.find((m) => m.place === 'semantic-budget')!.tokens[0]!.reworkCount).toBe(0);
    expect(net.initialMarking.find((m) => m.place === 'retry-budget')!.tokens[0]!.retryCount).toBe(0);
  });

  it('emits distinct token ids for every initial token', () => {
    const blueprint = compileTopology(depPlan, { maxRetries: 3 });
    const net = serializeBlueprint(blueprint, {
      runId: 'run-2',
      folding: colorFold(blueprint),
      tokenIdFn: deterministicTokenId(),
    });
    const ids = net.initialMarking.flatMap((m) => m.tokens.map((t) => t.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('serializeBlueprint — golden fold counts pinned per fixture', () => {
  it('simplePlan (1 slice): fold is a relabel — 22 places, 19 transitions, 5 marked', () => {
    const blueprint = compileTopology(simplePlan, { maxRetries: 3 });
    const net = serializeBlueprint(blueprint, {
      runId: 'run-1',
      folding: colorFold(blueprint),
      tokenIdFn: deterministicTokenId(),
    });
    expect(net.places.length).toBe(22);
    expect(net.transitions.length).toBe(19);
    expect(net.initialMarking.length).toBe(5);
  });

  it('depPlan (2 slices): lifecycle collapses — 23 places, 21 transitions, 5 marked', () => {
    const blueprint = compileTopology(depPlan, { maxRetries: 3 });
    const net = serializeBlueprint(blueprint, {
      runId: 'run-2',
      folding: colorFold(blueprint),
      tokenIdFn: deterministicTokenId(),
    });
    expect(net.places.length).toBe(23);
    expect(net.transitions.length).toBe(21);
    expect(net.initialMarking.length).toBe(5);
  });
});
