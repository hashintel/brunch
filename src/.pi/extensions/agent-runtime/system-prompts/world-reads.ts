/**
 * World-read memo for prompt composition.
 *
 * The expensive PULL each turn is the SQL read `queryGraph`, a function of
 * graph state alone, which the per-spec graph clock (LSN) fully identifies.
 * Cycling operational modes — or any turn that does not mutate the graph —
 * recomposes the prompt without changing world state, so re-running that read
 * is wasted work. This memo gates it behind the cheap `latestLsn` clock read:
 * on an unchanged (spec, lsn) it returns the prior read; otherwise it
 * refreshes. Lens-dependent rendering still happens fresh per prompt — only
 * the read is cached, never the rendered blocks.
 *
 * The session-local elicitation scratchpad (D101-L) is deliberately outside
 * this cache: it can change on a turn that does not mutate the graph, so
 * foreground prompts must see scratchpad-only updates without waiting for a
 * graph LSN advance.
 */

import type { GraphSlice } from '../../../../graph/queries.js';
import type { GraphReaders } from '../../brunch-data/graph/index.js';

export interface WorldReads {
  readonly graph: GraphSlice;
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
      };
      cached = { specId, lsn: reads.graph.lsn, reads };
      return reads;
    },
  };
}
