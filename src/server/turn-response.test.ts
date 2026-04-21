import { describe, expect, it } from 'vitest';

import type { TurnWithOptions } from './core.js';
import { formatProjectedTurnResponse, projectTurnResponse } from './turn-response.js';

describe('projectTurnResponse', () => {
  it('reads selected options and free-text from the structured turn-response part', () => {
    const turn: TurnWithOptions = {
      id: 1,
      specification_id: 1,
      parent_turn_id: null,
      phase: 'grounding',
      question: 'Which platform should we target?',
      answer: 'Web, Desktop — Covers both launch paths',
      why: null,
      impact: null,
      is_resolution: false,
      user_parts: JSON.stringify([
        { type: 'text', text: 'Web, Desktop — Covers both launch paths' },
        {
          type: 'data-turn-response',
          data: {
            turnId: 1,
            selectedOptionIds: [11, 12],
            freeText: 'Covers both launch paths',
            reviewAction: 'accept',
          },
        },
      ]),
      assistant_parts: null,
      created_at: '2026-01-01',
      options: [
        { id: 11, position: 0, content: 'Web', is_recommended: true, is_selected: true },
        { id: 12, position: 1, content: 'Desktop', is_recommended: false, is_selected: true },
      ],
    };

    expect(projectTurnResponse(turn)).toEqual({
      selectedOptionIds: [11, 12],
      selectedOptionContents: ['Web', 'Desktop'],
      freeText: 'Covers both launch paths',
      reviewAction: 'accept',
    });
  });

  it('returns null when the structured turn-response part is missing even if options are selected', () => {
    const turn: TurnWithOptions = {
      id: 1,
      specification_id: 1,
      parent_turn_id: null,
      phase: 'grounding',
      question: 'Which platform should we target?',
      answer: 'Desktop',
      why: null,
      impact: null,
      is_resolution: false,
      user_parts: null,
      assistant_parts: null,
      created_at: '2026-01-01',
      options: [
        { id: 11, position: 0, content: 'Web', is_recommended: true, is_selected: false },
        { id: 12, position: 1, content: 'Desktop', is_recommended: false, is_selected: true },
      ],
    };

    expect(projectTurnResponse(turn)).toBeNull();
  });

  it('returns null for plain scalar answers with no structured response seam', () => {
    const turn: TurnWithOptions = {
      id: 1,
      specification_id: 1,
      parent_turn_id: null,
      phase: 'grounding',
      question: 'What is the project about?',
      answer: 'A chat app',
      why: null,
      impact: null,
      is_resolution: false,
      user_parts: JSON.stringify([{ type: 'text', text: 'A chat app' }]),
      assistant_parts: null,
      created_at: '2026-01-01',
      options: [],
    };

    expect(projectTurnResponse(turn)).toBeNull();
  });
});

describe('formatProjectedTurnResponse', () => {
  it('renders one shared structured projection shape for downstream consumers', () => {
    expect(
      formatProjectedTurnResponse({
        selectedOptionIds: [11, 12],
        selectedOptionContents: ['Web', 'Desktop'],
        freeText: 'Covers both launch paths',
      }),
    ).toBe('Turn response:\n  Chosen options: Web, Desktop\n  Free-text response: Covers both launch paths');
  });

  it('includes per-item comments in the formatted response', () => {
    const result = formatProjectedTurnResponse({
      selectedOptionIds: [2],
      selectedOptionContents: ['Request changes'],
      reviewAction: 'request-changes',
      freeText: 'Global note about the set',
      itemComments: [
        { reviewItemId: 'requirements:1', comment: 'Rewrite to focus on auth flow' },
        { reviewItemId: 'requirements:4', comment: 'Merge with R2' },
      ],
    });

    expect(result).toContain('Per-item comments:');
    expect(result).toContain('Item requirements:1: Rewrite to focus on auth flow');
    expect(result).toContain('Item requirements:4: Merge with R2');
    expect(result).toContain('Review action: request-changes');
    expect(result).toContain('Free-text response: Global note about the set');
  });

  it('omits per-item comments section when no comments exist', () => {
    const result = formatProjectedTurnResponse({
      selectedOptionIds: [1],
      selectedOptionContents: ['Accept review'],
      reviewAction: 'accept',
    });

    expect(result).not.toContain('Per-item comments');
  });
});

describe('projectTurnResponse with itemComments', () => {
  it('includes itemComments in the projected response when present', () => {
    const turn: TurnWithOptions = {
      id: 1,
      specification_id: 1,
      parent_turn_id: null,
      phase: 'requirements',
      question: 'Review requirements',
      answer: 'Request changes',
      why: null,
      impact: null,
      is_resolution: false,
      user_parts: JSON.stringify([
        { type: 'text', text: 'Request changes' },
        {
          type: 'data-turn-response',
          data: {
            turnId: 1,
            selectedOptionIds: [2],
            reviewAction: 'request-changes',
            freeText: 'Global feedback',
            itemComments: [
              { reviewItemId: 'requirements:1', comment: 'Rewrite to focus on auth' },
              { reviewItemId: 'requirements:3', comment: 'Remove this' },
            ],
          },
        },
      ]),
      assistant_parts: null,
      created_at: '2026-01-01',
      options: [
        { id: 1, position: 0, content: 'Accept review', is_recommended: false, is_selected: false },
        { id: 2, position: 1, content: 'Request changes', is_recommended: false, is_selected: true },
      ],
    };

    const result = projectTurnResponse(turn);
    expect(result?.itemComments).toEqual([
      { reviewItemId: 'requirements:1', comment: 'Rewrite to focus on auth' },
      { reviewItemId: 'requirements:3', comment: 'Remove this' },
    ]);
    expect(result?.reviewAction).toBe('request-changes');
  });

  it('omits itemComments from projection when not present', () => {
    const turn: TurnWithOptions = {
      id: 1,
      specification_id: 1,
      parent_turn_id: null,
      phase: 'requirements',
      question: 'Review requirements',
      answer: 'Accept',
      why: null,
      impact: null,
      is_resolution: false,
      user_parts: JSON.stringify([
        { type: 'text', text: 'Accept' },
        {
          type: 'data-turn-response',
          data: { turnId: 1, selectedOptionIds: [1], reviewAction: 'accept' },
        },
      ]),
      assistant_parts: null,
      created_at: '2026-01-01',
      options: [{ id: 1, position: 0, content: 'Accept review', is_recommended: false, is_selected: true }],
    };

    const result = projectTurnResponse(turn);
    expect(result?.itemComments).toBeUndefined();
  });
});
