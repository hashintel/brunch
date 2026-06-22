/**
 * Single source of truth for per-kind accent colors shared by graph nodes and
 * knowledge cards.
 *
 * Reuses the existing accent palette so cards and graph nodes never drift apart.
 */

import { kindAccentHex } from '@/client/components/knowledge-card';
import type { KnowledgeKind } from '@/shared/knowledge.js';

/** Accent color for each knowledge kind, keyed by kind. */
export const nodeColorByKind: Record<KnowledgeKind, string> = kindAccentHex;

/** Resolve a knowledge kind's accent color for card and node accenting. */
export function nodeColor(kind: KnowledgeKind): string {
  return nodeColorByKind[kind];
}
