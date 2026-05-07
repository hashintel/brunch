export type EditImpactTier = 'none' | 'soft' | 'hard';

/**
 * Classify the impact of editing a knowledge item based on downstream count
 * and whether the item is in an active review set.
 *
 * - none: 0 downstream items
 * - soft: 1–2 downstream items, none in active review set
 * - hard: 3+ downstream items OR any affected item is in active review set
 */
export function classifyEditImpact(
  downstreamCount: number,
  hasActiveReviewSetMembership: boolean,
): EditImpactTier {
  if (downstreamCount === 0) return 'none';
  if (downstreamCount <= 2 && !hasActiveReviewSetMembership) return 'soft';
  return 'hard';
}
