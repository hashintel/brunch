/** Graph view styling leaf: neutral edge stroke + arrowhead, and the per-kind accent color (shared with knowledge cards). */

import { kindAccentHex } from '@/client/components/knowledge-card';
import type { KnowledgeKind } from '@/shared/knowledge.js';

/** Neutral edge styling, deliberately untinted by any kind accent color. */
export const edgeStyle = {
  stroke: '#94a3b8',
  strokeWidth: 1,
} as const;

/** Directional arrowhead configuration for edges. */
export const arrowheadConfig = {
  width: 8,
  height: 8,
  color: '#94a3b8',
} as const;

/** Accent color for each knowledge kind, keyed by kind (reuses the card palette so they never drift). */
export const nodeColorByKind: Record<KnowledgeKind, string> = kindAccentHex;

/** Resolve a knowledge kind's accent color for card and node accenting. */
export function nodeColor(kind: KnowledgeKind): string {
  return nodeColorByKind[kind];
}
