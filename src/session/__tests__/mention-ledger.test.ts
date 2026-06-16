import { describe, expect, it } from 'vitest';

import {
  graphHandlesInText,
  mentionEntry,
  mentionFactsFromEntries,
  resolveMentionFacts,
  stalenessEntriesForMentions,
} from '../mention-ledger.js';

describe('mention ledger', () => {
  it('extracts stable graph handles from submitted transcript text only', () => {
    expect(graphHandlesInText('Compare #G1 with #R22, then revisit #G1.')).toEqual(['G1', 'R22']);
  });

  it('resolves #CODE handles to stable entity ids and seen_lsn at submit time', () => {
    const graph = {
      forSpec: () => ({
        resolveNodeCode: (code: string) => (code === 'G1' ? 101 : undefined),
        getNodes: () => [
          {
            status: 'found',
            node: { id: 101, title: 'Goal node', updatedAtLsn: 4 },
            related: [],
            edges: [],
          },
        ],
      }),
    };

    expect(
      resolveMentionFacts({ text: 'Please re-read #G1; ignore #BAD.', specId: 1, graph: graph as never }),
    ).toEqual([{ entityId: '101', handle: 'G1', title: 'Goal node', seenLsn: 4 }]);
    expect(mentionEntry({ entityId: '101', handle: 'G1', seenLsn: 4 })).toEqual({
      type: 'custom',
      customType: 'brunch.mention',
      data: { entityId: '101', handle: 'G1', seenLsn: 4 },
    });
  });

  it('projects mention facts from transcript custom entries', () => {
    expect(
      mentionFactsFromEntries([
        { type: 'custom', customType: 'brunch.mention', data: { entityId: '101', handle: 'G1', seenLsn: 4 } },
        { type: 'custom', customType: 'brunch.mention', data: { entityId: 102, handle: 'G2', seenLsn: 4 } },
      ]),
    ).toEqual([{ entityId: '101', handle: 'G1', seenLsn: 4 }]);
  });

  it('emits staleness only when the entity changed since it was last seen', () => {
    const current = new Map([
      ['101', 7],
      ['102', 5],
    ]);

    expect(
      stalenessEntriesForMentions({
        mentions: [
          { entityId: '101', handle: 'G1', seenLsn: 4 },
          { entityId: '102', handle: 'G2', seenLsn: 5 },
        ],
        currentByEntityId: current,
      }),
    ).toEqual([
      {
        type: 'custom_message',
        customType: 'brunch.mention_staleness_hint',
        content: expect.stringContaining('G1'),
        details: { entityId: '101', handle: 'G1', seenLsn: 4, currentLsn: 7 },
      },
    ]);
  });
});
