import type { SessionEntry } from '@earendil-works/pi-coding-agent';
import { describe, expect, it } from 'vitest';

import { compactionAnchorContract, selectCompactionAnchors } from '../compaction/index.js';

let nextId = 0;

function ledger(customType: string, data?: unknown): SessionEntry {
  return { id: `e${nextId++}`, type: 'custom', customType, data } as SessionEntry;
}

function nudge(customType: string, content: string, details?: unknown): SessionEntry {
  return {
    id: `e${nextId++}`,
    type: 'custom_message',
    customType,
    content,
    display: false,
    ...(details !== undefined ? { details } : {}),
  } as SessionEntry;
}

function message(role: 'user' | 'assistant', content: string): SessionEntry {
  return { id: `e${nextId++}`, type: 'message', message: { role, content, timestamp: 0 } } as SessionEntry;
}

describe('selectCompactionAnchors', () => {
  it('designates the latest dropped carrier when the kept region has no newer match', () => {
    const oldSeed = nudge('brunch.context_seed', 'seed lsn 3');
    const newerSeed = nudge('brunch.context_seed', 'seed lsn 5');
    const kept = message('user', 'recent');
    const entries = [oldSeed, newerSeed, kept];

    const selected = selectCompactionAnchors(entries, kept.id, compactionAnchorContract);

    expect(selected.map((anchor) => anchor.entry.id)).toEqual([newerSeed.id]);
    expect(selected[0]).toMatchObject({ kind: 'brunch.context_seed', select: 'latest' });
  });

  it('designates nothing for a kind whose latest match survives the cut', () => {
    const oldWorld = nudge('worldUpdate', 'lsn 4');
    const kept = nudge('worldUpdate', 'lsn 9');
    const entries = [oldWorld, message('user', 'x'), kept];

    const selected = selectCompactionAnchors(entries, kept.id, compactionAnchorContract);

    expect(selected).toEqual([]);
  });

  it('designates every dropped all-unresolved match (conservative over-preservation)', () => {
    const hintA = nudge('brunch.mention_staleness_hint', 'node 12 changed');
    const hintB = nudge('brunch.mention_staleness_hint', 'node 40 changed');
    const kept = message('user', 'recent');

    const selected = selectCompactionAnchors([hintA, hintB, kept], kept.id, compactionAnchorContract);

    expect(selected.map((anchor) => anchor.entry.id)).toEqual([hintA.id, hintB.id]);
  });

  it('designates the first binding when the cut would drop it, in original order among anchors', () => {
    const binding = ledger('brunch.session_binding', { specId: 1 });
    const world = nudge('worldUpdate', 'lsn 2');
    const kept = message('user', 'recent');

    const selected = selectCompactionAnchors([binding, world, kept], kept.id, compactionAnchorContract);

    expect(selected.map((anchor) => anchor.entry.id)).toEqual([binding.id, world.id]);
  });

  it('ignores non-anchor kinds and selects nothing on an unknown cut id', () => {
    const stray = nudge('brunch.kick', 'kick');
    const kept = message('user', 'recent');
    const entries = [stray, kept];

    expect(selectCompactionAnchors(entries, kept.id, compactionAnchorContract)).toEqual([]);
    expect(selectCompactionAnchors(entries, 'no-such-id', compactionAnchorContract)).toEqual([]);
  });
});
