import { describe, expect, it } from 'vitest';

import { PetriNet } from './petri-net.js';

describe('PetriNet marking snapshot/restore (durable-resume)', () => {
  it('snapshots the current marking as plain serializable data, isolated from later mutation', () => {
    const net = new PetriNet();
    net.addPlace('p1');
    net.addPlace('p2');
    net.addToken('p1', { sliceId: 's', epicId: 'e', retryCount: 2 });

    const snap = net.snapshotMarking();

    // Plain, JSON-serializable data: round-trips with no loss.
    expect(JSON.parse(JSON.stringify(snap))).toEqual(snap);
    expect(snap.places.p1).toEqual([{ sliceId: 's', epicId: 'e', retryCount: 2 }]);
    expect(snap.places.p2).toEqual([]);

    // Deep copy: mutating the net after snapshotting does not bleed in.
    net.addToken('p2', { sliceId: 's2', epicId: 'e' });
    expect(snap.places.p2).toEqual([]);
  });

  it('restores a marking onto a net with matching topology, clearing unmentioned places', () => {
    const net = new PetriNet();
    net.addPlace('p1');
    net.addPlace('p2');
    net.addToken('p1', { sliceId: 'stale', epicId: 'e' }); // pre-existing token must be cleared

    net.restoreMarking({ places: { p1: [], p2: [{ sliceId: 's', epicId: 'e' }] } });

    const after = net.snapshotMarking();
    expect(after.places.p1).toEqual([]);
    expect(after.places.p2).toEqual([{ sliceId: 's', epicId: 'e' }]);
  });

  it('rejects a snapshot that references a place absent from the net (topology mismatch)', () => {
    const net = new PetriNet();
    net.addPlace('p1');
    expect(() => net.restoreMarking({ places: { p1: [], ghost: [{ sliceId: 's', epicId: 'e' }] } })).toThrow(
      /ghost/,
    );
  });

  it('resumes execution from a restored mid-run marking to the same terminal state', async () => {
    // Linear net: p1 --t1--> p2 --t2--> p3
    const build = (): PetriNet => {
      const n = new PetriNet();
      n.addPlace('p1');
      n.addPlace('p2');
      n.addPlace('p3');
      n.addTransition({ id: 't1', inputs: ['p1'], fire: async ([t]) => [{ place: 'p2', token: t! }] });
      n.addTransition({ id: 't2', inputs: ['p2'], fire: async ([t]) => [{ place: 'p3', token: t! }] });
      return n;
    };

    // A run that halted after t1: the token sits in p2. A fresh net restores
    // that marking and continues.
    const resumed = build();
    resumed.restoreMarking({ places: { p1: [], p2: [{ sliceId: 's', epicId: 'e' }], p3: [] } });
    await resumed.run('serial');

    // The reference: the same net run start-to-finish, uninterrupted.
    const full = build();
    full.addToken('p1', { sliceId: 's', epicId: 'e' });
    await full.run('serial');

    expect(resumed.snapshotMarking()).toEqual(full.snapshotMarking());
    expect(resumed.snapshotMarking().places.p3).toEqual([{ sliceId: 's', epicId: 'e' }]);
  });
});

describe('PetriNet parallel firing', () => {
  it('treats falsy rejection reasons as batch failures', async () => {
    const net = new PetriNet();
    net.addPlace('failing-input');
    net.addPlace('sibling-input');
    net.addPlace('sibling-output');
    net.addToken('failing-input', { sliceId: 'slice-a', epicId: 'epic-1' });
    net.addToken('sibling-input', { sliceId: 'slice-b', epicId: 'epic-1' });

    net.addTransition({
      id: 'rejects-undefined',
      inputs: ['failing-input'],
      fire: async () => Promise.reject(undefined),
    });
    net.addTransition({
      id: 'sibling-success',
      inputs: ['sibling-input'],
      fire: async ([token]) => [{ place: 'sibling-output', token: token! }],
    });

    const events: string[] = [];
    await expect(
      net.run('parallel', undefined, { emit: (event) => events.push(event.kind) }),
    ).rejects.toBeUndefined();
    expect(events).toEqual([]);
  });
});
