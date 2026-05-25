import { describe, expect, it } from 'vitest';

import { enumerateCandidateOutputs, evalRouteGuard } from './net-blueprint.js';
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

  it('action transitions enumerate the union of onTrue, onFalse, and agentReturnPlace', () => {
    const blueprint = compileTopology(simplePlan, { maxRetries: 3 });
    const writeTests = blueprint.transitions.find((t) => t.id.endsWith(':write-tests'));
    expect(writeTests).toBeDefined();
    const handler = writeTests!.handler;
    if (handler.kind !== 'action') throw new Error('expected action descriptor');

    const expected = new Set<string>([...handler.onTrue, ...handler.onFalse]);
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
});
