import { describe, expect, it } from 'vitest';

import {
  computeReviewSetChangeSummary,
  getReviewItemIdentity,
  getReviewRevisionNumber,
} from './review-diffing.js';

describe('getReviewItemIdentity', () => {
  it('returns the reviewItemId as the canonical identity', () => {
    expect(
      getReviewItemIdentity({
        reviewItemId: 'requirements:1',
        referenceCode: 'REQ-1',
        content: 'Export as markdown',
      }),
    ).toBe('requirements:1');
  });

  it('ignores referenceCode and content for identity', () => {
    const base = { reviewItemId: 'criteria:3', content: 'original' };
    const revised = { reviewItemId: 'criteria:3', content: 'revised', referenceCode: 'AC-3' };
    expect(getReviewItemIdentity(base)).toBe(getReviewItemIdentity(revised));
  });
});

describe('computeReviewSetChangeSummary', () => {
  it('returns zeros when both sets are identical', () => {
    const items = [
      { reviewItemId: 'r:1', content: 'A' },
      { reviewItemId: 'r:2', content: 'B' },
    ];
    expect(computeReviewSetChangeSummary({ items }, { items })).toEqual({
      added: 0,
      removed: 0,
      revised: 0,
    });
  });

  it('counts added items', () => {
    const predecessor = { items: [{ reviewItemId: 'r:1', content: 'A' }] };
    const successor = {
      items: [
        { reviewItemId: 'r:1', content: 'A' },
        { reviewItemId: 'r:2', content: 'B' },
      ],
    };
    expect(computeReviewSetChangeSummary(predecessor, successor)).toEqual({
      added: 1,
      removed: 0,
      revised: 0,
    });
  });

  it('counts removed items', () => {
    const predecessor = {
      items: [
        { reviewItemId: 'r:1', content: 'A' },
        { reviewItemId: 'r:2', content: 'B' },
      ],
    };
    const successor = { items: [{ reviewItemId: 'r:1', content: 'A' }] };
    expect(computeReviewSetChangeSummary(predecessor, successor)).toEqual({
      added: 0,
      removed: 1,
      revised: 0,
    });
  });

  it('counts revised items by matching reviewItemId with changed content', () => {
    const predecessor = {
      items: [
        { reviewItemId: 'r:1', content: 'Original text' },
        { reviewItemId: 'r:2', content: 'Unchanged' },
      ],
    };
    const successor = {
      items: [
        { reviewItemId: 'r:1', content: 'Revised text' },
        { reviewItemId: 'r:2', content: 'Unchanged' },
      ],
    };
    expect(computeReviewSetChangeSummary(predecessor, successor)).toEqual({
      added: 0,
      removed: 0,
      revised: 1,
    });
  });

  it('counts mixed changes', () => {
    const predecessor = {
      items: [
        { reviewItemId: 'r:1', content: 'Keep' },
        { reviewItemId: 'r:2', content: 'Will be revised' },
        { reviewItemId: 'r:3', content: 'Will be removed' },
      ],
    };
    const successor = {
      items: [
        { reviewItemId: 'r:1', content: 'Keep' },
        { reviewItemId: 'r:2', content: 'Has been revised' },
        { reviewItemId: 'r:4', content: 'Newly added' },
      ],
    };
    expect(computeReviewSetChangeSummary(predecessor, successor)).toEqual({
      added: 1,
      removed: 1,
      revised: 1,
    });
  });
});

describe('getReviewRevisionNumber', () => {
  function makeTurn(
    id: number,
    opts: { hasReviewSet?: boolean; hasReviewAction?: boolean } = {},
  ): { id: number; assistant_parts: string | null; user_parts: string | null } {
    const assistantParts = opts.hasReviewSet
      ? JSON.stringify([
          {
            type: 'data-review-set',
            data: {
              phase: 'requirements',
              title: 'Requirements',
              items: [{ reviewItemId: 'r:1', content: 'A' }],
            },
          },
        ])
      : null;

    const userParts = opts.hasReviewAction
      ? JSON.stringify([
          {
            type: 'data-turn-response',
            data: { turnId: id, selectedOptionIds: [1], reviewAction: 'accept' },
          },
        ])
      : null;

    return { id, assistant_parts: assistantParts, user_parts: userParts };
  }

  it('returns 1 for the first review turn', () => {
    const turn = makeTurn(1, { hasReviewSet: true, hasReviewAction: true });
    expect(getReviewRevisionNumber(turn, [turn])).toBe(1);
  });

  it('returns 2 for the second review turn after one answered review', () => {
    const first = makeTurn(1, { hasReviewSet: true, hasReviewAction: true });
    const second = makeTurn(2, { hasReviewSet: true, hasReviewAction: true });
    expect(getReviewRevisionNumber(second, [first, second])).toBe(2);
  });

  it('skips non-review turns when counting', () => {
    const question = makeTurn(1);
    const review = makeTurn(2, { hasReviewSet: true, hasReviewAction: true });
    expect(getReviewRevisionNumber(review, [question, review])).toBe(1);
  });

  it('returns count + 1 when the turn is not found in phase turns', () => {
    const review = makeTurn(1, { hasReviewSet: true, hasReviewAction: true });
    const target = makeTurn(99);
    expect(getReviewRevisionNumber(target, [review])).toBe(2);
  });
});
