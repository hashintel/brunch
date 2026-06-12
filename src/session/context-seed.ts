/**
 * Context-seed payload composition (FE-857 card 2, D78-L content half).
 *
 * Owns the provider-visible text of the `brunch.context_seed` continuity
 * entry: a spec graph overview (composition by kind) plus the elicitation
 * grounding-floor framing (top-ranked open gaps via the canonical driver
 * ranking). Pure over already-read data — callers fetch the slice and gaps
 * through existing spec-scoped reads (D20-L/D52-L); this module never opens
 * the database.
 *
 * Input:  spec identity + GraphSlice + ElicitationGap[]
 * Output: seed content string carried by the custom message entry
 * Used by: brunch-tui boot seeding, session.triggerExchange RPC origination
 */

import { sortElicitationGapsForAsking } from '../graph/elicitation-driver.js';
import type { GraphSlice } from '../graph/index.js';
import type { ElicitationGap } from '../graph/schema/elicitation-gaps.js';

const TOP_GAP_COUNT = 5;

export interface ComposeContextSeedInput {
  readonly specId: number;
  readonly specName?: string;
  readonly slice: Pick<GraphSlice, 'nodes' | 'edges' | 'lsn'>;
  readonly gaps: readonly ElicitationGap[];
}

export function composeContextSeedContent(input: ComposeContextSeedInput): string {
  const specLabel = input.specName ? `spec ${input.specId} “${input.specName}”` : `spec ${input.specId}`;
  const lines: string[] = [`[Brunch] Context seeded for ${specLabel} at graph LSN ${input.slice.lsn}.`];

  if (input.slice.nodes.length === 0) {
    lines.push('Graph: empty — no nodes captured yet.');
  } else {
    const byKind = new Map<string, number>();
    for (const node of input.slice.nodes) {
      byKind.set(node.kind, (byKind.get(node.kind) ?? 0) + 1);
    }
    const kindSummary = [...byKind.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([kind, count]) => `${kind}: ${count}`)
      .join(', ');
    const edgeCount = input.slice.edges.length;
    lines.push(`Graph: ${input.slice.nodes.length} node(s) (${kindSummary}), ${edgeCount} edge(s).`);
  }

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
