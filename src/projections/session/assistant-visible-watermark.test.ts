import { describe, expect, it } from 'vitest';

import { compareWatermarks, projectAssistantVisibleWatermark } from './assistant-visible-watermark.js';
import {
  CONTINUITY_ONLY_NON_DEBT_CUSTOM_TYPES,
  WATERMARK_CARRIER_CUSTOM_TYPES,
  classifyContinuityEntry,
  isContinuityOnlyNonDebtEntry,
} from './continuity-entry-classifier.js';
import { projectSessionRuntimeState } from './runtime-state.js';

const specId = 7;

function custom(customType: string, data: Record<string, unknown>) {
  return { type: 'custom', customType, data };
}

function message(role: 'user' | 'assistant', content: string) {
  return { type: 'message', message: { role, content, timestamp: 0 } };
}

describe('assistant-visible watermark projection', () => {
  it('advances from seed, full-overview snapshots, worldUpdate, and own mutations but not narrow reads', () => {
    const entries = [
      custom('brunch.context_seed', { specId, snapshotLsn: 2 }),
      custom('brunch.narrow_graph_read', { specId, lsn: 9 }),
      custom('brunch.graph_overview_snapshot', { watermark: { specId, lsn: 4 } }),
      custom('worldUpdate', { specId, currentLsn: 6, items: [{ id: 1 }] }),
      custom('brunch.own_mutation', { specId, lsn: 8 }),
    ];

    expect(projectAssistantVisibleWatermark(entries, { specId })).toEqual({ specId, lsn: 8 });
  });

  it('never compares bare LSNs across specs and fails loud on cross-spec misuse', () => {
    expect(() => projectAssistantVisibleWatermark([custom('worldUpdate', { currentLsn: 2 })])).toThrow(
      /bare LSN/,
    );
    expect(() =>
      projectAssistantVisibleWatermark([
        custom('worldUpdate', { specId: 1, currentLsn: 2 }),
        custom('worldUpdate', { specId: 2, currentLsn: 3 }),
      ]),
    ).toThrow(/multiple specs/);
    expect(() => compareWatermarks({ specId: 1, lsn: 10 }, { specId: 2, lsn: 11 })).toThrow(
      /different specs/,
    );
  });

  it('classifies shared carrier, continuity-only, and debt-bearing entries for FE-847 consumers', () => {
    expect(WATERMARK_CARRIER_CUSTOM_TYPES).toEqual([
      'brunch.context_seed',
      'brunch.graph_overview_snapshot',
      'brunch.own_mutation',
      'worldUpdate',
    ]);
    expect(CONTINUITY_ONLY_NON_DEBT_CUSTOM_TYPES).toContain('brunch.mention_staleness_hint');
    expect(classifyContinuityEntry(custom('worldUpdate', { specId, currentLsn: 3 }))).toBe(
      'watermark_carrier',
    );
    expect(isContinuityOnlyNonDebtEntry(custom('brunch.side_task_result', { delivered: true }))).toBe(true);
    expect(isContinuityOnlyNonDebtEntry(custom('brunch.mention_staleness_hint', { entityId: 'n1' }))).toBe(
      true,
    );
    expect(classifyContinuityEntry(message('user', 'Please continue'))).toBe('debt_bearing');
  });

  it('keeps runtimeState.world.latestLsn as worldUpdate-only, not the broader watermark', () => {
    const projection = projectSessionRuntimeState({
      header: { type: 'session', version: 3, id: 's1', cwd: '/tmp/workspace', timestamp: 'now' },
      binding: { schemaVersion: 1, specId },
      entries: [
        custom('brunch.context_seed', { specId, snapshotLsn: 10 }),
        custom('brunch.own_mutation', { specId, lsn: 11 }),
      ],
    } as never);

    expect(projection.world.graph.latestLsn).toBeNull();
    expect(
      projectAssistantVisibleWatermark(
        [
          custom('brunch.context_seed', { specId, snapshotLsn: 10 }),
          custom('brunch.own_mutation', { specId, lsn: 11 }),
        ],
        { specId },
      ),
    ).toEqual({ specId, lsn: 11 });
  });
});
