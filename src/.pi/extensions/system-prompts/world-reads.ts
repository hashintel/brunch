/**
 * World-read memo for prompt composition.
 *
 * The expensive PULL each turn is the SQL pair `queryGraph` + `getElicitationGaps`.
 * Both are functions of graph state alone, which the per-spec graph clock (LSN)
 * fully identifies. Cycling operational modes — or any turn that does not mutate
 * the graph — recomposes the prompt without changing world state, so re-running
 * those reads is wasted work. This memo gates them behind the cheap `latestLsn`
 * clock read: on an unchanged (spec, lsn) it returns the prior reads; otherwise
 * it refreshes. Lens-dependent rendering still happens fresh per prompt — only
 * the reads are cached, never the rendered blocks.
 */

import type { GraphSlice } from '../../../graph/queries.js';
import type { ElicitationGap } from '../../../graph/schema/elicitation-gaps.js';
import type { GraphReaders } from '../graph/index.js';

export interface WorldReads {
  readonly graph: GraphSlice;
  readonly gaps: readonly ElicitationGap[];
}

export interface WorldReadCache {
  read(graphReads: GraphReaders, specId: number): WorldReads;
}

export function createWorldReadCache(): WorldReadCache {
  let cached: { specId: number; lsn: number; reads: WorldReads } | null = null;
  return {
    read(graphReads, specId) {
      const lsn = graphReads.latestLsn(specId);
      if (cached && cached.specId === specId && cached.lsn === lsn) {
        return cached.reads;
      }
      const reads: WorldReads = {
        graph: graphReads.queryGraph(),
        gaps: graphReads.getElicitationGaps(specId),
      };
      cached = { specId, lsn: reads.graph.lsn, reads };
      return reads;
    },
  };
}
