import { describe, expect, it } from 'vitest';

import {
  createInitialMarking,
  enabledTransitionIds,
  fireTransition,
  resetMarking,
  type ReferencePetriNet,
} from '../petri-reference.js';

const weightedNet: ReferencePetriNet = {
  places: [
    { id: 'input', initialTokens: 2 },
    { id: 'output', initialTokens: 0 },
  ],
  transitions: [{ id: 'fire' }],
  arcs: [
    { source: 'input', target: 'fire', weight: 2 },
    { source: 'fire', target: 'output', weight: 3 },
  ],
};

describe('execution comparison Petri reference model', () => {
  it('computes weighted enablement and firing with unbounded outputs', () => {
    const initial = createInitialMarking(weightedNet);
    expect(enabledTransitionIds(weightedNet, initial)).toEqual(['fire']);

    const fired = fireTransition(weightedNet, initial, 'fire');
    expect(fired).toEqual({
      fired: true,
      marking: { input: 0, output: 3 },
    });
    expect(enabledTransitionIds(weightedNet, fired.marking)).toEqual([]);

    const disabled = fireTransition(weightedNet, fired.marking, 'fire');
    expect(disabled).toEqual({
      fired: false,
      marking: { input: 0, output: 3 },
    });
  });

  it('resolves conflicts only through the selected transition and resets idempotently', () => {
    const conflict: ReferencePetriNet = {
      places: [
        { id: 'shared', initialTokens: 1 },
        { id: 'left', initialTokens: 0 },
        { id: 'right', initialTokens: 0 },
      ],
      transitions: [{ id: 'take-left' }, { id: 'take-right' }],
      arcs: [
        { source: 'shared', target: 'take-left', weight: 1 },
        { source: 'take-left', target: 'left', weight: 1 },
        { source: 'shared', target: 'take-right', weight: 1 },
        { source: 'take-right', target: 'right', weight: 1 },
      ],
    };

    const initial = createInitialMarking(conflict);
    expect(enabledTransitionIds(conflict, initial)).toEqual(['take-left', 'take-right']);
    const selected = fireTransition(conflict, initial, 'take-right');
    expect(selected.marking).toEqual({ shared: 0, left: 0, right: 1 });
    expect(enabledTransitionIds(conflict, selected.marking)).toEqual([]);
    expect(resetMarking(conflict, resetMarking(conflict, selected.marking))).toEqual(initial);
  });

  it('rejects malformed nets instead of inventing execution meaning', () => {
    expect(() =>
      createInitialMarking({
        places: [{ id: 'p', initialTokens: -1 }],
        transitions: [{ id: 't' }],
        arcs: [],
      }),
    ).toThrow('non-negative integer');
    expect(() =>
      createInitialMarking({
        places: [{ id: 'p', initialTokens: 1 }],
        transitions: [{ id: 't' }],
        arcs: [{ source: 'p', target: 'missing', weight: 1 }],
      }),
    ).toThrow('opposite existing endpoint');
  });
});
