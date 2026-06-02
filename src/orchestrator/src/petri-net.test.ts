import { describe, expect, it } from 'vitest';

import { PetriNet } from './petri-net.js';

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
