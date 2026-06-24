import { cardFootprint } from '@/client/components/graph/cardFootprint';
import type { PositionedNode } from '@/client/components/graph/forceLayout.js';
import { kindRank, layerY, type SimInputNode, type SimModel } from '@/client/components/graph/graphForces.js';

/** Horizontal centre-to-centre spacing between cards in the same layer. */
const COLUMN_STRIDE = cardFootprint.width * 1.4;

/**
 * Deterministic layered ("workflow") layout: stack kinds into top-to-bottom rows
 * by hierarchy rank — goals at the top flowing down to criteria — and spread each
 * row's cards evenly left-to-right, centred on the origin. No physics: positions
 * are a pure function of the model, so the arrangement reads like a flowchart and
 * never jitters.
 */
export function workflowLayout(model: SimModel): PositionedNode[] {
  if (model.nodes.length === 0) return [];

  const byRank = new Map<number, SimInputNode[]>();
  for (const node of model.nodes) {
    const rank = kindRank[node.data.kind];
    const row = byRank.get(rank);
    if (row === undefined) byRank.set(rank, [node]);
    else row.push(node);
  }

  const positioned: PositionedNode[] = [];
  for (const row of byRank.values()) {
    const sorted = [...row].sort((a, b) => a.id.localeCompare(b.id));
    sorted.forEach((node, index) => {
      positioned.push({
        id: node.id,
        data: node.data,
        position: { x: (index - (sorted.length - 1) / 2) * COLUMN_STRIDE, y: layerY(node.data.kind) },
      });
    });
  }
  return positioned;
}
