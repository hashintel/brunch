import { getPersistedReviewAction, getPersistedReviewSet } from './specification-state.js';
import type { SpecificationTurn } from './specification.js';

/**
 * Canonical review-item identity for diffing across revisions.
 * Uses the stable `reviewItemId` assigned at synthesis time.
 */
export function getReviewItemIdentity(item: {
  reviewItemId: string;
  referenceCode?: string | null;
  content: string;
}): string {
  return item.reviewItemId;
}

export interface ReviewSetChangeSummary {
  added: number;
  removed: number;
  revised: number;
}

/**
 * Compute a change summary between two review sets by comparing items
 * via canonical review item identity.
 */
export function computeReviewSetChangeSummary(
  predecessor: {
    items: readonly { content: string; reviewItemId: string; referenceCode?: string | null }[];
  },
  successor: {
    items: readonly { content: string; reviewItemId: string; referenceCode?: string | null }[];
  },
): ReviewSetChangeSummary {
  const predecessorKeys = new Map<string, string>();
  for (const item of predecessor.items) {
    const key = getReviewItemIdentity(item);
    predecessorKeys.set(key, item.content);
  }

  const successorKeys = new Set<string>();
  let added = 0;
  let revised = 0;

  for (const item of successor.items) {
    const key = getReviewItemIdentity(item);
    successorKeys.add(key);

    const predecessorContent = predecessorKeys.get(key);
    if (predecessorContent === undefined) {
      added += 1;
    } else if (predecessorContent !== item.content) {
      revised += 1;
    }
  }

  const removed = [...predecessorKeys.keys()].filter((key) => !successorKeys.has(key)).length;

  return { added, removed, revised };
}

/**
 * Compute the 1-based revision number for a review turn within a phase.
 * Counts how many review turns (turns with a persisted review set and action)
 * precede this turn in the phase, plus one.
 */
export function getReviewRevisionNumber(
  turn: Pick<SpecificationTurn, 'id'>,
  phaseTurns: readonly Pick<SpecificationTurn, 'id' | 'assistant_parts' | 'user_parts'>[],
): number {
  let count = 0;
  for (const phaseTurn of phaseTurns) {
    if (phaseTurn.id === turn.id) {
      return count + 1;
    }

    if (getPersistedReviewSet(phaseTurn) && getPersistedReviewAction(phaseTurn)) {
      count += 1;
    }
  }

  return count + 1;
}
