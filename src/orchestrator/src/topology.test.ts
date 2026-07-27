import { describe, expect, it } from 'vitest';

import { enumerateCandidateOutputs, evalEnablingGuard, type EnablingGuard } from './net-blueprint.js';
import { compileTopology } from './net-compiler.js';
import type { Plan, ReportLine } from './types.js';

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

describe('evalEnablingGuard', () => {
  it('always returns true regardless of report', () => {
    expect(evalEnablingGuard({ kind: 'always' }, makeReport({ done: false }))).toBe(true);
    expect(evalEnablingGuard({ kind: 'always' }, makeReport({}))).toBe(true);
    expect(evalEnablingGuard({ kind: 'always' }, undefined)).toBe(true);
  });

  it('tokenReportFieldTruthy reads the named report field and coerces to boolean', () => {
    const guard = { kind: 'tokenReportFieldTruthy', field: 'done' } as const;
    expect(evalEnablingGuard(guard, makeReport({ done: true }))).toBe(true);
    expect(evalEnablingGuard(guard, makeReport({ done: false }))).toBe(false);
    expect(evalEnablingGuard(guard, makeReport({ done: 'yes' }))).toBe(true);
    expect(evalEnablingGuard(guard, makeReport({ done: 0 }))).toBe(false);
    expect(evalEnablingGuard(guard, makeReport({ other: true }))).toBe(false);
  });

  it('tokenReportFieldFalsy complements truthy and treats a missing report as falsy', () => {
    const guard = { kind: 'tokenReportFieldFalsy', field: 'passed' } as const;
    expect(evalEnablingGuard(guard, makeReport({ passed: true }))).toBe(false);
    expect(evalEnablingGuard(guard, makeReport({ passed: false }))).toBe(true);
    expect(evalEnablingGuard(guard, makeReport({ passed: 0 }))).toBe(true);
    expect(evalEnablingGuard(guard, makeReport({ other: true }))).toBe(true);
    expect(evalEnablingGuard(guard, undefined)).toBe(true);
  });

  it('tokenReportFieldTruthy returns false when the report is missing', () => {
    const guard = { kind: 'tokenReportFieldTruthy', field: 'done' } as const;
    expect(evalEnablingGuard(guard, undefined)).toBe(false);
  });

  it('throws on unsupported guard kinds', () => {
    const guard = { kind: 'unknown' } as unknown as EnablingGuard;
    expect(() => evalEnablingGuard(guard, makeReport({ done: true }))).toThrow(
      'Unsupported EnablingGuard kind: unknown',
    );
  });
});

// ---------------------------------------------------------------------------
// enumerateCandidateOutputs — pure topology consumer
// ---------------------------------------------------------------------------

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

const multiTargetPlan: Plan = {
  mode: 'greenfield',
  epics: [{ id: 'epic-1', summary: 'E', depends_on: [], verification: [] }],
  slices: [
    {
      id: 'slice-1',
      epic_id: 'epic-1',
      definition: 'D',
      depends_on: [],
      verification: [
        { kind: 'unit-test', target: 'tests/a.test.ts' },
        { kind: 'integration-test', target: 'tests/b.test.ts' },
      ],
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
    // FE-761 Slice 4: the action descriptor now lives on the :complete transition.
    const writeTests = blueprint.transitions.find((t) => t.id === 'slice-1:write-tests:complete');
    expect(writeTests).toBeDefined();
    const handler = writeTests!.handler;
    if (handler.kind !== 'action') throw new Error('expected action descriptor');

    const expected = new Set<string>(handler.outputs);
    if (handler.agentReturnPlace) expected.add(handler.agentReturnPlace);

    expect(enumerateCandidateOutputs(writeTests!)).toEqual(expected);
  });

  it('run-tests producer enumerates intermediatePlace plus budgetPlace', () => {
    const blueprint = compileTopology(simplePlan, { maxRetries: 3 });
    const runTests = blueprint.transitions.find((t) => t.id === 'slice-1:run-tests:complete');
    expect(runTests).toBeDefined();
    const handler = runTests!.handler;
    if (handler.kind !== 'run-tests') throw new Error('expected run-tests descriptor');

    const expected = new Set<string>([
      handler.intermediatePlace,
      handler.budgetPlace,
      'slice:slice-1:halted',
    ]);
    expect(enumerateCandidateOutputs(runTests!)).toEqual(expected);
  });

  it('run-tests producer carries every slice verification target', () => {
    const blueprint = compileTopology(multiTargetPlan, { maxRetries: 3 });
    const runTests = blueprint.transitions.find((t) => t.id === 'slice-1:run-tests:complete');
    expect(runTests).toBeDefined();
    const handler = runTests!.handler;
    if (handler.kind !== 'run-tests') throw new Error('expected run-tests descriptor');

    expect(handler.targets).toEqual(['tests/a.test.ts', 'tests/b.test.ts']);
  });

  it('assess-semantic producer enumerates intermediatePlace plus budgetPlace', () => {
    const blueprint = compileTopology(simplePlan, { maxRetries: 3 });
    const assess = blueprint.transitions.find((t) => t.id === 'slice-1:assess-semantic:complete');
    expect(assess).toBeDefined();
    const handler = assess!.handler;
    if (handler.kind !== 'assess-semantic') throw new Error('expected assess-semantic descriptor');

    const expected = new Set<string>([
      handler.intermediatePlace,
      handler.budgetPlace,
      'slice:slice-1:halted',
    ]);
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
  it("golden: simplePlan 'slice-1:evaluate:complete' producer enumerates to intermediate place plus pool return", () => {
    const blueprint = compileTopology(simplePlan, { maxRetries: 3 });
    const evaluate = blueprint.transitions.find((t) => t.id === 'slice-1:evaluate:complete');
    expect(evaluate).toBeDefined();
    expect(enumerateCandidateOutputs(evaluate!)).toEqual(
      new Set(['slice:slice-1:evaluate:reported', 'pool:test-agent']),
    );
  });

  it("golden: simplePlan 'slice-1:run-tests:complete' producer enumerates intermediate place plus retry-budget", () => {
    const blueprint = compileTopology(simplePlan, { maxRetries: 3 });
    const runTests = blueprint.transitions.find((t) => t.id === 'slice-1:run-tests:complete');
    expect(runTests).toBeDefined();
    expect(enumerateCandidateOutputs(runTests!)).toEqual(
      new Set(['slice:slice-1:run-tests:reported', 'slice:slice-1:retry-budget', 'slice:slice-1:halted']),
    );
  });

  it("golden: simplePlan 'slice-1:assess-semantic:complete' producer enumerates intermediate plus semantic-budget", () => {
    const blueprint = compileTopology(simplePlan, { maxRetries: 3 });
    const assess = blueprint.transitions.find((t) => t.id === 'slice-1:assess-semantic:complete');
    expect(assess).toBeDefined();
    expect(enumerateCandidateOutputs(assess!)).toEqual(
      new Set([
        'slice:slice-1:assess-semantic:reported',
        'slice:slice-1:semantic-budget',
        'slice:slice-1:halted',
      ]),
    );
  });

  // FE-761 Slice 4: explicit dispatch + running-place topology
  it('golden: simplePlan dispatch transitions emit to running:* sentinels', () => {
    const blueprint = compileTopology(simplePlan, { maxRetries: 3 });
    const cases = [
      { id: 'slice-1:evaluate:dispatch', running: 'slice:slice-1:evaluate:running' },
      { id: 'slice-1:write-tests:dispatch', running: 'slice:slice-1:write-tests:running' },
      { id: 'slice-1:write-code:dispatch', running: 'slice:slice-1:write-code:running' },
      { id: 'slice-1:run-tests:dispatch', running: 'slice:slice-1:run-tests:running' },
      { id: 'slice-1:assess-semantic:dispatch', running: 'slice:slice-1:assess-semantic:running' },
    ];
    for (const { id, running } of cases) {
      const dispatch = blueprint.transitions.find((t) => t.id === id);
      expect(dispatch, `expect dispatch transition ${id}`).toBeDefined();
      expect(dispatch!.handler.kind).toBe('dispatch');
      expect(enumerateCandidateOutputs(dispatch!)).toEqual(new Set([running]));
    }
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
    // FE-761 Slice 4: producer is now the :complete phase of the dispatch/complete split.
    const producer = blueprint.transitions.find((t) => t.id === 'slice-1:evaluate:complete');
    expect(producer, 'producer transition slice-1:evaluate:complete should exist').toBeDefined();
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

  it('run-tests decomposes into producer + 2 sibling passthroughs (pass / fail)', () => {
    const blueprint = compileTopology(simplePlan, { maxRetries: 3 });

    const producer = blueprint.transitions.find((t) => t.id === 'slice-1:run-tests:complete');
    expect(producer).toBeDefined();
    expect(producer!.handler.kind).toBe('run-tests');

    // Producer emits to intermediate place + budget place; no direct pass/fail routes.
    const producerOutputs = enumerateCandidateOutputs(producer!);
    expect(producerOutputs).toEqual(
      new Set(['slice:slice-1:run-tests:reported', 'slice:slice-1:retry-budget', 'slice:slice-1:halted']),
    );

    // Siblings consume from intermediate and route by enabling guard.
    const passSibling = blueprint.transitions.find((t) => t.id === 'slice-1:run-tests:pass');
    const failSibling = blueprint.transitions.find((t) => t.id === 'slice-1:run-tests:fail');
    expect(passSibling, 'expect run-tests:pass sibling').toBeDefined();
    expect(failSibling, 'expect run-tests:fail sibling').toBeDefined();

    for (const sibling of [passSibling!, failSibling!]) {
      expect(sibling.inputs).toEqual(['slice:slice-1:run-tests:reported']);
      expect(sibling.handler.kind).toBe('sibling-passthrough');
    }

    expect(enumerateCandidateOutputs(passSibling!)).toEqual(new Set(['slice:slice-1:spec-ready']));
    expect(enumerateCandidateOutputs(failSibling!)).toEqual(new Set(['slice:slice-1:failing-tests']));

    // Branching descriptor fields are gone from the producer.
    const producerHandler = producer!.handler;
    if (producerHandler.kind === 'run-tests') {
      expect(producerHandler).not.toHaveProperty('onPass');
      expect(producerHandler).not.toHaveProperty('onFail');
    }
  });

  it('verify-epic decomposes into producer + pass sibling + fail→remediate router (FE-884)', () => {
    // verifyPlan: epic-1 has verification, slice-1 inside it.
    const verifyPlan = {
      mode: 'greenfield' as const,
      epics: [
        {
          id: 'epic-1',
          summary: 'E',
          depends_on: [],
          verification: [{ kind: 'integration-test' as const, target: 'it.test.ts' }],
        },
      ],
      slices: [
        {
          id: 'slice-1',
          epic_id: 'epic-1',
          definition: 'D',
          depends_on: [],
          verification: [{ kind: 'unit-test' as const, target: 't' }],
        },
      ],
    };
    const blueprint = compileTopology(verifyPlan, { maxRetries: 3 });

    const producer = blueprint.transitions.find((t) => t.id === 'epic-verify:epic-1:complete');
    expect(producer, 'expect verify-epic producer').toBeDefined();
    expect(producer!.handler.kind).toBe('verify-epic');

    // FE-884: the verify producer carries the epic retry budget — it emits to the
    // intermediate place, the budget place, and (on exhaustion) the halt place,
    // mirroring the slice run-tests producer. Slice B adds the verify-ready place:
    // an infra/timeout verdict re-runs verify (bounded) without remediation.
    expect(enumerateCandidateOutputs(producer!)).toEqual(
      new Set([
        'epic:epic-1:verify:reported',
        'epic:epic-1:retry-budget',
        'epic:epic-1:halted',
        'epic:epic-1:verify-ready',
      ]),
    );

    // FE-884 Slice B: the verify producer descriptor carries the infra-retry
    // budget + reverify target distinct from the remediation retry budget.
    const verifyHandler = producer!.handler as {
      kind: string;
      maxInfraRetries: number;
      reverifyPlace: string;
    };
    expect(verifyHandler.maxInfraRetries).toBe(3);
    expect(verifyHandler.reverifyPlace).toBe('epic:epic-1:verify-ready');

    const passSibling = blueprint.transitions.find((t) => t.id === 'epic-verify:epic-1:pass');
    const failSibling = blueprint.transitions.find((t) => t.id === 'epic-verify:epic-1:fail');
    expect(passSibling, 'expect epic-verify:pass sibling').toBeDefined();
    expect(failSibling, 'expect epic-verify:fail router').toBeDefined();

    for (const sibling of [passSibling!, failSibling!]) {
      expect(sibling.inputs).toEqual(['epic:epic-1:verify:reported']);
    }

    // Pass sibling emits to the epic done place (no depSignals here — epic-1 has no epic dependents).
    expect(enumerateCandidateOutputs(passSibling!)).toEqual(new Set(['epic:epic-1:done']));

    // FE-884: the fail sibling is now a router to remediation, not a halt sink.
    // Halt is the producer's job on budget exhaustion.
    expect(enumerateCandidateOutputs(failSibling!)).toEqual(new Set(['epic:epic-1:remediate:ready']));

    // Branching descriptor fields are gone from the producer.
    const producerHandler = producer!.handler;
    if (producerHandler.kind === 'verify-epic') {
      expect(producerHandler).not.toHaveProperty('onPassOutputs');
    }
  });

  it('assess-semantic decomposes into producer + 2 sibling passthroughs (satisfied / rejected)', () => {
    const blueprint = compileTopology(simplePlan, { maxRetries: 3 });

    const producer = blueprint.transitions.find((t) => t.id === 'slice-1:assess-semantic:complete');
    expect(producer).toBeDefined();
    expect(producer!.handler.kind).toBe('assess-semantic');

    // Producer emits to intermediate + budget place; no direct satisfied/rejected routes.
    const producerOutputs = enumerateCandidateOutputs(producer!);
    expect(producerOutputs).toEqual(
      new Set([
        'slice:slice-1:assess-semantic:reported',
        'slice:slice-1:semantic-budget',
        'slice:slice-1:halted',
      ]),
    );

    const satSibling = blueprint.transitions.find((t) => t.id === 'slice-1:assess-semantic:satisfied');
    const rejSibling = blueprint.transitions.find((t) => t.id === 'slice-1:assess-semantic:rejected');
    expect(satSibling, 'expect assess-semantic:satisfied sibling').toBeDefined();
    expect(rejSibling, 'expect assess-semantic:rejected sibling').toBeDefined();

    for (const sibling of [satSibling!, rejSibling!]) {
      expect(sibling.inputs).toEqual(['slice:slice-1:assess-semantic:reported']);
      expect(sibling.handler.kind).toBe('sibling-passthrough');
    }

    expect(enumerateCandidateOutputs(satSibling!)).toEqual(new Set(['slice:slice-1:semantic-satisfied']));
    expect(enumerateCandidateOutputs(rejSibling!)).toEqual(new Set(['slice:slice-1:needs-more']));

    const producerHandler = producer!.handler;
    if (producerHandler.kind === 'assess-semantic') {
      expect(producerHandler).not.toHaveProperty('onSatisfied');
      expect(producerHandler).not.toHaveProperty('onRejected');
    }
  });
});

// ---------------------------------------------------------------------------
// FE-761 Slice 2a: halted-as-place
//
// Halt paths (retry exhaustion in run-tests, rework exhaustion in
// assess-semantic, verify-epic failure) now emit a halt token to a
// `slice:<sid>:halted` or `epic:<eid>:halted` place instead of only
// mutating ctx.halted in a fire closure. This makes halt observable at the
// topology level and is a precondition for Slice 2b's dispatch/complete
// async refactor (which retires ctx.halted entirely).
// ---------------------------------------------------------------------------

describe('FE-761 Slice 2a: halted-as-place', () => {
  it('declares slice:<sid>:halted place for every slice', () => {
    const blueprint = compileTopology(depPlan, { maxRetries: 3 });
    expect(blueprint.places).toContain('slice:slice-a:halted');
    expect(blueprint.places).toContain('slice:slice-b:halted');
  });

  it('declares epic:<eid>:halted place for every epic with verification', () => {
    const verifyPlan: Plan = {
      mode: 'greenfield',
      epics: [
        {
          id: 'epic-1',
          summary: 'E',
          depends_on: [],
          verification: [{ kind: 'integration-test', target: 'it.test.ts' }],
        },
      ],
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
    const blueprint = compileTopology(verifyPlan, { maxRetries: 3 });
    expect(blueprint.places).toContain('epic:epic-1:halted');
  });

  it('does not declare epic:<eid>:halted for epics without verification', () => {
    const blueprint = compileTopology(simplePlan, { maxRetries: 3 });
    expect(blueprint.places).not.toContain('epic:epic-1:halted');
  });
});

// ---------------------------------------------------------------------------
// FE-884: recoverable epic verification
//
// A failed epic verification routes to a remediation code agent against the
// folded epic tree and re-verifies, mirroring the slice run-tests retry loop.
// The budget lives in the verify producer; the fail sibling is a pure router to
// remediation; halt happens only on budget exhaustion.
// ---------------------------------------------------------------------------

describe('FE-884: recoverable epic verification', () => {
  // The remediation topology is compiled for every plan; codebase-only behavior
  // (the actual remediation round-trip) is gated at runtime via sandboxMode, so
  // the topology fixture is a plain brownfield plan, not the (invalid) 'codebase'
  // plan mode.
  const verifyPlan: Plan = {
    mode: 'brownfield',
    epics: [
      {
        id: 'epic-1',
        summary: 'E',
        depends_on: [],
        verification: [{ kind: 'integration-test', target: 'it.test.ts' }],
      },
    ],
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

  it('declares the epic remediation places and seeds the retry budget', () => {
    const blueprint = compileTopology(verifyPlan, { maxRetries: 3 });
    expect(blueprint.places).toContain('epic:epic-1:retry-budget');
    expect(blueprint.places).toContain('epic:epic-1:remediate:ready');
    expect(blueprint.places).toContain('epic:epic-1:remediate:running');

    const budgetSeed = blueprint.initialTokens.find((t) => t.place === 'epic:epic-1:retry-budget');
    expect(budgetSeed, 'expect a seeded epic retry-budget token').toBeDefined();
    expect(budgetSeed!.token.retryCount).toBe(0);
  });

  it('verify dispatch consumes the epic retry-budget (budget checked out for the verify)', () => {
    const blueprint = compileTopology(verifyPlan, { maxRetries: 3 });
    const dispatch = blueprint.transitions.find((t) => t.id === 'epic-verify:epic-1:dispatch');
    expect(dispatch).toBeDefined();
    expect(dispatch!.inputs).toEqual(['epic:epic-1:verify-ready', 'epic:epic-1:retry-budget']);
  });

  it('the fail sibling routes to remediation, not the halt place', () => {
    const blueprint = compileTopology(verifyPlan, { maxRetries: 3 });
    const failSibling = blueprint.transitions.find((t) => t.id === 'epic-verify:epic-1:fail');
    expect(failSibling).toBeDefined();
    expect(enumerateCandidateOutputs(failSibling!)).toEqual(new Set(['epic:epic-1:remediate:ready']));
  });

  it('remediation decomposes into dispatch (grabs code agent) + complete (loops back to verify)', () => {
    const blueprint = compileTopology(verifyPlan, { maxRetries: 3 });

    const dispatch = blueprint.transitions.find((t) => t.id === 'epic-remediate:epic-1:dispatch');
    expect(dispatch, 'expect remediate dispatch').toBeDefined();
    expect(dispatch!.inputs).toEqual(['epic:epic-1:remediate:ready', 'pool:code-agent']);
    expect(enumerateCandidateOutputs(dispatch!)).toEqual(new Set(['epic:epic-1:remediate:running']));

    const complete = blueprint.transitions.find((t) => t.id === 'epic-remediate:epic-1:complete');
    expect(complete, 'expect remediate complete').toBeDefined();
    expect(complete!.handler.kind).toBe('remediate-epic');
    expect(complete!.inputs).toEqual(['epic:epic-1:remediate:running']);
    // Loops back to re-verify and returns the code agent to its pool.
    expect(enumerateCandidateOutputs(complete!)).toEqual(
      new Set(['epic:epic-1:verify-ready', 'pool:code-agent']),
    );

    const handler = complete!.handler;
    if (handler.kind === 'remediate-epic') {
      // Detect-and-reject knows the epic's own integration test targets.
      expect(handler.epicTestTargets).toEqual(['it.test.ts']);
    }
  });

  it('the verify producer carries the epic retry budget and max-retries', () => {
    const blueprint = compileTopology(verifyPlan, { maxRetries: 5 });
    const producer = blueprint.transitions.find((t) => t.id === 'epic-verify:epic-1:complete');
    const handler = producer!.handler;
    expect(handler.kind).toBe('verify-epic');
    if (handler.kind === 'verify-epic') {
      expect(handler.budgetPlace).toBe('epic:epic-1:retry-budget');
      expect(handler.maxRetries).toBe(5);
    }
  });
});
