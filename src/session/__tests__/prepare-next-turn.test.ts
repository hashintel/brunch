import { describe, expect, it } from 'vitest';

import { isContinuityOnlyNonDebtEntry } from '../../projections/session/continuity-entry-classifier.js';
import {
  appendPreparedContinuityEntry,
  guardBeforeProviderRequest,
  prepareNextTurn,
  stampOwnMutationWatermark,
  type PreparedContinuityEntry,
} from '../prepare-next-turn.js';

const specId = 3;

function seed(lsn: number) {
  return { type: 'custom', customType: 'brunch.context_seed', data: { specId, snapshotLsn: lsn } };
}

function detailsOf(entry: PreparedContinuityEntry | undefined): Record<string, unknown> | undefined {
  return entry?.type === 'custom_message' ? entry.details : entry?.data;
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
        type: 'custom_message',
        customType: 'worldUpdate',
        content: expect.any(String),
        details: {
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
    const content =
      prepared.entriesToAppend[0]?.type === 'custom_message' ? prepared.entriesToAppend[0].content : '';
    expect(content).toContain('new-a');
    expect(content).toContain('new-b');
    expect(content).toContain('5');
  });

  it('dedupes against a message-carrier seed exactly as against a ledger seed', () => {
    const messageSeed = {
      type: 'custom_message',
      customType: 'brunch.context_seed',
      content: 'Context seed',
      details: { specId, snapshotLsn: 10 },
      display: false,
    };
    expect(
      prepareNextTurn({
        specId,
        currentLsn: 10,
        entries: [messageSeed],
        changes: [{ specId, lsn: 10, entityId: 'snapshot-node' }],
      }).entriesToAppend,
    ).toEqual([]);
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
      }).entriesToAppend.map(detailsOf)[0]?.items,
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
          type: 'custom_message',
          customType: 'brunch.mention_staleness_hint',
          content: expect.stringContaining('G1'),
          details: { entityId: '101', handle: 'G1', seenLsn: 6, currentLsn: 9 },
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
    expect(prepared.entriesToAppend.every((entry) => entry.type === 'custom_message')).toBe(true);
    const contents = prepared.entriesToAppend.map((entry) =>
      entry.type === 'custom_message' ? entry.content : '',
    );
    expect(contents[0]).toContain('Side task done');
    expect(contents[1]).toContain('Reviewer done');
    expect(prepared.entriesToAppend.every(isContinuityOnlyNonDebtEntry)).toBe(true);
  });

  it('appendPreparedContinuityEntry routes ledger entries and message entries to the matching SessionManager API', () => {
    const calls: unknown[] = [];
    const manager = {
      appendCustomEntry: (customType: string, data?: unknown) => {
        calls.push({ api: 'appendCustomEntry', customType, data });
        return 'id';
      },
      appendCustomMessageEntry: (
        customType: string,
        content: string,
        display: boolean,
        details?: unknown,
      ) => {
        calls.push({ api: 'appendCustomMessageEntry', customType, content, display, details });
        return 'id';
      },
    };

    appendPreparedContinuityEntry(
      manager,
      stampOwnMutationWatermark({ specId, lsn: 2, source: 'mutate_graph' }),
    );
    appendPreparedContinuityEntry(manager, {
      type: 'custom_message',
      customType: 'worldUpdate',
      content: 'Graph updated',
      details: { specId, currentLsn: 2 },
    });

    expect(calls).toEqual([
      {
        api: 'appendCustomEntry',
        customType: 'brunch.own_mutation',
        data: { specId, lsn: 2, source: 'mutate_graph' },
      },
      {
        api: 'appendCustomMessageEntry',
        customType: 'worldUpdate',
        content: 'Graph updated',
        display: false,
        details: { specId, currentLsn: 2 },
      },
    ]);
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
