import { describe, expect, it } from 'vitest';

import { compileTopology } from './net-compiler.js';
import { type PetrinautEvent } from './petrinaut-events.js';
import { PETRINAUT_NET_SCHEMA_VERSION, serializeBlueprint } from './petrinaut-export.js';
import { createIdentityFolding } from './petrinaut-fold.js';
import { toSdcpnFile, type SdcpnFile } from './petrinaut-sdcpn.js';
import {
  type BrunchExecutionExport,
  type Marking,
  type NetDefinition,
  reduceBrunchExecutionExport,
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

  it('projects NetDefinition with exactly six fields — drops scenarios, differentialEquations, parameters, metrics', () => {
    const sdcpnFile = buildSdcpnFile(simplePlan);
    const result = reduceBrunchExecutionExport({ sdcpnFile, events: syntheticEvents() });

    expect(Object.keys(result.definition).sort()).toEqual(
      ['meta', 'places', 'title', 'transitions', 'types', 'version'].sort(),
    );
    expect(result.definition).not.toHaveProperty('scenarios');
    expect(result.definition).not.toHaveProperty('differentialEquations');
    expect(result.definition).not.toHaveProperty('parameters');
    expect(result.definition).not.toHaveProperty('metrics');
  });

  it('preserves NetDefinition field values byte-for-byte against the input SdcpnFile', () => {
    const sdcpnFile = buildSdcpnFile(simplePlan);
    const result = reduceBrunchExecutionExport({ sdcpnFile, events: syntheticEvents() });

    expect(result.definition.version).toBe(sdcpnFile.version);
    expect(result.definition.meta).toBe(sdcpnFile.meta);
    expect(result.definition.title).toBe(sdcpnFile.title);
    expect(result.definition.places).toBe(sdcpnFile.places);
    expect(result.definition.transitions).toBe(sdcpnFile.transitions);
    expect(result.definition.types).toBe(sdcpnFile.types);
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

  it('ignores terminal events (net_halted / net_deadlocked) — they do not appear in transitionFirings', () => {
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
    expect(result.transitionFirings).toHaveLength(0);
  });

  it('throws when initial_marking event is missing', () => {
    const sdcpnFile = buildSdcpnFile(simplePlan);
    expect(() => reduceBrunchExecutionExport({ sdcpnFile, events: [] })).toThrow(/initial_marking/);
  });
});

// ---------------------------------------------------------------------------
// Frame-replay oracle — the load-bearing test for the contract.
//
// Mirrors `/tmp/reduce-export.mjs`, proven on real run 904d205d (75 firings,
// 0 negative-marking violations). This version uses a hand-crafted minimal
// fixture: a 3-place / 2-transition net with a deterministic firing trace
// that exercises (a) consume-then-produce flow, (b) tokens flowing to a
// terminal place, (c) referential integrity, (d) replay invariants.
//
// Hand-crafted rather than engine-driven because the reducer is the unit under
// test here. Engine-driven oracles elsewhere exercise the identity-fold
// default end to end.
// ---------------------------------------------------------------------------

describe('reduceBrunchExecutionExport — frame-replay oracle', () => {
  it('reconstructs every marking from initialState + deltas with zero negative-marking violations', () => {
    // Three-place, two-transition net: src -- t-consume --> middle -- t-emit --> dst
    const sdcpnFile: SdcpnFile = {
      version: 1,
      meta: { generator: 'brunch', generatorVersion: '0.2.0' },
      title: 'frame-replay-fixture',
      places: [
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
        marking: { src: [{ id: 'tk-a' }, { id: 'tk-b' }] }, // 2 tokens on src
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
      { kind: 'net_halted', ts: '2026-06-02T00:00:00.500Z', runId: 'run-replay' },
    ];

    const result = reduceBrunchExecutionExport({ sdcpnFile, events });

    // ---- referential integrity ----
    const placeIds = new Set(result.definition.places.map((p) => p.id));
    const transitionIds = new Set(result.definition.transitions.map((t) => t.id));
    for (const p of Object.keys(result.initialState)) {
      expect(placeIds.has(p)).toBe(true);
    }
    for (const f of result.transitionFirings) {
      expect(transitionIds.has(f.transitionId)).toBe(true);
      for (const p of Object.keys(f.input)) expect(placeIds.has(p)).toBe(true);
      for (const p of Object.keys(f.output)) expect(placeIds.has(p)).toBe(true);
    }

    // ---- frame replay: starting from initialState, apply each firing's
    // deltas. No place count may go negative at any frame. ----
    const marking: Record<string, number> = {};
    for (const [p, v] of Object.entries(result.initialState)) {
      if (typeof v === 'number') marking[p] = v;
    }
    let frame = 0;
    for (const firing of result.transitionFirings) {
      frame += 1;
      for (const [p, n] of Object.entries(firing.input)) {
        if (typeof n !== 'number') continue;
        marking[p] = (marking[p] ?? 0) - n;
        expect(
          marking[p],
          `frame ${frame} (${firing.transitionId}) place ${p} negative`,
        ).toBeGreaterThanOrEqual(0);
      }
      for (const [p, n] of Object.entries(firing.output)) {
        if (typeof n !== 'number') continue;
        marking[p] = (marking[p] ?? 0) + n;
      }
    }

    // ---- final marking sanity: source drained, middle drained, all tokens on dst ----
    const finalNonEmpty = Object.fromEntries(Object.entries(marking).filter(([, n]) => n > 0));
    expect(finalNonEmpty).toEqual({ dst: 2 });
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
      types: [],
    };
    const e: BrunchExecutionExport = { definition: d, initialState: m, transitionFirings: [] };
    expect(e.definition.version).toBe(1);
    // PETRINAUT_NET_SCHEMA_VERSION sourced from the static export — confirms
    // the imports line up.
    expect(PETRINAUT_NET_SCHEMA_VERSION).toBeDefined();
  });
});
