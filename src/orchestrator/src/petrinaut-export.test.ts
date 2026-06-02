import { describe, expect, it } from 'vitest';

import { compileTopology } from './net-compiler.js';
import { PETRINAUT_NET_SCHEMA_VERSION, serializeBlueprint, type PetrinautNet } from './petrinaut-export.js';
import type { Plan } from './types.js';

const simplePlan: Plan = {
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
    const net = serializeBlueprint(blueprint, { runId: 'run-1', tokenIdFn: deterministicTokenId() });
    expect(net.schemaVersion).toBe(PETRINAUT_NET_SCHEMA_VERSION);
    expect(net.runId).toBe('run-1');
  });

  it('round-trips through JSON.parse(JSON.stringify)', () => {
    const blueprint = compileTopology(simplePlan, { maxRetries: 3 });
    const net = serializeBlueprint(blueprint, { runId: 'run-1', tokenIdFn: deterministicTokenId() });
    const roundTripped = JSON.parse(JSON.stringify(net)) as PetrinautNet;
    expect(roundTripped).toEqual(net);
  });
});

describe('serializeBlueprint — places', () => {
  it('emits one place entry per blueprint place', () => {
    const blueprint = compileTopology(simplePlan, { maxRetries: 3 });
    const net = serializeBlueprint(blueprint, { runId: 'run-1', tokenIdFn: deterministicTokenId() });
    expect(net.places).toHaveLength(blueprint.places.length);
    expect(new Set(net.places.map((p) => p.id))).toEqual(new Set(blueprint.places));
  });

  it('strips slice:<id>: and epic:<id>: prefixes for the short label', () => {
    const blueprint = compileTopology(simplePlan, { maxRetries: 3 });
    const net = serializeBlueprint(blueprint, { runId: 'run-1', tokenIdFn: deterministicTokenId() });
    const specReady = net.places.find((p) => p.id === 'slice:slice-1:spec-ready')!;
    expect(specReady.label).toBe('spec-ready');
    const epicDone = net.places.find((p) => p.id === 'epic:epic-1:done')!;
    expect(epicDone.label).toBe('done');
    // Non-prefixed places (e.g. pools) keep their id as label.
    const pool = net.places.find((p) => p.id === 'pool:test-agent')!;
    expect(pool.label).toBe('pool:test-agent');
  });
});

describe('serializeBlueprint — transitions', () => {
  it('emits one transition entry per blueprint transition with arcs and contract metadata', () => {
    const blueprint = compileTopology(simplePlan, { maxRetries: 3 });
    const net = serializeBlueprint(blueprint, { runId: 'run-1', tokenIdFn: deterministicTokenId() });
    expect(net.transitions).toHaveLength(blueprint.transitions.length);

    // FE-761 Slice 4: dispatch transition exists with the right shape.
    const evalDispatch = net.transitions.find((t) => t.id === 'slice-1:evaluate:dispatch')!;
    expect(evalDispatch).toBeDefined();
    expect(evalDispatch.lane).toBe('mechanical');
    expect(evalDispatch.kind).toBe('structural');
    expect(evalDispatch.inputs).toEqual(['slice:slice-1:spec-ready', 'pool:test-agent']);
    expect(evalDispatch.outputs).toEqual(['slice:slice-1:evaluate:running']);

    // Complete transition carries the action descriptor; outputs include
    // the report-bearing intermediate and the agent pool return.
    const evalComplete = net.transitions.find((t) => t.id === 'slice-1:evaluate:complete')!;
    expect(evalComplete).toBeDefined();
    expect(evalComplete.kind).toBe('mechanical');
    expect(evalComplete.actor).toBe('evaluator');
    expect(evalComplete.inputs).toEqual(['slice:slice-1:evaluate:running']);
    expect(evalComplete.outputs).toEqual(['pool:test-agent', 'slice:slice-1:evaluate:reported'].sort());
  });

  it('every transition output appears as a declared place', () => {
    const blueprint = compileTopology(depPlan, { maxRetries: 3 });
    const net = serializeBlueprint(blueprint, { runId: 'run-2', tokenIdFn: deterministicTokenId() });
    const placeIds = new Set(net.places.map((p) => p.id));
    for (const t of net.transitions) {
      for (const out of t.outputs) {
        expect(placeIds.has(out), `transition ${t.id} emits to undeclared place ${out}`).toBe(true);
      }
    }
  });
});

describe('serializeBlueprint — initial marking', () => {
  it('groups initial tokens by place with a fresh UUID per token', () => {
    const blueprint = compileTopology(simplePlan, { maxRetries: 3 });
    const net = serializeBlueprint(blueprint, { runId: 'run-1', tokenIdFn: deterministicTokenId() });

    // simplePlan seeds:
    //   pool:test-agent × 1, pool:code-agent × 1 (agentPoolSize defaults to slice count = 1)
    //   slice:slice-1:semantic-budget × 1, slice:slice-1:retry-budget × 1,
    //   slice:slice-1:eligible × 1
    const places = net.initialMarking.map((m) => m.place).sort();
    expect(places).toEqual(
      [
        'pool:code-agent',
        'pool:test-agent',
        'slice:slice-1:eligible',
        'slice:slice-1:retry-budget',
        'slice:slice-1:semantic-budget',
      ].sort(),
    );

    // Every token has an id.
    for (const marking of net.initialMarking) {
      for (const tok of marking.tokens) {
        expect(typeof tok.id).toBe('string');
        expect(tok.id.length).toBeGreaterThan(0);
      }
    }

    // Semantic budget token carries reworkCount: 0; retry-budget carries retryCount: 0.
    const semBudget = net.initialMarking.find((m) => m.place === 'slice:slice-1:semantic-budget')!;
    expect(semBudget.tokens[0]!.reworkCount).toBe(0);
    expect(semBudget.tokens[0]!.sliceId).toBe('slice-1');
    expect(semBudget.tokens[0]!.epicId).toBe('epic-1');

    const retryBudget = net.initialMarking.find((m) => m.place === 'slice:slice-1:retry-budget')!;
    expect(retryBudget.tokens[0]!.retryCount).toBe(0);

    // Pool tokens have no sliceId / epicId (shared pool).
    const poolSeed = blueprint.initialTokens.find((t) => t.place === 'pool:test-agent')!.token;
    expect(poolSeed).toEqual({ sliceId: '', epicId: '' });

    const pool = net.initialMarking.find((m) => m.place === 'pool:test-agent')!;
    expect(pool.tokens[0]!.sliceId).toBeUndefined();
    expect(pool.tokens[0]!.epicId).toBeUndefined();
  });

  it('emits distinct token ids for every initial token', () => {
    const blueprint = compileTopology(depPlan, { maxRetries: 3 });
    const net = serializeBlueprint(blueprint, { runId: 'run-2', tokenIdFn: deterministicTokenId() });
    const ids = net.initialMarking.flatMap((m) => m.tokens.map((t) => t.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('serializeBlueprint — golden counts pinned per fixture', () => {
  it('simplePlan: 22 places, 19 transitions, 5 places hold initial tokens', () => {
    const blueprint = compileTopology(simplePlan, { maxRetries: 3 });
    const net = serializeBlueprint(blueprint, { runId: 'run-1', tokenIdFn: deterministicTokenId() });
    expect(net.places.length).toBe(22);
    expect(net.transitions.length).toBe(19);
    expect(net.initialMarking.length).toBe(5);
  });

  it('depPlan: 42 places, 37 transitions, 8 places hold initial tokens', () => {
    const blueprint = compileTopology(depPlan, { maxRetries: 3 });
    const net = serializeBlueprint(blueprint, { runId: 'run-2', tokenIdFn: deterministicTokenId() });
    expect(net.places.length).toBe(42);
    expect(net.transitions.length).toBe(37);
    // 2 pools + 2 slices × 3 per-slice seeded places (semantic-budget, retry-budget, eligible)
    expect(net.initialMarking.length).toBe(8);
  });
});
