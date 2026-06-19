/**
 * Visual styling helpers for the graph view.
 *
 * Maps a node's knowledge kind to an accent color and its degree to a rendered
 * size, and provides neutral edge styling plus directional arrowhead config.
 */

import { kindAccentHex } from '@/client/components/knowledge-card';

import type { GraphNodeKind } from '@/views/graph/types';

/** Resolve a node's accent color from its knowledge kind. */
export function nodeColor(kind: GraphNodeKind): string {
  return kindAccentHex[kind];
}

const BASE_SIZE = 8;
const DEGREE_SCALE = 4;

/**
 * Rendered size for a node given its degree. Grows monotonically with degree
 * but is bounded so even extreme degrees stay within a finite, sensible range.
 */
export function nodeSize(degree: number): number {
  return BASE_SIZE + DEGREE_SCALE * Math.log2(degree + 1);
}

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
