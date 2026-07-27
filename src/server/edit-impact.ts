export type EditImpactTier = 'none' | 'soft' | 'hard';

/**
 * Classify the impact of editing a knowledge item based on policy-affected item
 * count and whether the edited item or any affected item is in an active review
 * set.
 *
 * - none: 0 affected items
 * - soft: 1–2 affected items, none in active review set
 * - hard: 3+ affected items OR any affected item is in active review set
 */
export function classifyEditImpact(
  affectedItemCount: number,
  hasActiveReviewSetMembership: boolean,
): EditImpactTier {
  if (affectedItemCount === 0) return 'none';
  if (affectedItemCount <= 2 && !hasActiveReviewSetMembership) return 'soft';
  return 'hard';
}
