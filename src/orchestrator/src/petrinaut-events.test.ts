import { chmodSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { compileTopology } from './net-compiler.js';
import {
  createPetrinautEventStream,
  type PetrinautEvent,
  type PetrinautTransitionFiredEvent,
} from './petrinaut-events.js';
import { createNetFolding } from './petrinaut-fold.js';
import type { Plan } from './types.js';

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

/** Deterministic UUID stub for stable event snapshots. */
function deterministicTokenId(): () => string {
  let n = 0;
  return () => `tok-${++n}`;
}

/** Shared fold of the simplePlan net — folds the synthetic slice-1 firings below. */
const folding = createNetFolding(compileTopology(simplePlan, { maxRetries: 3 }));

// ---------------------------------------------------------------------------
// Unit tests — createPetrinautEventStream as a NetEventSink adapter
// ---------------------------------------------------------------------------

describe('createPetrinautEventStream — initial_marking', () => {
  it('emits one initial_marking event grouping every initial token by place', () => {
    const blueprint = compileTopology(simplePlan, { maxRetries: 3 });
    const events: PetrinautEvent[] = [];
    const stream = createPetrinautEventStream({
      runId: 'run-1',
      folding,
      tokenIdFn: deterministicTokenId(),
      onEvent: (e) => events.push(e),
    });
    stream.emitInitialMarking(blueprint);

    expect(events).toHaveLength(1);
    const ev = events[0]!;
    expect(ev.kind).toBe('initial_marking');
    if (ev.kind !== 'initial_marking') return; // narrow

    expect(ev.runId).toBe('run-1');
    // FE-784: marking keys are folded to slice-independent roles.
    expect(Object.keys(ev.marking).sort()).toEqual(
      ['eligible', 'pool:code-agent', 'pool:test-agent', 'retry-budget', 'semantic-budget'].sort(),
    );

    // Every token carries an id; slice color preserved on the token.
    const retry = ev.marking['retry-budget']!;
    expect(retry).toHaveLength(1);
    expect(retry[0]!.id).toBeDefined();
    expect(retry[0]!.retryCount).toBe(0);
    expect(retry[0]!.sliceId).toBe('slice-1');
  });
});

describe('createPetrinautEventStream — transition_fired adapter', () => {
  it('translates a NetEvent into the cross-team-agreed transition_fired shape', () => {
    const events: PetrinautEvent[] = [];
    const stream = createPetrinautEventStream({
      runId: 'run-1',
      folding,
      tokenIdFn: deterministicTokenId(),
      onEvent: (e) => events.push(e),
    });
    stream.sink.emit({
      kind: 'transition_fired',
      ts: '2026-05-27T00:00:00.000Z',
      transitionId: 'slice-1:evaluate:dispatch',
      consumed: ['slice:slice-1:spec-ready', 'pool:test-agent'],
      consumedTokens: [
        { sliceId: 'slice-1', epicId: 'epic-1' },
        { sliceId: '', epicId: '' },
      ],
      produced: ['slice:slice-1:evaluate:running'],
      producedTokens: [{ sliceId: 'slice-1', epicId: 'epic-1' }],
    });

    expect(events).toHaveLength(1);
    const ev = events[0]! as PetrinautTransitionFiredEvent;
    expect(ev.kind).toBe('transition_fired');
    expect(ev.runId).toBe('run-1');
    // FE-784: transition name and arc place keys fold to slice-independent roles.
    expect(ev.transitionName).toBe('evaluate:dispatch');
    expect(Object.keys(ev.input).sort()).toEqual(['pool:test-agent', 'spec-ready']);
    expect(ev.input['spec-ready']).toHaveLength(1);
    expect(ev.input['spec-ready']![0]!.sliceId).toBe('slice-1');
    expect(Object.keys(ev.output)).toEqual(['evaluate:running']);
    expect(ev.output['evaluate:running']![0]!.id).toBeDefined();
  });

  it('throws when transition_fired is missing transitionId', () => {
    const stream = createPetrinautEventStream({
      runId: 'run-1',
      folding,
      tokenIdFn: deterministicTokenId(),
    });
    expect(() =>
      stream.sink.emit({
        kind: 'transition_fired',
        ts: '2026-05-27T00:00:00.000Z',
        consumed: ['slice:slice-1:spec-ready'],
        consumedTokens: [{ sliceId: 'slice-1', epicId: 'epic-1' }],
        produced: [],
        producedTokens: [],
      }),
    ).toThrow(/missing transitionId/);
  });

  it('emits empty token arrays per place when places are present without tokens', () => {
    const events: PetrinautEvent[] = [];
    const stream = createPetrinautEventStream({
      runId: 'run-1',
      folding,
      tokenIdFn: deterministicTokenId(),
      onEvent: (e) => events.push(e),
    });
    stream.sink.emit({
      kind: 'transition_fired',
      ts: '2026-05-27T00:00:00.000Z',
      transitionId: 'slice-1:evaluate:dispatch',
      consumed: ['slice:slice-1:spec-ready', 'pool:test-agent'],
      produced: ['slice:slice-1:evaluate:running'],
    });

    const ev = events[0]! as PetrinautTransitionFiredEvent;
    expect(Object.keys(ev.input).sort()).toEqual(['pool:test-agent', 'spec-ready']);
    expect(ev.input['spec-ready']).toEqual([]);
    expect(ev.input['pool:test-agent']).toEqual([]);
    expect(ev.output['evaluate:running']).toEqual([]);
  });

  it('forwards net_halted and net_deadlocked as terminal events', () => {
    const events: PetrinautEvent[] = [];
    const stream = createPetrinautEventStream({
      runId: 'run-1',
      folding,
      tokenIdFn: deterministicTokenId(),
      onEvent: (e) => events.push(e),
    });
    stream.sink.emit({ kind: 'net_halted', ts: '2026-05-27T00:00:00.000Z' });
    stream.sink.emit({ kind: 'net_deadlocked', ts: '2026-05-27T00:00:01.000Z' });

    expect(events.map((e) => e.kind)).toEqual(['net_halted', 'net_deadlocked']);
    expect(events.every((e) => 'runId' in e && e.runId === 'run-1')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// File output — JSONL roundtrip
// ---------------------------------------------------------------------------

describe('createPetrinautEventStream — JSONL file output', () => {
  it('appends one event per line and reloads as parsed events', () => {
    const dir = mkdtempSync(join(tmpdir(), 'brunch-petrinaut-events-'));
    const filePath = join(dir, 'petrinaut-events.jsonl');
    const blueprint = compileTopology(simplePlan, { maxRetries: 3 });

    const stream = createPetrinautEventStream({
      runId: 'run-jsonl',
      folding,
      filePath,
      tokenIdFn: deterministicTokenId(),
    });

    // Up-front initial marking.
    stream.emitInitialMarking(blueprint);

    // A synthetic transition_fired (the production path goes through the
    // NetEventSink during PetriNet.run; here we exercise the same adapter
    // directly to avoid coupling this test to the heavy orchestrator path).
    stream.sink.emit({
      kind: 'transition_fired',
      ts: '2026-05-27T00:00:00.000Z',
      transitionId: 'slice-1:evaluate:dispatch',
      consumed: ['slice:slice-1:spec-ready', 'pool:test-agent'],
      consumedTokens: [
        { sliceId: 'slice-1', epicId: 'epic-1' },
        { sliceId: '', epicId: '' },
      ],
      produced: ['slice:slice-1:evaluate:running'],
      producedTokens: [{ sliceId: 'slice-1', epicId: 'epic-1' }],
    });

    // Terminal halt.
    stream.sink.emit({ kind: 'net_halted', ts: '2026-05-27T00:00:01.000Z' });

    const raw = readFileSync(filePath, 'utf8');
    const lines = raw
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l) as PetrinautEvent);

    expect(lines).toHaveLength(3);
    expect(lines[0]!.kind).toBe('initial_marking');
    expect(lines[1]!.kind).toBe('transition_fired');
    expect(lines[2]!.kind).toBe('net_halted');

    // Every event carries runId for cross-run isolation.
    expect(lines.every((e) => 'runId' in e && e.runId === 'run-jsonl')).toBe(true);

    // Transition_fired arcs carry tokens with payload.
    const fired = lines[1] as PetrinautTransitionFiredEvent;
    expect(fired.transitionName).toBe('evaluate:dispatch');
    expect(fired.input['spec-ready']![0]!.sliceId).toBe('slice-1');
    expect(fired.output['evaluate:running']![0]!.id).toBeDefined();
  });

  it('disables file output after an append failure without throwing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'brunch-petrinaut-events-'));
    const filePath = join(dir, 'petrinaut-events.jsonl');
    const events: PetrinautEvent[] = [];
    const warnings: string[] = [];

    const stream = createPetrinautEventStream({
      runId: 'run-jsonl',
      filePath,
      tokenIdFn: deterministicTokenId(),
      onEvent: (e) => events.push(e),
      onError: (message) => warnings.push(message),
    });
    chmodSync(filePath, 0o444);

    expect(() => stream.sink.emit({ kind: 'net_halted', ts: '2026-05-27T00:00:01.000Z' })).not.toThrow();
    expect(events.map((e) => e.kind)).toEqual(['net_halted']);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('Petrinaut event stream disabled:');
  });
});
