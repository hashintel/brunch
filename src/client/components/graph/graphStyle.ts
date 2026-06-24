/** Graph view styling leaf: edge stroke width + arrowhead size, and the per-kind accent color (shared with knowledge cards). */

import type { GraphEdgeRelationship } from '@/client/components/graph/types';
import { kindAccentHex } from '@/client/components/knowledge-card';
import type { KnowledgeKind } from '@/shared/knowledge.js';

/** Edge stroke width; the rendered stroke color comes from edgeColor by relationship. */
export const edgeStyle = {
  strokeWidth: 1,
} as const;

/** Directional arrowhead dimensions; the single shape is colored by relationship. */
export const arrowheadConfig = {
  width: 8,
  height: 8,
} as const;

/**
 * A distinct color per relationship type, so edges read by type at a glance.
 * `constrains` and `verifies` reuse the matching item accent (constraint pink,
 * requirement green) so the edge color echoes the item it relates.
 */
export const edgeColorByRelationship: Record<GraphEdgeRelationship, string> = {
  depends_on: '#4f46e5',
  derived_from: '#0d9488',
  constrains: kindAccentHex.constraint,
  verifies: kindAccentHex.requirement,
  refines: '#7c3aed',
};

/** Resolve a relationship type's edge color. */
export function edgeColor(relationship: GraphEdgeRelationship): string {
  return edgeColorByRelationship[relationship];
}

/**
 * Stroke dash pattern per relationship type: `derived_from` and `refines` render
 * dotted; the rest are solid (undefined → no dash). Lets edges read by line style
 * as well as color.
 */
export const edgeDashByRelationship: Record<GraphEdgeRelationship, string | undefined> = {
  depends_on: undefined,
  derived_from: '2 3',
  constrains: undefined,
  verifies: undefined,
  refines: '2 3',
};

/** Resolve a relationship type's stroke dash pattern (undefined = solid). */
export function edgeDash(relationship: GraphEdgeRelationship): string | undefined {
  return edgeDashByRelationship[relationship];
}

/** Accent color for each knowledge kind, keyed by kind (reuses the card palette so they never drift). */
export const nodeColorByKind: Record<KnowledgeKind, string> = kindAccentHex;

/** Resolve a knowledge kind's accent color for card and node accenting. */
export function nodeColor(kind: KnowledgeKind): string {
  return nodeColorByKind[kind];
}
