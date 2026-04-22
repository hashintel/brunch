import type { ReviewSetData } from './chat.js';
import { createKnowledgeReferenceCode } from './knowledge.js';
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

function groundingRefsEqual(
  left: ReviewSetData['items'][number]['grounding'],
  right: ReviewSetData['items'][number]['grounding'],
): boolean {
  if (left === right) {
    return true;
  }

  if (!left?.length && !right?.length) {
    return true;
  }

  if ((left?.length ?? 0) !== (right?.length ?? 0)) {
    return false;
  }

  return left!.every((ref, index) => ref.code === right![index]?.code);
}

function reviewItemsDiffer(
  predecessor: ReviewSetData['items'][number],
  successor: ReviewSetData['items'][number],
): boolean {
  return (
    predecessor.content !== successor.content ||
    (predecessor.referenceCode ?? null) !== (successor.referenceCode ?? null) ||
    (predecessor.rationale ?? null) !== (successor.rationale ?? null) ||
    !groundingRefsEqual(predecessor.grounding, successor.grounding)
  );
}

function getCanonicalReferenceCodeForReviewItem(reviewItemId: string): string | null {
  const match = /^(requirements|criteria):(\d+)$/.exec(reviewItemId);
  if (!match) {
    return null;
  }

  const [, phase, ordinal] = match;
  return createKnowledgeReferenceCode(
    phase === 'requirements' ? 'requirement' : 'criterion',
    Number(ordinal),
  );
}

function stripReferenceCodePrefix(content: string, referenceCode: string | null): string {
  if (!referenceCode) {
    return content;
  }

  const prefix = `${referenceCode}: `;
  return content.startsWith(prefix) ? content.slice(prefix.length) : content;
}

function sanitizeReviewSetItemDisplayFields(
  item: ReviewSetData['items'][number],
): ReviewSetData['items'][number] {
  const canonicalReferenceCode = getCanonicalReferenceCodeForReviewItem(item.reviewItemId);
  const usesInternalReferenceCode = item.referenceCode === item.reviewItemId;
  const normalizedReferenceCode = usesInternalReferenceCode
    ? (canonicalReferenceCode ?? item.referenceCode)
    : (item.referenceCode ?? canonicalReferenceCode);

  return {
    ...item,
    ...(normalizedReferenceCode ? { referenceCode: normalizedReferenceCode } : {}),
    content: stripReferenceCodePrefix(item.content, normalizedReferenceCode ?? canonicalReferenceCode),
  };
}

export function normalizeReviewSetForDisplay(
  reviewSet: ReviewSetData,
  predecessor?: ReviewSetData | null,
): ReviewSetData {
  const sanitizedReviewSet = {
    ...reviewSet,
    items: reviewSet.items.map(sanitizeReviewSetItemDisplayFields),
  } satisfies ReviewSetData;

  if (!predecessor) {
    return sanitizedReviewSet;
  }

  const predecessorItemsByIdentity = new Map(
    predecessor.items.map(
      (item) => [getReviewItemIdentity(item), sanitizeReviewSetItemDisplayFields(item)] as const,
    ),
  );

  return {
    ...sanitizedReviewSet,
    items: sanitizedReviewSet.items.map((item) => {
      const predecessorItem = predecessorItemsByIdentity.get(getReviewItemIdentity(item));
      const normalizedItem: ReviewSetData['items'][number] = {
        ...item,
        ...(item.referenceCode === undefined && predecessorItem?.referenceCode
          ? { referenceCode: predecessorItem.referenceCode }
          : {}),
        ...(item.rationale === undefined && predecessorItem?.rationale
          ? { rationale: predecessorItem.rationale }
          : {}),
        ...(item.grounding === undefined && predecessorItem?.grounding
          ? { grounding: predecessorItem.grounding }
          : {}),
      };

      if (!predecessorItem) {
        return 'isUserCreated' in item ? normalizedItem : { ...normalizedItem, isUserCreated: true };
      }

      if ('isRevised' in item) {
        return normalizedItem;
      }

      return reviewItemsDiffer(predecessorItem, normalizedItem)
        ? { ...normalizedItem, isRevised: true }
        : normalizedItem;
    }),
  };
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
