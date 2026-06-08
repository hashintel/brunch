import { describe, expect, it } from 'vitest';

import { compileTopology } from './net-compiler.js';
import { type BrunchNetDefinition, brunchNetDefinitionSchema } from './petrinaut-brunch-contract-schema.js';
import { type PetrinautEvent } from './petrinaut-events.js';
import { PETRINAUT_NET_SCHEMA_VERSION, serializeBlueprint } from './petrinaut-export.js';
import { createIdentityFolding } from './petrinaut-fold.js';
import { toSdcpnFile, type SdcpnFile } from './petrinaut-sdcpn.js';
import {
  type BrunchExecutionExport,
  type Marking,
  type NetDefinition,
  reduceBrunchExecutionExport,
  RUN_COMPLETED_PLACE,
  RUN_FINISH_TRANSITION,
  RUN_HALTED_PLACE,
} from './petrinaut-stream-export.js';
import type { Plan } from './types.js';

// ---------------------------------------------------------------------------
// Plan fixtures
// ---------------------------------------------------------------------------

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

/**
 * Build an SdcpnFile from a Plan under the default identity fold (concrete
 * per-slice place ids). The reducer itself is fold-agnostic; the
 * engine-driven oracle below exercises the identity-fold path end-to-end.
 */
function buildSdcpnFile(plan: Plan): SdcpnFile {
  const blueprint = compileTopology(plan, { maxRetries: 3 });
  const net = serializeBlueprint(blueprint, { runId: 'run-test', folding: createIdentityFolding(blueprint) });
  return toSdcpnFile(net, {});
}

/** A minimal in-line PetrinautEvent fixture so tests don't need a live engine. */
function syntheticEvents(): PetrinautEvent[] {
  return [
    {
      kind: 'initial_marking',
      ts: '2026-06-02T00:00:00.000Z',
      runId: 'run-test',
      marking: {
        'pool:code-agent': [{ id: 'tok-1' }],
        'pool:test-agent': [{ id: 'tok-2' }],
        eligible: [{ id: 'tok-3', sliceId: 'slice-1' }],
      },
    },
    {
      kind: 'transition_fired',
      ts: '2026-06-02T00:00:00.100Z',
      runId: 'run-test',
      transitionName: 'slice-1:evaluate:dispatch',
      input: { eligible: [{ id: 'tok-3', sliceId: 'slice-1' }] },
      output: { 'slice:slice-1:evaluate:running': [{ id: 'tok-4', sliceId: 'slice-1' }] },
    },
    {
      kind: 'net_halted',
      ts: '2026-06-02T00:00:00.200Z',
      runId: 'run-test',
    },
  ];
}

// ---------------------------------------------------------------------------
// Contract: schema shape + purity
// ---------------------------------------------------------------------------

describe('reduceBrunchExecutionExport — schema', () => {
  it('returns the envelope { definition, initialState, transitionFirings } with no extra keys', () => {
    const sdcpnFile = buildSdcpnFile(simplePlan);
    const result = reduceBrunchExecutionExport({ sdcpnFile, events: syntheticEvents() });

    expect(Object.keys(result).sort()).toEqual(['definition', 'initialState', 'transitionFirings'].sort());
  });

  it('emits all five root fields (the strict-schema oracle below owns no-extra-keys)', () => {
    const sdcpnFile = buildSdcpnFile(simplePlan);
    const result = reduceBrunchExecutionExport({ sdcpnFile, events: syntheticEvents() });

    expect(Object.keys(result.definition).sort()).toEqual(
      ['meta', 'places', 'title', 'transitions', 'version'].sort(),
    );
  });

  it('preserves NetDefinition field values from the input SdcpnFile (synthetic run-status nodes appended)', () => {
    const sdcpnFile = buildSdcpnFile(simplePlan);
    const result = reduceBrunchExecutionExport({ sdcpnFile, events: syntheticEvents() });

    expect(result.definition.version).toBe(sdcpnFile.version);
    expect(result.definition.meta).toBe(sdcpnFile.meta);
    expect(result.definition.title).toBe(sdcpnFile.title);
    // Original nodes survive as a slimmed prefix; run-status nodes (Card C) follow.
    expect(result.definition.places.slice(0, sdcpnFile.places.length)).toEqual(
      sdcpnFile.places.map((p) => ({ id: p.id, name: p.name })),
    );
    expect(result.definition.transitions.slice(0, sdcpnFile.transitions.length)).toEqual(
      sdcpnFile.transitions.map((t) => ({
        id: t.id,
        name: t.name,
        inputArcs: t.inputArcs,
        outputArcs: t.outputArcs,
      })),
    );
    expect(result.definition.places.map((p) => p.id)).toEqual(
      expect.arrayContaining([RUN_COMPLETED_PLACE, RUN_HALTED_PLACE]),
    );
    expect(result.definition.transitions.map((t) => t.id)).toContain(RUN_FINISH_TRANSITION);
  });

  it('the projected definition validates against Petrinaut’s strict brunchNetDefinitionSchema', () => {
    const sdcpnFile = buildSdcpnFile(simplePlan);
    const { definition } = reduceBrunchExecutionExport({ sdcpnFile, events: syntheticEvents() });
    expect(() => brunchNetDefinitionSchema.parse(definition)).not.toThrow();
  });

  it('a legacy SDCPN-laden place is rejected by the strict schema (guards against regression)', () => {
    const legacy = {
      version: 1,
      title: 't',
      places: [{ id: 'p', name: 'P', colorId: null, dynamicsEnabled: false, differentialEquationId: null }],
      transitions: [],
    };
    expect(() => brunchNetDefinitionSchema.parse(legacy)).toThrow();
  });

  it('is pure — calling twice with the same input yields structurally equal results', () => {
    const sdcpnFile = buildSdcpnFile(simplePlan);
    const a = reduceBrunchExecutionExport({ sdcpnFile, events: syntheticEvents() });
    const b = reduceBrunchExecutionExport({ sdcpnFile, events: syntheticEvents() });
    expect(a).toEqual(b);
  });
});

// ---------------------------------------------------------------------------
// Marking reduction + transitionFirings shape
// ---------------------------------------------------------------------------

describe('reduceBrunchExecutionExport — markings + firings', () => {
  it('count-reduces initialState; absent / empty places are not synthesized', () => {
    const sdcpnFile = buildSdcpnFile(simplePlan);
    const events: PetrinautEvent[] = [
      {
        kind: 'initial_marking',
        ts: '2026-06-02T00:00:00.000Z',
        runId: 'run-test',
        marking: {
          a: [{ id: 'tok-1' }, { id: 'tok-2' }],
          b: [{ id: 'tok-3' }],
          c: [],
        },
      },
    ];
    const result = reduceBrunchExecutionExport({ sdcpnFile, events });

    expect(result.initialState).toEqual({ a: 2, b: 1 });
    expect(result.initialState).not.toHaveProperty('c');
  });

  it('maps transition_fired events into transitionFirings in arrival order, with transitionName → transitionId', () => {
    const sdcpnFile = buildSdcpnFile(simplePlan);
    const events: PetrinautEvent[] = [
      {
        kind: 'initial_marking',
        ts: '2026-06-02T00:00:00.000Z',
        runId: 'run-test',
        marking: { a: [{ id: 'tok-0' }] },
      },
      {
        kind: 'transition_fired',
        ts: '2026-06-02T00:00:00.100Z',
        runId: 'run-test',
        transitionName: 't-first',
        input: { a: [{ id: 'tok-0' }] },
        output: { b: [{ id: 'tok-1' }] },
      },
      {
        kind: 'transition_fired',
        ts: '2026-06-02T00:00:00.200Z',
        runId: 'run-test',
        transitionName: 't-second',
        input: { b: [{ id: 'tok-1' }] },
        output: { c: [{ id: 'tok-2' }] },
      },
    ];
    const result = reduceBrunchExecutionExport({ sdcpnFile, events });

    expect(result.transitionFirings).toHaveLength(2);
    expect(result.transitionFirings[0]!.transitionId).toBe('t-first');
    expect(result.transitionFirings[0]!.input).toEqual({ a: 1 });
    expect(result.transitionFirings[0]!.output).toEqual({ b: 1 });
    expect(result.transitionFirings[1]!.transitionId).toBe('t-second');
    expect(result.transitionFirings[1]!.ts).toBe('2026-06-02T00:00:00.200Z');
  });

  it('preserves transitionFiring.ts strings verbatim (no Date coercion, no number conversion)', () => {
    const sdcpnFile = buildSdcpnFile(simplePlan);
    const ts = '2026-06-02T17:33:42.987Z';
    const events: PetrinautEvent[] = [
      {
        kind: 'initial_marking',
        ts: '2026-06-02T00:00:00.000Z',
        runId: 'run-test',
        marking: { a: [{ id: 'tok-0' }] },
      },
      {
        kind: 'transition_fired',
        ts,
        runId: 'run-test',
        transitionName: 't-1',
        input: { a: [{ id: 'tok-0' }] },
        output: { b: [{ id: 'tok-1' }] },
      },
    ];
    const result = reduceBrunchExecutionExport({ sdcpnFile, events });

    expect(typeof result.transitionFirings[0]!.ts).toBe('string');
    expect(result.transitionFirings[0]!.ts).toBe(ts);
  });

  it('a terminal event with no real firings still emits exactly one synthetic run:finish firing (Card C)', () => {
    const sdcpnFile = buildSdcpnFile(simplePlan);
    const events: PetrinautEvent[] = [
      {
        kind: 'initial_marking',
        ts: '2026-06-02T00:00:00.000Z',
        runId: 'run-test',
        marking: { a: [{ id: 'tok-0' }] },
      },
      {
        kind: 'net_halted',
        ts: '2026-06-02T00:00:00.100Z',
        runId: 'run-test',
      },
    ];
    const result = reduceBrunchExecutionExport({ sdcpnFile, events });
    expect(result.transitionFirings).toHaveLength(1);
    expect(result.transitionFirings[0]!.transitionId).toBe(RUN_FINISH_TRANSITION);
    expect(result.transitionFirings[0]!.output[RUN_HALTED_PLACE]).toBe(1);
  });

  it('emits at most one synthetic run:finish firing even if multiple terminal events arrive', () => {
    const sdcpnFile = buildSdcpnFile(simplePlan);
    const events: PetrinautEvent[] = [
      {
        kind: 'initial_marking',
        ts: '2026-06-02T00:00:00.000Z',
        runId: 'run-test',
        marking: { a: [{ id: 'tok-0' }] },
      },
      { kind: 'net_halted', ts: '2026-06-02T00:00:00.100Z', runId: 'run-test' },
      { kind: 'net_deadlocked', ts: '2026-06-02T00:00:00.200Z', runId: 'run-test' },
    ];
    const result = reduceBrunchExecutionExport({ sdcpnFile, events });
    expect(result.transitionFirings.filter((f) => f.transitionId === RUN_FINISH_TRANSITION)).toHaveLength(1);
  });

  it('throws when initial_marking event is missing', () => {
    const sdcpnFile = buildSdcpnFile(simplePlan);
    expect(() => reduceBrunchExecutionExport({ sdcpnFile, events: [] })).toThrow(/initial_marking/);
  });
});

// ---------------------------------------------------------------------------
// Inverted frame-replay oracle — the load-bearing test for the contract.
//
// Card A (FE-819) flips the marking semantics: every firing's `input` carries
// the COMPLETE pre-firing net marking and `output` the COMPLETE post-firing
// marking, so Petrinaut's actual-mode frame reader (which treats `firing.output`
// as the whole frame marking) renders the true net state — pools, budgets, all
// slices — at every frame, not just the one place a transition touched.
//
// The old delta-based oracle folded per-firing deltas onto a running marking.
// That is now inverted: the firings ARE the full markings, so the oracle
// reconstructs the per-firing delta from consecutive full markings and asserts
// non-negativity + token conservation against the known event deltas.
//
// Fixture: a 4-place / 2-transition net with an untouched `pool:budget` place
// holding 5 tokens that NO transition ever consumes or produces. Under the old
// delta semantics that place is invisible in every firing (the field symptom:
// "pools/budgets invisible, one token moving at a time"). Under full markings
// it must appear — unchanged at 5 — in every frame.
//
// Hand-crafted rather than engine-driven because the reducer is the unit under
// test here. Engine-driven oracles elsewhere exercise the identity-fold
// default end to end.
// ---------------------------------------------------------------------------

describe('reduceBrunchExecutionExport — inverted frame-replay oracle (full markings)', () => {
  // Three-flow places + one untouched pool: src -- t-consume --> middle -- t-emit --> dst
  const sdcpnFile: SdcpnFile = {
    version: 1,
    meta: { generator: 'brunch', generatorVersion: '0.2.0' },
    title: 'frame-replay-fixture',
    places: [
      {
        id: 'pool:budget',
        name: 'Budget',
        colorId: null,
        dynamicsEnabled: false,
        differentialEquationId: null,
      },
      { id: 'src', name: 'Src', colorId: null, dynamicsEnabled: false, differentialEquationId: null },
      { id: 'middle', name: 'Middle', colorId: null, dynamicsEnabled: false, differentialEquationId: null },
      { id: 'dst', name: 'Dst', colorId: null, dynamicsEnabled: false, differentialEquationId: null },
    ],
    transitions: [
      {
        id: 't-consume',
        name: 'TConsume',
        inputArcs: [{ placeId: 'src', weight: 1, type: 'standard' }],
        outputArcs: [{ placeId: 'middle', weight: 1 }],
        lambdaType: 'predicate',
        lambdaCode: '',
        transitionKernelCode: '',
      },
      {
        id: 't-emit',
        name: 'TEmit',
        inputArcs: [{ placeId: 'middle', weight: 1, type: 'standard' }],
        outputArcs: [{ placeId: 'dst', weight: 1 }],
        lambdaType: 'predicate',
        lambdaCode: '',
        transitionKernelCode: '',
      },
    ],
    types: [],
    differentialEquations: [],
    parameters: [],
    scenarios: [],
    metrics: [],
  };

  const events: PetrinautEvent[] = [
    {
      kind: 'initial_marking',
      ts: '2026-06-02T00:00:00.000Z',
      runId: 'run-replay',
      // 5 budget tokens that no transition touches + 2 tokens on src.
      marking: {
        'pool:budget': [{ id: 'b1' }, { id: 'b2' }, { id: 'b3' }, { id: 'b4' }, { id: 'b5' }],
        src: [{ id: 'tk-a' }, { id: 'tk-b' }],
      },
    },
    {
      kind: 'transition_fired',
      ts: '2026-06-02T00:00:00.100Z',
      runId: 'run-replay',
      transitionName: 't-consume',
      input: { src: [{ id: 'tk-a' }] },
      output: { middle: [{ id: 'tk-c' }] },
    },
    {
      kind: 'transition_fired',
      ts: '2026-06-02T00:00:00.200Z',
      runId: 'run-replay',
      transitionName: 't-consume',
      input: { src: [{ id: 'tk-b' }] },
      output: { middle: [{ id: 'tk-d' }] },
    },
    {
      kind: 'transition_fired',
      ts: '2026-06-02T00:00:00.300Z',
      runId: 'run-replay',
      transitionName: 't-emit',
      input: { middle: [{ id: 'tk-c' }] },
      output: { dst: [{ id: 'tk-e' }] },
    },
    {
      kind: 'transition_fired',
      ts: '2026-06-02T00:00:00.400Z',
      runId: 'run-replay',
      transitionName: 't-emit',
      input: { middle: [{ id: 'tk-d' }] },
      output: { dst: [{ id: 'tk-f' }] },
    },
    // No terminal event here: the inverted oracle exercises real-firing
    // marking folds. The synthetic run:finish firing (Card C) is covered by
    // its own describe block.
  ];

  /** Independent reference fold of event deltas → full marking, never absent/zero places. */
  function countsOf(byPlace: Record<string, readonly unknown[]>): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [p, toks] of Object.entries(byPlace)) if (toks.length > 0) out[p] = toks.length;
    return out;
  }
  function applyDelta(
    current: Record<string, number>,
    consumed: Record<string, number>,
    produced: Record<string, number>,
  ): Record<string, number> {
    const next = { ...current };
    for (const [p, n] of Object.entries(consumed)) next[p] = (next[p] ?? 0) - n;
    for (const [p, n] of Object.entries(produced)) next[p] = (next[p] ?? 0) + n;
    for (const [p, n] of Object.entries(next)) if (n === 0) delete next[p];
    return next;
  }

  // Reference full markings folded from the raw event deltas, independent of
  // the reducer under test.
  const referenceMarkings = (() => {
    const firingEvents = events.filter((e) => e.kind === 'transition_fired');
    const initialEvent = events.find((e) => e.kind === 'initial_marking')!;
    let current = countsOf(initialEvent.kind === 'initial_marking' ? initialEvent.marking : {});
    const frames: { pre: Record<string, number>; post: Record<string, number> }[] = [];
    for (const e of firingEvents) {
      if (e.kind !== 'transition_fired') continue;
      const pre = { ...current };
      current = applyDelta(current, countsOf(e.input), countsOf(e.output));
      frames.push({ pre, post: { ...current } });
    }
    return { initial: countsOf(initialEvent.kind === 'initial_marking' ? initialEvent.marking : {}), frames };
  })();

  it('first-frame-input — firing 0 `input` equals initialState', () => {
    const result = reduceBrunchExecutionExport({ sdcpnFile, events });
    expect(result.transitionFirings[0]!.input).toEqual(result.initialState);
    expect(result.initialState).toEqual({ 'pool:budget': 5, src: 2 });
  });

  it('cumulative-fold — frame i `output` equals fold(initialState, deltas 0..i)', () => {
    const result = reduceBrunchExecutionExport({ sdcpnFile, events });
    result.transitionFirings.forEach((firing, i) => {
      expect(firing.input, `frame ${i} input`).toEqual(referenceMarkings.frames[i]!.pre);
      expect(firing.output, `frame ${i} output`).toEqual(referenceMarkings.frames[i]!.post);
    });
  });

  it('frame chaining — firing i `input` equals firing (i-1) `output`', () => {
    const result = reduceBrunchExecutionExport({ sdcpnFile, events });
    for (let i = 1; i < result.transitionFirings.length; i++) {
      expect(result.transitionFirings[i]!.input, `frame ${i} input vs prev output`).toEqual(
        result.transitionFirings[i - 1]!.output,
      );
    }
  });

  it('pools/budgets visible — the untouched pool:budget place shows 5 in every frame', () => {
    const result = reduceBrunchExecutionExport({ sdcpnFile, events });
    expect(result.initialState['pool:budget']).toBe(5);
    for (const firing of result.transitionFirings) {
      expect(firing.input['pool:budget'], `${firing.transitionId} input pool`).toBe(5);
      expect(firing.output['pool:budget'], `${firing.transitionId} output pool`).toBe(5);
    }
  });

  it('inverted oracle — per-firing delta from consecutive full markings is non-negative + token-conserving', () => {
    const result = reduceBrunchExecutionExport({ sdcpnFile, events });

    // referential integrity
    const placeIds = new Set(result.definition.places.map((p) => p.id));
    const transitionIds = new Set(result.definition.transitions.map((t) => t.id));
    for (const f of result.transitionFirings) {
      expect(transitionIds.has(f.transitionId)).toBe(true);
      for (const p of Object.keys(f.input)) expect(placeIds.has(p)).toBe(true);
      for (const p of Object.keys(f.output)) expect(placeIds.has(p)).toBe(true);
    }

    // no negative markings anywhere
    for (const f of result.transitionFirings) {
      for (const v of Object.values(f.input)) if (typeof v === 'number') expect(v).toBeGreaterThanOrEqual(0);
      for (const v of Object.values(f.output)) if (typeof v === 'number') expect(v).toBeGreaterThanOrEqual(0);
    }

    // invert each frame: reconstructed delta (output - input) must match the
    // known event delta (produced - consumed), and conserve tokens on the
    // untouched pool.
    const firingEvents = events.filter((e) => e.kind === 'transition_fired');
    result.transitionFirings.forEach((firing, i) => {
      const ev = firingEvents[i]!;
      if (ev.kind !== 'transition_fired') return;
      const consumed = countsOf(ev.input);
      const produced = countsOf(ev.output);
      const touched = new Set([...Object.keys(consumed), ...Object.keys(produced)]);
      for (const p of touched) {
        const before = (firing.input[p] as number | undefined) ?? 0;
        const after = (firing.output[p] as number | undefined) ?? 0;
        const reconstructed = after - before;
        const expectedDelta = (produced[p] ?? 0) - (consumed[p] ?? 0);
        expect(reconstructed, `frame ${i} place ${p} delta`).toBe(expectedDelta);
      }
      // untouched places are unchanged across the firing
      expect(firing.input['pool:budget']).toBe(firing.output['pool:budget']);
    });

    // final marking: budget intact, source + middle drained, all flow tokens on dst
    const final = result.transitionFirings.at(-1)!.output;
    expect(final).toEqual({ 'pool:budget': 5, dst: 2 });
  });
});

// ---------------------------------------------------------------------------
// FE-819 Card C — synthetic run-status places + final synthetic firing.
//
// The projected definition gains `run:completed` / `run:halted` places and a
// `run:finish` transition; run end fires one synthetic `transition_firing`
// depositing a token in the matching place, so a halt is structurally visible
// in today's Petrinaut. The synthetic firing carries full markings (Card A).
// ---------------------------------------------------------------------------

describe('reduceBrunchExecutionExport — synthetic run-status (Card C)', () => {
  // Hand-crafted two-place / one-transition net so the real firing references
  // ids that exist in the definition (the reducer is the unit under test).
  const sdcpnFile: SdcpnFile = {
    version: 1,
    meta: { generator: 'brunch' },
    title: 'run-status-fixture',
    places: [
      { id: 'a', name: 'A', colorId: null, dynamicsEnabled: false, differentialEquationId: null },
      { id: 'b', name: 'B', colorId: null, dynamicsEnabled: false, differentialEquationId: null },
    ],
    transitions: [
      {
        id: 't-1',
        name: 'T1',
        inputArcs: [{ placeId: 'a', weight: 1, type: 'standard' }],
        outputArcs: [{ placeId: 'b', weight: 1 }],
        lambdaType: 'predicate',
        lambdaCode: '',
        transitionKernelCode: '',
      },
    ],
    types: [],
    differentialEquations: [],
    parameters: [],
    scenarios: [],
    metrics: [],
  };

  function eventsEndingIn(terminal: PetrinautEvent['kind']): PetrinautEvent[] {
    return [
      {
        kind: 'initial_marking',
        ts: '2026-06-02T00:00:00.000Z',
        runId: 'run-c',
        marking: { a: [{ id: 'tok-0' }] },
      },
      {
        kind: 'transition_fired',
        ts: '2026-06-02T00:00:00.100Z',
        runId: 'run-c',
        transitionName: 't-1',
        input: { a: [{ id: 'tok-0' }] },
        output: { b: [{ id: 'tok-1' }] },
      },
      { kind: terminal as 'net_halted', ts: '2026-06-02T00:00:00.200Z', runId: 'run-c' },
    ];
  }

  it('augments the definition with run:completed / run:halted places + a run:finish transition', () => {
    const result = reduceBrunchExecutionExport({ sdcpnFile, events: eventsEndingIn('net_halted') });
    const placeIds = result.definition.places.map((p) => p.id);
    const transitionIds = result.definition.transitions.map((t) => t.id);
    expect(placeIds).toContain(RUN_COMPLETED_PLACE);
    expect(placeIds).toContain(RUN_HALTED_PLACE);
    expect(transitionIds).toContain(RUN_FINISH_TRANSITION);
    // The original net's nodes survive alongside the synthetic ones.
    expect(placeIds).toContain('a');
  });

  it('a halted run fires a synthetic run:finish depositing 1 token in run:halted (0 in run:completed)', () => {
    const result = reduceBrunchExecutionExport({ sdcpnFile, events: eventsEndingIn('net_halted') });
    const last = result.transitionFirings.at(-1)!;
    expect(last.transitionId).toBe(RUN_FINISH_TRANSITION);
    expect(last.output[RUN_HALTED_PLACE]).toBe(1);
    expect(last.output[RUN_COMPLETED_PLACE]).toBeUndefined();
  });

  it('a completed run fires a synthetic run:finish depositing 1 token in run:completed', () => {
    const result = reduceBrunchExecutionExport({ sdcpnFile, events: eventsEndingIn('net_completed') });
    const last = result.transitionFirings.at(-1)!;
    expect(last.transitionId).toBe(RUN_FINISH_TRANSITION);
    expect(last.output[RUN_COMPLETED_PLACE]).toBe(1);
    expect(last.output[RUN_HALTED_PLACE]).toBeUndefined();
  });

  it('a deadlocked run is structurally marked as halted (run:halted)', () => {
    const result = reduceBrunchExecutionExport({ sdcpnFile, events: eventsEndingIn('net_deadlocked') });
    const last = result.transitionFirings.at(-1)!;
    expect(last.output[RUN_HALTED_PLACE]).toBe(1);
  });

  it('the synthetic firing composes with Card A full markings — output keeps the prior marking plus the status token', () => {
    const result = reduceBrunchExecutionExport({ sdcpnFile, events: eventsEndingIn('net_halted') });
    const realFiring = result.transitionFirings.at(-2)!;
    const synthetic = result.transitionFirings.at(-1)!;
    // run:finish's input is the full marking after the real firing.
    expect(synthetic.input).toEqual(realFiring.output);
    // its output is that marking plus exactly the status token.
    expect(synthetic.output).toEqual({ ...realFiring.output, [RUN_HALTED_PLACE]: 1 });
  });

  it('the synthetic run:finish references only ids present in the definition (no unknown-id firings)', () => {
    const result = reduceBrunchExecutionExport({ sdcpnFile, events: eventsEndingIn('net_halted') });
    const placeIds = new Set(result.definition.places.map((p) => p.id));
    const transitionIds = new Set(result.definition.transitions.map((t) => t.id));
    for (const firing of result.transitionFirings) {
      expect(transitionIds.has(firing.transitionId)).toBe(true);
      for (const p of Object.keys(firing.output)) expect(placeIds.has(p)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Type-level pins — locked schema names must remain exported.
// (Compile-time only; runtime no-op.)
// ---------------------------------------------------------------------------

describe('type exports', () => {
  it('exports the locked contract types', () => {
    // If any of these names disappear or change shape, this file fails to
    // compile — the test body is intentionally trivial.
    const m: Marking = { p: 1 };
    const d: NetDefinition = {
      version: 1,
      meta: { generator: 'brunch' },
      title: 't',
      places: [],
      transitions: [],
    };
    // Compile-time bridge: a NetDefinition must remain assignable to the
    // mirrored Petrinaut contract's inferred output, so a TS-type drift between
    // the hand-written types and the schema fails to compile here.
    const contractPin: BrunchNetDefinition = d;
    const e: BrunchExecutionExport = { definition: d, initialState: m, transitionFirings: [] };
    expect(contractPin.places).toEqual([]);
    expect(e.definition.version).toBe(1);
    // PETRINAUT_NET_SCHEMA_VERSION sourced from the static export — confirms
    // the imports line up.
    expect(PETRINAUT_NET_SCHEMA_VERSION).toBeDefined();
  });
});
