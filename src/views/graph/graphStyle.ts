/** Graph view styling leaf: neutral edge stroke + arrowhead, and the per-kind accent color (shared with knowledge cards). */

import { kindAccentHex } from '@/client/components/knowledge-card';
import type { KnowledgeKind } from '@/shared/knowledge.js';
import type { GraphEdgeRelationship } from '@/views/graph/types';

/** Neutral edge baseline; the rendered stroke color comes from edgeColor by relationship. */
export const edgeStyle = {
  stroke: '#94a3b8',
  strokeWidth: 1,
} as const;

/** Directional arrowhead dimensions; a single shape, colored by relationship. */
export const arrowheadConfig = {
  width: 8,
  height: 8,
  color: '#94a3b8',
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

/** Accent color for each knowledge kind, keyed by kind (reuses the card palette so they never drift). */
export const nodeColorByKind: Record<KnowledgeKind, string> = kindAccentHex;

/** Resolve a knowledge kind's accent color for card and node accenting. */
export function nodeColor(kind: KnowledgeKind): string {
  return nodeColorByKind[kind];
}
