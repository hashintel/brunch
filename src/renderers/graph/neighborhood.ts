/**
 * Formats projected node neighborhood snapshots into model-facing text.
 *
 * Input:
 * - projected output from projections/graph/neighborhood.ts
 *
 * Output:
 * - markdown-framed TOON or equivalent compact text for LLM consumption
 *
 * Replaces/adapts:
 * - .pi/agents/contexts/node.ts
 * - .pi/extensions/graph/index.ts neighborhood result formatting
 */

import type { ProjectedNeighborhood } from '../../projections/graph/neighborhood.js';
import { markdownBullet } from '../markdown.js';

export function formatNeighborhood(projection: ProjectedNeighborhood): string {
  if (projection.status === 'not_found') {
    return '[Selected-spec node context]\n- node: not found in selected spec';
  }

  const lines = [
    '[Selected-spec node context]',
    markdownBullet(`anchor: [${projection.anchor.code}] ${projection.anchor.label}`),
  ];

  if (projection.anchor.body) {
    lines.push(markdownBullet(`anchor body: ${projection.anchor.body}`));
  }

  if (projection.neighbors.items.length === 0) {
    lines.push(markdownBullet('neighbors: none within requested hops'));
  } else {
    lines.push(markdownBullet('neighbors:'));
    for (const neighbor of projection.neighbors.items) {
      lines.push(`  ${markdownBullet(neighbor)}`);
    }
    if (projection.neighbors.omittedCount > 0) {
      lines.push(`  ${markdownBullet(`…${projection.neighbors.omittedCount} more neighbor(s) omitted`)}`);
    }
  }

  if (projection.edges.items.length === 0) {
    lines.push(markdownBullet('edges: none'));
  } else {
    lines.push(markdownBullet('edges:'));
    for (const edge of projection.edges.items) {
      lines.push(`  ${markdownBullet(edge)}`);
    }
    if (projection.edges.omittedCount > 0) {
      lines.push(`  ${markdownBullet(`…${projection.edges.omittedCount} more edge(s) omitted`)}`);
    }
  }

  return lines.join('\n');
}
