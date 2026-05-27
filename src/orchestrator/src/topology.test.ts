import { describe, expect, it } from 'vitest';

import { enumerateCandidateOutputs, evalRouteGuard, type RouteGuard } from './net-blueprint.js';
import { compileTopology } from './net-compiler.js';
import type { Plan, ReportLine } from './types.js';

// ---------------------------------------------------------------------------
// evalRouteGuard — pure interpreter for declarative routing guards
// ---------------------------------------------------------------------------

function makeReport(payload: Record<string, unknown>): ReportLine {
  return {
    id: 'rpt-x',
    ts: '2026-05-26T00:00:00.000Z',
    epicId: 'epic-1',
    sliceId: 'slice-1',
    actor: 'test',
    event: 'test',
    payload,
  };
}

describe('evalRouteGuard', () => {
  it('always returns true regardless of report', () => {
    expect(evalRouteGuard({ kind: 'always' }, makeReport({ done: false }))).toBe(true);
    expect(evalRouteGuard({ kind: 'always' }, makeReport({}))).toBe(true);
    expect(evalRouteGuard({ kind: 'always' }, undefined)).toBe(true);
  });

  it('reportFieldTruthy reads the named field and coerces to boolean', () => {
    const guard = { kind: 'reportFieldTruthy', field: 'done' } as const;
    expect(evalRouteGuard(guard, makeReport({ done: true }))).toBe(true);
    expect(evalRouteGuard(guard, makeReport({ done: false }))).toBe(false);
    expect(evalRouteGuard(guard, makeReport({ done: 'yes' }))).toBe(true);
    expect(evalRouteGuard(guard, makeReport({ done: 0 }))).toBe(false);
    expect(evalRouteGuard(guard, makeReport({ other: true }))).toBe(false);
  });

  it('reportFieldTruthy returns false when the report is missing', () => {
    const guard = { kind: 'reportFieldTruthy', field: 'done' } as const;
    expect(evalRouteGuard(guard, undefined)).toBe(false);
  });

  it('throws on unsupported guard kinds', () => {
    const guard = { kind: 'unknown' } as unknown as RouteGuard;
    expect(() => evalRouteGuard(guard, makeReport({ done: true }))).toThrow(
      'Unsupported RouteGuard kind: unknown',
    );
  });
});

// ---------------------------------------------------------------------------
// enumerateCandidateOutputs — pure topology consumer
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

describe('enumerateCandidateOutputs', () => {
  it('returns a non-empty output set for every transition in simplePlan', () => {
    const blueprint = compileTopology(simplePlan, { maxRetries: 3 });
    for (const transition of blueprint.transitions) {
      const outputs = enumerateCandidateOutputs(transition);
      expect(outputs.size, `${transition.id} has empty output set`).toBeGreaterThan(0);
    }
  });

  it('returns only declared places (no runtime synthesis)', () => {
    const blueprint = compileTopology(simplePlan, { maxRetries: 3 });
    const declaredPlaces = new Set(blueprint.places);
    for (const transition of blueprint.transitions) {
      for (const place of enumerateCandidateOutputs(transition)) {
        expect(declaredPlaces.has(place), `${transition.id} emits to undeclared place ${place}`).toBe(true);
      }
    }
  });

  it('action transitions enumerate outputs plus agentReturnPlace', () => {
    const blueprint = compileTopology(simplePlan, { maxRetries: 3 });
    const writeTests = blueprint.transitions.find((t) => t.id.endsWith(':write-tests'));
    expect(writeTests).toBeDefined();
    const handler = writeTests!.handler;
    if (handler.kind !== 'action') throw new Error('expected action descriptor');

    const expected = new Set<string>(handler.outputs);
    if (handler.agentReturnPlace) expected.add(handler.agentReturnPlace);

    expect(enumerateCandidateOutputs(writeTests!)).toEqual(expected);
  });

  it('run-tests transitions enumerate onPass, onFail, and budgetPlace', () => {
    const blueprint = compileTopology(simplePlan, { maxRetries: 3 });
    const runTests = blueprint.transitions.find((t) => t.id.endsWith(':run-tests'));
    expect(runTests).toBeDefined();
    const handler = runTests!.handler;
    if (handler.kind !== 'run-tests') throw new Error('expected run-tests descriptor');

    const expected = new Set<string>([...handler.onPass, ...handler.onFail, handler.budgetPlace]);
    expect(enumerateCandidateOutputs(runTests!)).toEqual(expected);
  });

  it('assess-semantic transitions enumerate onSatisfied, onRejected, and budgetPlace', () => {
    const blueprint = compileTopology(simplePlan, { maxRetries: 3 });
    const assess = blueprint.transitions.find((t) => t.id.endsWith(':assess-semantic'));
    expect(assess).toBeDefined();
    const handler = assess!.handler;
    if (handler.kind !== 'assess-semantic') throw new Error('expected assess-semantic descriptor');

    const expected = new Set<string>([...handler.onSatisfied, ...handler.onRejected, handler.budgetPlace]);
    expect(enumerateCandidateOutputs(assess!)).toEqual(expected);
  });

  it('depPlan: dep-signal places are reachable from complete-slice topology', () => {
    const blueprint = compileTopology(depPlan, { maxRetries: 3 });
    const completeA = blueprint.transitions.find((t) => t.id === 'slice-a:return-done');
    expect(completeA).toBeDefined();
    const outputs = enumerateCandidateOutputs(completeA!);
    expect(outputs.has('slice:slice-a:dep-signal:slice-b')).toBe(true);
  });

  // Goldens — literal expected sets, not derived from descriptor fields.
  // These catch silent lockstep drift in both the descriptor emitter and the enumerator.
  it("golden: simplePlan 'slice-1:evaluate' producer enumerates to intermediate place plus pool return", () => {
    const blueprint = compileTopology(simplePlan, { maxRetries: 3 });
    const evaluate = blueprint.transitions.find((t) => t.id === 'slice-1:evaluate');
    expect(evaluate).toBeDefined();
    expect(enumerateCandidateOutputs(evaluate!)).toEqual(
      new Set(['slice:slice-1:evaluate:reported', 'pool:test-agent']),
    );
  });

  it("golden: simplePlan 'slice-1:run-tests' enumerates to pass, fail, and retry-budget", () => {
    const blueprint = compileTopology(simplePlan, { maxRetries: 3 });
    const runTests = blueprint.transitions.find((t) => t.id === 'slice-1:run-tests');
    expect(runTests).toBeDefined();
    expect(enumerateCandidateOutputs(runTests!)).toEqual(
      new Set(['slice:slice-1:spec-ready', 'slice:slice-1:failing-tests', 'slice:slice-1:retry-budget']),
    );
  });

  it("golden: simplePlan 'slice-1:assess-semantic' enumerates to satisfied, rejected, and semantic-budget", () => {
    const blueprint = compileTopology(simplePlan, { maxRetries: 3 });
    const assess = blueprint.transitions.find((t) => t.id === 'slice-1:assess-semantic');
    expect(assess).toBeDefined();
    expect(enumerateCandidateOutputs(assess!)).toEqual(
      new Set([
        'slice:slice-1:semantic-satisfied',
        'slice:slice-1:needs-more',
        'slice:slice-1:semantic-budget',
      ]),
    );
  });
});

// ---------------------------------------------------------------------------
// FE-761 Slice 1: sibling transitions for conditional branching
// ---------------------------------------------------------------------------
//
// Acceptance: every conditional action-transition decomposes into:
//   1. one producer transition, emitting to a single new intermediate place
//      `slice:<sliceId>:<step>:reported` with the action's report attached to
//      the output token
//   2. N sibling passthrough transitions, each consuming from the intermediate
//      place, evaluating an EnablingGuard over the token payload, and emitting
//      to exactly one fixed output set
//
// Result: every TransitionSkeleton has one fixed output set; conditional
// choice happens via mutually-exclusive enabling guards on siblings.
// ---------------------------------------------------------------------------

describe('FE-761 Slice 1: sibling-transition decomposition', () => {
  it('evaluate decomposes into producer + 2 sibling passthroughs (done / more)', () => {
    const blueprint = compileTopology(simplePlan, { maxRetries: 3 });

    // Producer: runs evaluate-done action, attaches report, emits to intermediate.
    const producer = blueprint.transitions.find((t) => t.id === 'slice-1:evaluate');
    expect(producer, 'producer transition slice-1:evaluate should exist').toBeDefined();
    expect(producer!.handler.kind).toBe('action');

    // Producer must emit to exactly one intermediate place (plus pool return).
    const producerOutputs = enumerateCandidateOutputs(producer!);
    expect(
      producerOutputs.has('slice:slice-1:evaluate:reported'),
      'producer must emit to slice-1:evaluate:reported intermediate',
    ).toBe(true);

    // Sibling siblings: two passthroughs that route based on enabling guard.
    const siblings = blueprint.transitions.filter(
      (t) => t.id === 'slice-1:evaluate:done' || t.id === 'slice-1:evaluate:more',
    );
    expect(siblings, 'expect 2 sibling passthrough transitions').toHaveLength(2);

    // Each sibling consumes from the intermediate place.
    for (const sibling of siblings) {
      expect(sibling.inputs, `${sibling.id} must consume from slice-1:evaluate:reported`).toContain(
        'slice:slice-1:evaluate:reported',
      );
    }

    // Each sibling has exactly one fixed output set — no branching descriptor.
    const doneSibling = siblings.find((t) => t.id === 'slice-1:evaluate:done')!;
    const moreSibling = siblings.find((t) => t.id === 'slice-1:evaluate:more')!;
    expect(enumerateCandidateOutputs(doneSibling)).toEqual(new Set(['slice:slice-1:done-spec']));
    expect(enumerateCandidateOutputs(moreSibling)).toEqual(new Set(['slice:slice-1:needs-more']));

    // Branching descriptor fields are gone from the action descriptor.
    const producerHandler = producer!.handler;
    if (producerHandler.kind === 'action') {
      expect(producerHandler).not.toHaveProperty('onTrue');
      expect(producerHandler).not.toHaveProperty('onFalse');
    }
  });
});
