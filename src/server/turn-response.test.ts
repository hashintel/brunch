import { describe, expect, it } from 'vitest';

import type { TurnWithOptions } from './core.js';
import { formatProjectedTurnResponse, projectTurnResponse } from './turn-response.js';

describe('projectTurnResponse', () => {
  it('reads selected options and free-text from the structured turn-response part', () => {
    const turn: TurnWithOptions = {
      id: 1,
      project_id: 1,
      parent_turn_id: null,
      phase: 'scope',
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
      project_id: 1,
      parent_turn_id: null,
      phase: 'scope',
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
      project_id: 1,
      parent_turn_id: null,
      phase: 'scope',
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
});
