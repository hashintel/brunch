import { describe, expect, it } from 'vitest';

import type { ProjectState, ProjectStateTurn } from './api-types.js';
import {
  findTurnOptionsByPositions,
  getAcceptedClosureReplay,
  getPersistedActivitySummary,
  getPersistedReviewAction,
  getReviewActionForSelectedPositions,
  safeParsePersistedAssistantParts,
  safeParsePersistedUserParts,
  turnIsControlOrClosureArtifact,
} from './project-state-turn.js';

function createTurn(overrides: Partial<ProjectStateTurn> = {}): ProjectStateTurn {
  return {
    id: 1,
    project_id: 1,
    parent_turn_id: null,
    phase: 'scope',
    turn_kind: 'question',
    question: 'What should we build first?',
    why: 'This frames the first iteration.',
    impact: 'high',
    answer: 'Build the web app',
    is_resolution: false,
    user_parts: JSON.stringify([{ type: 'text', text: 'Build the web app' }]),
    assistant_parts: JSON.stringify([{ type: 'text', text: 'What should we build first?' }]),
    created_at: '2026-04-16 10:00:00',
    options: [
      { id: 11, position: 0, content: 'Web', is_recommended: true, is_selected: false },
      { id: 12, position: 1, content: 'Desktop', is_recommended: false, is_selected: false },
    ],
    ...overrides,
  };
}

function createPhaseState(
  overrides: Partial<ProjectState['workflow']['phases']['scope']> = {},
): ProjectState['workflow']['phases']['scope'] {
  return {
    status: 'closed',
    closeability: false,
    readiness: 'high',
    closureBasis: 'interviewer_recommended',
    proposalPending: false,
    turnId: 1,
    summary: 'Goals, terms, context, and constraints are sufficiently captured.',
    ...overrides,
  };
}

describe('project-state-turn helpers', () => {
  it('safely parses persisted assistant and user parts', () => {
    expect(safeParsePersistedAssistantParts('not-json')).toEqual([]);
    expect(safeParsePersistedUserParts(null)).toEqual([]);
  });

  it('classifies kickoff, recovery, confirmation, and closure-summary turns as control artifacts', () => {
    expect(turnIsControlOrClosureArtifact(createTurn({ turn_kind: 'kickoff', answer: null }))).toBe(true);
    expect(turnIsControlOrClosureArtifact(createTurn({ turn_kind: 'recovery', answer: null }))).toBe(true);
    expect(
      turnIsControlOrClosureArtifact(
        createTurn({
          user_parts: JSON.stringify([
            { type: 'text', text: 'Confirm grounding closure' },
            {
              type: 'data-confirmation',
              data: { kind: 'confirm-proposed-phase-closure', proposalTurnId: 1, phase: 'scope' },
            },
          ]),
        }),
      ),
    ).toBe(true);
    expect(
      turnIsControlOrClosureArtifact(
        createTurn({
          assistant_parts: JSON.stringify([
            {
              type: 'data-phase-summary',
              data: {
                turnId: 1,
                phase: 'scope',
                summary: 'Goals, terms, context, and constraints are sufficiently captured.',
              },
            },
          ]),
        }),
      ),
    ).toBe(true);
    expect(turnIsControlOrClosureArtifact(createTurn())).toBe(false);
  });

  it('replays an accepted closure from the persisted confirmation and summary parts', () => {
    const turn = createTurn({
      answer: 'Confirm grounding closure',
      is_resolution: true,
      user_parts: JSON.stringify([
        { type: 'text', text: 'Confirm grounding closure' },
        {
          type: 'data-confirmation',
          data: { kind: 'confirm-proposed-phase-closure', proposalTurnId: 1, phase: 'scope' },
        },
      ]),
      assistant_parts: JSON.stringify([
        {
          type: 'data-phase-summary',
          data: {
            turnId: 1,
            phase: 'scope',
            summary: 'Goals, terms, context, and constraints are sufficiently captured.',
          },
        },
      ]),
    });

    expect(getAcceptedClosureReplay(turn, createPhaseState())).toEqual({
      turnId: 1,
      phase: 'scope',
      summary: 'Goals, terms, context, and constraints are sufficiently captured.',
    });
  });

  it('reads persisted activity summaries and falls back to older raw tool parts', () => {
    expect(
      getPersistedActivitySummary(
        createTurn({
          assistant_parts: JSON.stringify([
            {
              type: 'data-activity-summary',
              data: { seconds: 3, tools: ['structured question'] },
            },
          ]),
        }),
      ),
    ).toEqual({ seconds: 3, tools: ['structured question'] });

    expect(
      getPersistedActivitySummary(
        createTurn({
          assistant_parts: JSON.stringify([
            { type: 'reasoning', text: 'Thinking…', state: 'done' },
            {
              type: 'tool-ask_question',
              toolCallId: 'tool-1',
              state: 'output-available',
              input: {
                question: 'What should we build first?',
                why: 'This frames the first iteration.',
                impact: 'high',
                options: [
                  { content: 'Web', is_recommended: true },
                  { content: 'Desktop', is_recommended: false },
                ],
              },
              output: { ok: true, turnId: 1, optionCount: 2 },
            },
          ]),
        }),
      ),
    ).toEqual({ tools: ['structured question'] });
  });

  it('finds selected options by unique positions without route-private helpers', () => {
    const turn = createTurn();

    expect(findTurnOptionsByPositions(turn, [1, 1, 0]).map((option) => option.content)).toEqual([
      'Web',
      'Desktop',
    ]);
  });

  it('reads and derives explicit review actions for full-set review turns', () => {
    const reviewTurn = createTurn({
      phase: 'requirements',
      user_parts: JSON.stringify([
        { type: 'text', text: 'Ship this set' },
        {
          type: 'data-turn-response',
          data: { turnId: 1, selectedOptionIds: [11], reviewAction: 'accept' },
        },
      ]),
    });

    expect(getPersistedReviewAction(reviewTurn)).toBe('accept');
    expect(getReviewActionForSelectedPositions(reviewTurn, [0])).toBe('accept');
    expect(getReviewActionForSelectedPositions(reviewTurn, [1])).toBe('request-changes');
    expect(getReviewActionForSelectedPositions(createTurn({ phase: 'scope' }), [0])).toBeNull();
  });
});
