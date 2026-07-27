import { describe, expect, it } from 'vitest';

import { enumerateCandidateOutputs } from './net-blueprint.js';
import { compileTopology } from './net-compiler.js';
import type { PetrinautEvent } from './petrinaut-events.js';
import { serializeBlueprint } from './petrinaut-export.js';
import { createIdentityFolding } from './petrinaut-fold.js';
import { projectBlueprintLanes, projectMarking } from './petrinaut-lane-projection.js';
import { toSdcpnFile } from './petrinaut-sdcpn.js';
import { reduceBrunchExecutionExport } from './petrinaut-stream-export.js';
import type { Plan } from './types.js';

// Two slices in one epic: slice-b depends on slice-a, so the projection must
// preserve the `dep-signal:slice-a:slice-b` fan-out that `return-done` emits or
// slice-b never unlocks.
const twoSlicePlan: Plan = {
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

describe('projectBlueprintLanes — mechanical mode', () => {
  it('drops every semantic-lane transition', () => {
    const blueprint = compileTopology(twoSlicePlan, { maxRetries: 3 });

    // Sanity: the source net actually has semantic-lane transitions to drop.
    expect(blueprint.transitions.some((t) => t.contract.lane === 'semantic')).toBe(true);

    const projected = projectBlueprintLanes(blueprint, 'mechanical');

    expect(projected.transitions.some((t) => t.contract.lane === 'semantic')).toBe(false);
  });

  it('rewrites return-done into a mechanical done-spec → completed bridge that keeps the dep-signal fan-out', () => {
    const projected = projectBlueprintLanes(compileTopology(twoSlicePlan, { maxRetries: 3 }), 'mechanical');

    // The bridge: a surviving (mechanical) transition that consumes slice-a's
    // done-spec and produces slice-a's completed + the dep-signal that unlocks
    // slice-b. Without it, completion + downstream unlock are unreachable.
    const bridge = projected.transitions.find(
      (t) =>
        t.contract.lane !== 'semantic' &&
        t.inputs.includes('slice:slice-a:done-spec') &&
        enumerateCandidateOutputs(t).has('slice:slice-a:completed'),
    );

    expect(bridge).toBeDefined();
    expect(enumerateCandidateOutputs(bridge!).has('slice:slice-a:dep-signal:slice-b')).toBe(true);
    // done-spec's only consumer in both-mode (assess-semantic:dispatch) is gone,
    // so the bridge is the sole path out of done-spec.
    expect(bridge!.inputs).not.toContain('slice:slice-a:semantic-satisfied');
  });

  it('drops semantic-only places but keeps cross-lane and downstream places', () => {
    const projected = projectBlueprintLanes(compileTopology(twoSlicePlan, { maxRetries: 3 }), 'mechanical');
    const places = new Set(projected.places);

    for (const sid of ['slice-a', 'slice-b']) {
      for (const suffix of [
        'semantic-budget',
        'semantic-satisfied',
        'assess-semantic:running',
        'assess-semantic:reported',
      ]) {
        expect(places.has(`slice:${sid}:${suffix}`)).toBe(false);
      }
    }
    // Cross-lane / mechanical / fan-out places survive.
    expect(places.has('slice:slice-a:done-spec')).toBe(true);
    expect(places.has('slice:slice-a:completed')).toBe(true);
    expect(places.has('slice:slice-a:dep-signal:slice-b')).toBe(true);
    // The halt sink survives — it is produced by run-tests:complete (mechanical),
    // not only by the semantic lane, so a halt stays visible in mechanical mode.
    expect(places.has('slice:slice-a:halted')).toBe(true);
  });

  it('drops the semantic-budget seed from initialTokens', () => {
    const projected = projectBlueprintLanes(compileTopology(twoSlicePlan, { maxRetries: 3 }), 'mechanical');

    expect(projected.initialTokens.some((seed) => seed.place.endsWith(':semantic-budget'))).toBe(false);
    // retry-budget (mechanical) seed survives.
    expect(projected.initialTokens.some((seed) => seed.place.endsWith(':retry-budget'))).toBe(true);
  });
});

describe('projectBlueprintLanes — both mode', () => {
  it('is the identity projection (returns the input by reference)', () => {
    const blueprint = compileTopology(twoSlicePlan, { maxRetries: 3 });
    expect(projectBlueprintLanes(blueprint, 'both')).toBe(blueprint);
  });
});

// Integration: a mechanical-projected blueprint, serialized and reduced with
// REAL-net events (which still include semantic firings, since execution runs
// the full net), must yield an export with no semantic nodes anywhere.
describe('mechanical projection — export integration', () => {
  const SEMANTIC = /semantic-budget|semantic-satisfied|assess-semantic/;

  function mechanicalExport() {
    const projected = projectBlueprintLanes(compileTopology(twoSlicePlan, { maxRetries: 3 }), 'mechanical');
    const net = serializeBlueprint(projected, {
      runId: 'run-test',
      folding: createIdentityFolding(projected),
    });
    const sdcpnFile = toSdcpnFile(net, {});

    const events: PetrinautEvent[] = [
      {
        kind: 'initial_marking',
        ts: '2026-06-02T00:00:00.000Z',
        runId: 'run-test',
        marking: {
          'pool:test-agent': [{ id: 't1' }],
          'slice:slice-a:semantic-budget': [{ id: 'b1', sliceId: 'slice-a' }],
          'slice:slice-a:done-spec': [{ id: 'd1', sliceId: 'slice-a' }],
        },
      },
      // Semantic firing — consumes done-spec in the real net; must be DROPPED.
      {
        kind: 'transition_fired',
        ts: '2026-06-02T00:00:00.100Z',
        runId: 'run-test',
        transitionName: 'slice-a:assess-semantic:dispatch',
        input: {
          'slice:slice-a:done-spec': [{ id: 'd1', sliceId: 'slice-a' }],
          'slice:slice-a:semantic-budget': [{ id: 'b1', sliceId: 'slice-a' }],
        },
        output: { 'slice:slice-a:assess-semantic:running': [{ id: 'r1', sliceId: 'slice-a' }] },
      },
      // The bridge (rewritten return-done) — KEPT; lights up completed + dep-signal.
      {
        kind: 'transition_fired',
        ts: '2026-06-02T00:00:00.200Z',
        runId: 'run-test',
        transitionName: 'slice-a:return-done',
        input: { 'slice:slice-a:semantic-satisfied': [{ id: 's1', sliceId: 'slice-a' }] },
        output: {
          'slice:slice-a:completed': [{ id: 'c1', sliceId: 'slice-a' }],
          'slice:slice-a:dep-signal:slice-b': [{ id: 'g1', sliceId: 'slice-a' }],
        },
      },
      { kind: 'net_completed', ts: '2026-06-02T00:00:00.300Z', runId: 'run-test' },
    ];

    return reduceBrunchExecutionExport({ sdcpnFile, events, lanes: 'mechanical' });
  }

  it('definition, initialState, and every firing marking contain no semantic nodes', () => {
    const result = mechanicalExport();

    expect(result.definition.places.some((p) => SEMANTIC.test(p.id))).toBe(false);
    expect(Object.keys(result.initialState).some((k) => SEMANTIC.test(k))).toBe(false);
    for (const firing of result.transitionFirings) {
      expect(SEMANTIC.test(firing.transitionId)).toBe(false);
      expect(Object.keys(firing.input).some((k) => SEMANTIC.test(k))).toBe(false);
      expect(Object.keys(firing.output).some((k) => SEMANTIC.test(k))).toBe(false);
    }
  });

  it('drops the semantic firing but keeps the bridge (completed + dep-signal fan-out)', () => {
    const result = mechanicalExport();
    const ids = result.transitionFirings.map((f) => f.transitionId);

    expect(ids).not.toContain('slice-a:assess-semantic:dispatch');
    expect(ids).toContain('slice-a:return-done');
    const bridge = result.transitionFirings.find((f) => f.transitionId === 'slice-a:return-done')!;
    expect(bridge.output).toHaveProperty('slice:slice-a:completed');
    expect(bridge.output).toHaveProperty('slice:slice-a:dep-signal:slice-b');
  });
});

describe('projectMarking', () => {
  const surviving = new Set(['slice:slice-a:done-spec', 'slice:slice-a:completed', 'pool:test-agent']);

  it('drops marking entries for suppressed places, keeps surviving ones', () => {
    const source = {
      'slice:slice-a:done-spec': 1,
      'slice:slice-a:completed': 1,
      'slice:slice-a:semantic-budget': 1,
      'slice:slice-a:assess-semantic:running': 1,
      'pool:test-agent': 5,
    };

    expect(projectMarking(source, surviving)).toEqual({
      'slice:slice-a:done-spec': 1,
      'slice:slice-a:completed': 1,
      'pool:test-agent': 5,
    });
  });

  it('does not mutate the source marking', () => {
    const source = { 'slice:slice-a:done-spec': 1, 'slice:slice-a:semantic-budget': 1 };
    projectMarking(source, surviving);
    expect(source).toEqual({ 'slice:slice-a:done-spec': 1, 'slice:slice-a:semantic-budget': 1 });
  });
});
