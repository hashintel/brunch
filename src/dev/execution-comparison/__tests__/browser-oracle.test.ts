import { describe, expect, it } from 'vitest';

import { runIndependentJourneys, type IndependentJourney } from '../browser-oracle/journey-runner.js';

interface FakeContext {
  readonly id: string;
}

function journey(input: {
  readonly id: string;
  readonly claims: readonly string[];
  readonly setup?: (context: FakeContext) => Promise<void>;
  readonly assert?: (context: FakeContext) => Promise<void>;
}): IndependentJourney<FakeContext> {
  return {
    id: input.id,
    claims: input.claims,
    setup: input.setup ?? (async () => {}),
    assert: input.assert ?? (async () => {}),
  };
}

describe('independent browser-oracle journey runner', () => {
  it('runs later claim-linked journeys after an earlier assertion failure', async () => {
    const opened: string[] = [];
    const closed: string[] = [];
    const asserted: string[] = [];

    const results = await runIndependentJourneys({
      journeys: [
        journey({
          id: 'mount',
          claims: ['AC14'],
          assert: async (context) => {
            asserted.push(context.id);
            throw new Error('mount assertion failed');
          },
        }),
        journey({
          id: 'node-lifecycle',
          claims: ['AC15'],
          assert: async (context) => {
            asserted.push(context.id);
          },
        }),
      ],
      open: async (selected) => {
        opened.push(selected.id);
        return { id: `${selected.id}-context` };
      },
      close: async (context) => {
        closed.push(context.id);
      },
    });

    expect(asserted).toEqual(['mount-context', 'node-lifecycle-context']);
    expect(opened).toEqual(['mount', 'node-lifecycle']);
    expect(closed).toEqual(['mount-context', 'node-lifecycle-context']);
    expect(results).toEqual([
      {
        id: 'mount',
        claims: ['AC14'],
        status: 'assertion_failed',
        message: 'mount assertion failed',
      },
      {
        id: 'node-lifecycle',
        claims: ['AC15'],
        status: 'passed',
        message: 'all assertions passed',
      },
    ]);
  });

  it('distinguishes setup failures and closes every acquired context', async () => {
    const closed: string[] = [];
    const asserted: string[] = [];

    const results = await runIndependentJourneys({
      journeys: [
        journey({
          id: 'mount',
          claims: ['AC14'],
          setup: async () => {
            throw new Error('navigation failed');
          },
          assert: async () => {
            asserted.push('mount');
          },
        }),
        journey({
          id: 'node-lifecycle',
          claims: ['AC15'],
          assert: async () => {
            asserted.push('node-lifecycle');
          },
        }),
        journey({
          id: 'weighted-fire-reset-reload',
          claims: ['AC17'],
          assert: async () => {
            asserted.push('weighted-fire-reset-reload');
          },
        }),
      ],
      open: async (selected) => {
        if (selected.id === 'node-lifecycle') throw new Error('context creation failed');
        return { id: `${selected.id}-context` };
      },
      close: async (context) => {
        closed.push(context.id);
      },
    });

    expect(asserted).toEqual(['weighted-fire-reset-reload']);
    expect(closed).toEqual(['mount-context', 'weighted-fire-reset-reload-context']);
    expect(results).toEqual([
      {
        id: 'mount',
        claims: ['AC14'],
        status: 'setup_failed',
        message: 'navigation failed',
      },
      {
        id: 'node-lifecycle',
        claims: ['AC15'],
        status: 'setup_failed',
        message: 'context creation failed',
      },
      {
        id: 'weighted-fire-reset-reload',
        claims: ['AC17'],
        status: 'passed',
        message: 'all assertions passed',
      },
    ]);
  });

  it('records teardown failures without blocking a later journey', async () => {
    const asserted: string[] = [];

    const results = await runIndependentJourneys({
      journeys: [
        journey({ id: 'mount', claims: ['AC14'] }),
        journey({
          id: 'node-lifecycle',
          claims: ['AC15'],
          assert: async () => {
            asserted.push('node-lifecycle');
          },
        }),
      ],
      open: async (selected) => ({ id: selected.id }),
      close: async (context) => {
        if (context.id === 'mount') throw new Error('context close failed');
      },
    });

    expect(asserted).toEqual(['node-lifecycle']);
    expect(results).toEqual([
      {
        id: 'mount',
        claims: ['AC14'],
        status: 'setup_failed',
        message: 'context close failed',
      },
      {
        id: 'node-lifecycle',
        claims: ['AC15'],
        status: 'passed',
        message: 'all assertions passed',
      },
    ]);
  });
});
