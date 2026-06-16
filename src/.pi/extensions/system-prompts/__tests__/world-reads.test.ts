import { describe, expect, it } from 'vitest';

import type { GraphSlice } from '../../../../graph/queries.js';
import type { GraphReaders } from '../../graph/index.js';
import { createWorldReadCache } from '../world-reads.js';

interface ReadCounts {
  queryGraph: number;
  getElicitationGaps: number;
  latestLsn: number;
}

function trackingReaders(
  lsnSequence: readonly number[],
  counts: ReadCounts,
  sliceLsnSequence: readonly number[] = lsnSequence,
): GraphReaders {
  let call = 0;
  let queryCall = 0;
  let currentLsn = lsnSequence[0] ?? 0;
  const slice = (lsn: number): GraphSlice => ({ lsn, nodes: [], edges: [] });
  return {
    queryGraph: () => {
      counts.queryGraph += 1;
      const sliceLsn = sliceLsnSequence[Math.min(queryCall, sliceLsnSequence.length - 1)] ?? currentLsn;
      queryCall += 1;
      return slice(sliceLsn);
    },
    getNodes: () => [],
    resolveNodeCode: () => undefined,
    getElicitationGaps: () => {
      counts.getElicitationGaps += 1;
      return [];
    },
    latestLsn: () => {
      currentLsn = lsnSequence[Math.min(call, lsnSequence.length - 1)] ?? 0;
      counts.latestLsn += 1;
      call += 1;
      return currentLsn;
    },
  };
}

describe('createWorldReadCache', () => {
  it('reuses reads while the graph LSN is unchanged', () => {
    const counts: ReadCounts = { queryGraph: 0, getElicitationGaps: 0, latestLsn: 0 };
    const readers = trackingReaders([7, 7, 7], counts);
    const cache = createWorldReadCache();

    const first = cache.read(readers, 1);
    const second = cache.read(readers, 1);
    const third = cache.read(readers, 1);

    expect(second).toBe(first);
    expect(third).toBe(first);
    expect(counts.queryGraph).toBe(1);
    expect(counts.getElicitationGaps).toBe(1);
    expect(counts.latestLsn).toBe(3);
  });

  it('refreshes reads when the graph LSN advances', () => {
    const counts: ReadCounts = { queryGraph: 0, getElicitationGaps: 0, latestLsn: 0 };
    const readers = trackingReaders([7, 8], counts);
    const cache = createWorldReadCache();

    const first = cache.read(readers, 1);
    const second = cache.read(readers, 1);

    expect(second).not.toBe(first);
    expect(first.graph.lsn).toBe(7);
    expect(second.graph.lsn).toBe(8);
    expect(counts.queryGraph).toBe(2);
    expect(counts.getElicitationGaps).toBe(2);
  });

  it('keys the cache by the materialized slice LSN, not an older pre-read clock', () => {
    const counts: ReadCounts = { queryGraph: 0, getElicitationGaps: 0, latestLsn: 0 };
    const readers = trackingReaders([7, 7, 8], counts, [8, 8]);
    const cache = createWorldReadCache();

    const first = cache.read(readers, 1);
    const second = cache.read(readers, 1);
    const third = cache.read(readers, 1);

    expect(first.graph.lsn).toBe(8);
    expect(second).not.toBe(first);
    expect(third).toBe(second);
    expect(counts.queryGraph).toBe(2);
  });

  it('refreshes reads when the selected spec changes', () => {
    const counts: ReadCounts = { queryGraph: 0, getElicitationGaps: 0, latestLsn: 0 };
    const readers = trackingReaders([7, 7], counts);
    const cache = createWorldReadCache();

    const first = cache.read(readers, 1);
    const second = cache.read(readers, 2);

    expect(second).not.toBe(first);
    expect(counts.queryGraph).toBe(2);
    expect(counts.getElicitationGaps).toBe(2);
  });
});
