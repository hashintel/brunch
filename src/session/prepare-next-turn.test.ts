import { describe, expect, it } from 'vitest';

import { isContinuityOnlyNonDebtEntry } from '../projections/session/continuity-entry-classifier.js';
import {
  guardBeforeProviderRequest,
  prepareNextTurn,
  stampOwnMutationWatermark,
} from './prepare-next-turn.js';

const specId = 3;

function seed(lsn: number) {
  return { type: 'custom', customType: 'brunch.context_seed', data: { specId, snapshotLsn: lsn } };
}

describe('prepareNextTurn', () => {
  it('emits no worldUpdate when current_lsn equals watermark and emits the strict-greater set otherwise', () => {
    expect(
      prepareNextTurn({ specId, currentLsn: 2, entries: [seed(2)], changes: [{ specId, lsn: 2 }] })
        .entriesToAppend,
    ).toEqual([]);

    const prepared = prepareNextTurn({
      specId,
      currentLsn: 5,
      entries: [seed(2)],
      changes: [
        { specId, lsn: 1, entityId: 'old' },
        { specId, lsn: 3, entityId: 'new-a' },
        { specId: 99, lsn: 4, entityId: 'sibling-spec' },
        { specId, lsn: 5, entityId: 'new-b' },
      ],
    });

    expect(prepared.entriesToAppend).toEqual([
      {
        type: 'custom',
        customType: 'worldUpdate',
        data: {
          specId,
          currentLsn: 5,
          changedSinceLsn: 2,
          items: [
            { specId, lsn: 3, entityId: 'new-a' },
            { specId, lsn: 5, entityId: 'new-b' },
          ],
        },
      },
    ]);
  });

  it('dedupes a seed naming the current snapshot LSN', () => {
    expect(
      prepareNextTurn({
        specId,
        currentLsn: 10,
        entries: [seed(10)],
        changes: [{ specId, lsn: 10, entityId: 'snapshot-node' }],
      }).entriesToAppend,
    ).toEqual([]);
  });

  it('surfaces same-session submit/capture writes that were not assistant-visible yet', () => {
    expect(
      prepareNextTurn({
        specId,
        currentLsn: 8,
        entries: [seed(5)],
        changes: [{ specId, lsn: 8, entityId: 'captured-from-submit', kind: 'goal' }],
      }).entriesToAppend[0]?.data.items,
    ).toEqual([{ specId, lsn: 8, entityId: 'captured-from-submit', kind: 'goal' }]);
  });

  it('stamps own mutations as watermark carriers without treating them as worldUpdate-only runtime state', () => {
    expect(stampOwnMutationWatermark({ specId, lsn: 12, source: 'mutate_graph' })).toEqual({
      type: 'custom',
      customType: 'brunch.own_mutation',
      data: { specId, lsn: 12, source: 'mutate_graph' },
    });
  });

  it('emits mention staleness hints only for changed mentioned entities', () => {
    expect(
      prepareNextTurn({
        specId,
        currentLsn: 9,
        entries: [seed(5)],
        changes: [
          { specId, lsn: 9, entityId: '101' },
          { specId, lsn: 5, entityId: '102' },
        ],
        mentions: [
          { entityId: '101', handle: 'G1', seenLsn: 6 },
          { entityId: '102', handle: 'G2', seenLsn: 5 },
        ],
      }).entriesToAppend,
    ).toEqual(
      expect.arrayContaining([
        {
          type: 'custom',
          customType: 'brunch.mention_staleness_hint',
          data: { entityId: '101', handle: 'G1', seenLsn: 6, currentLsn: 9 },
        },
      ]),
    );
  });

  it('emits side-task and reviewer drains through the reconciler as continuity-only non-debt entries', () => {
    const prepared = prepareNextTurn({
      specId,
      currentLsn: 1,
      entries: [seed(1)],
      changes: [],
      drains: [
        { kind: 'side_task', id: 'side-1', summary: 'Side task done' },
        { kind: 'reviewer', id: 'review-1', summary: 'Reviewer done' },
      ],
    });

    expect(prepared.entriesToAppend.map((entry) => entry.customType)).toEqual([
      'brunch.side_task_result',
      'brunch.reviewer_drain',
    ]);
    expect(prepared.entriesToAppend.every(isContinuityOnlyNonDebtEntry)).toBe(true);
  });

  it('guard re-runs preparation once and never appends continuity directly outside prepare output', async () => {
    const appended: unknown[] = [];
    const results = [
      {
        watermarkLsn: 1,
        currentLsn: 2,
        entriesToAppend: [
          { type: 'custom' as const, customType: 'worldUpdate', data: { specId, currentLsn: 2 } },
        ],
      },
      { watermarkLsn: 2, currentLsn: 2, entriesToAppend: [] },
    ];

    await expect(
      guardBeforeProviderRequest({
        prepare: () => results.shift()!,
        append: (entry) => {
          appended.push(entry);
        },
      }),
    ).resolves.toEqual({ watermarkLsn: 2, currentLsn: 2, entriesToAppend: [] });
    expect(appended).toEqual([
      { type: 'custom', customType: 'worldUpdate', data: { specId, currentLsn: 2 } },
    ]);
  });
});
