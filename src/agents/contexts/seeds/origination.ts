/**
 * Context-seed payload composition (FE-857 card 2, D78-L content half).
 *
 * Owns the provider-visible text of the `brunch.context_seed` continuity
 * entry (D78-L revised 2026-06-12): the pre-rendered workspace overview,
 * the **full graph overview** (canonical renderer shared with `read_graph` —
 * codes, titles, edges; never truncated), and the elicitation grounding-floor
 * framing (top-ranked open gaps via the canonical driver ranking) — enough
 * context that the kicked opening turn needs no read tool call. Pure over
 * already-read data — callers fetch the slice/gaps through existing
 * spec-scoped reads (D20-L/D52-L) and pre-render the workspace section; this
 * module never opens the database or filesystem.
 *
 * Input:  spec identity + GraphSlice + ElicitationGap[] + workspace text
 * Output: seed content string carried by the custom message entry
 * Used by: brunch-tui boot seeding, session.triggerExchange RPC origination
 */

import { sortElicitationGapsForAsking } from '../../../graph/elicitation-driver.js';
import type { GraphSlice } from '../../../graph/index.js';
import type { ElicitationGap } from '../../../graph/schema/elicitation-gaps.js';
import { formatGraphOverview } from '../../../renderers/graph/graph-slice.js';

const TOP_GAP_COUNT = 5;

export interface ComposeContextSeedInput {
  readonly specId: number;
  readonly specName?: string;
  readonly slice: Pick<GraphSlice, 'nodes' | 'edges' | 'lsn'>;
  readonly gaps: readonly ElicitationGap[];
  /**
   * Pre-rendered workspace overview section (`renderWorkspaceOverviewContext`
   * output). Required so no caller drifts to a seed without it; a blank
   * render degrades to omitting the section.
   */
  readonly workspaceContext: string;
}

export function composeContextSeedContent(input: ComposeContextSeedInput): string {
  const specLabel = input.specName ? `spec ${input.specId} “${input.specName}”` : `spec ${input.specId}`;
  const lines: string[] = [`[Brunch] Context seeded for ${specLabel} at graph LSN ${input.slice.lsn}.`];

  if (input.workspaceContext.trim().length > 0) {
    lines.push('', input.workspaceContext.trim());
  }

  // Full overview — the same render read_graph emits — so the opening turn
  // can reason about actual nodes/edges without a tool call.
  lines.push('', formatGraphOverview(input.slice, 'Graph'));

  const ranked = sortElicitationGapsForAsking(input.gaps).slice(0, TOP_GAP_COUNT);
  if (ranked.length === 0) {
    lines.push('Elicitation: no open gaps.');
  } else {
    lines.push(`Open elicitation gaps (top ${ranked.length} by ranking):`);
    for (const [index, gap] of ranked.entries()) {
      lines.push(`${index + 1}. ${gap.question} (${gap.refersTo}, ${gap.band})`);
    }
  }

  return lines.join('\n');
}
