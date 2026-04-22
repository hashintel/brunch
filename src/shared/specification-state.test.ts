import { describe, expect, it } from 'vitest';

import { createKnowledgeReferenceCode } from './knowledge.js';
import {
  deriveSpecificationLanding,
  findTurnOptionsByPositions,
  getAcceptedClosureReplay,
  getPersistedActivitySummary,
  getPersistedGroundingCard,
  getPersistedReviewAction,
  getPersistedReviewSet,
  getReviewActionForSelectedPositions,
  getReviewPositionForAction,
  safeParsePersistedAssistantParts,
  safeParsePersistedUserParts,
  turnHasCompletedAnswer,
  turnIsControlOrClosureArtifact,
} from './specification-state.js';
import type { SpecificationState, SpecificationTurn as SpecificationStateTurn } from './specification.js';

function createTurn(overrides: Partial<SpecificationStateTurn> = {}): SpecificationStateTurn {
  return {
    id: 1,
    specification_id: 1,
    parent_turn_id: null,
    phase: 'grounding',
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
  overrides: Partial<SpecificationState['workflow']['phases']['grounding']> = {},
): SpecificationState['workflow']['phases']['grounding'] {
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

function createSpecificationState(
  overrides: Partial<SpecificationState> = {},
  phaseOverrides: Partial<SpecificationState['workflow']['phases']['grounding']> = {},
  turns: SpecificationState['turns'] = [createTurn()],
): SpecificationState {
  return {
    specification: {
      id: 1,
      name: 'Project 1',
      mode: 'greenfield',
      active_turn_id: turns.at(-1)?.id ?? null,
      created_at: '2026-04-16 10:00:00',
      updated_at: '2026-04-16 10:00:00',
    },
    workflow: {
      phases: {
        grounding: {
          status: 'in_progress',
          closeability: false,
          readiness: 'low',
          closureBasis: null,
          proposalPending: false,
          turnId: turns.at(-1)?.phase === 'grounding' ? (turns.at(-1)?.id ?? null) : null,
          summary: null,
          ...phaseOverrides,
        },
        design: createPhaseState({ status: 'unstarted', closureBasis: null, summary: null, turnId: null }),
        requirements: createPhaseState({
          status: 'unstarted',
          closureBasis: null,
          summary: null,
          turnId: null,
        }),
        criteria: createPhaseState({ status: 'unstarted', closureBasis: null, summary: null, turnId: null }),
      },
    },
    turns,
    ...overrides,
  };
}

describe('specification-state helpers', () => {
  it('safely parses persisted assistant and user parts', () => {
    expect(safeParsePersistedAssistantParts('not-json')).toEqual([]);
    expect(safeParsePersistedUserParts(null)).toEqual([]);
  });

  it('drops malformed persisted part payloads before read-model helpers consume them', () => {
    const malformedTurn = createTurn({
      answer: null,
      user_parts: JSON.stringify([
        { type: 'text', text: 'Resume work' },
        { type: 'data-turn-response', data: { turnId: 1, selectedOptionIds: [] } },
      ]),
      assistant_parts: JSON.stringify([
        { type: 'text', text: 'Please review the requirement set.' },
        { type: 'data-review-set', data: { phase: 'requirements' } },
      ]),
    });

    expect(safeParsePersistedAssistantParts(malformedTurn.assistant_parts)).toEqual([
      { type: 'text', text: 'Please review the requirement set.' },
    ]);
    expect(safeParsePersistedUserParts(malformedTurn.user_parts)).toEqual([
      { type: 'text', text: 'Resume work' },
    ]);
    expect(getPersistedReviewSet(malformedTurn)).toBeNull();
    expect(getPersistedReviewAction(malformedTurn)).toBeNull();
    expect(turnHasCompletedAnswer(malformedTurn)).toBe(false);
  });

  it('derives truthful open-phase landing from workflow state and active-path turns', () => {
    expect(
      deriveSpecificationLanding(
        createSpecificationState({}, { turnId: null }, [
          createTurn({
            id: 1,
            answer: 'Build the web app',
            options: [],
          }),
        ]),
      ),
    ).toEqual({ kind: 'recovery', phase: 'grounding' });

    expect(
      deriveSpecificationLanding(
        createSpecificationState({}, { turnId: 2 }, [
          createTurn({
            id: 1,
            answer: 'Build the web app',
            options: [],
          }),
          createTurn({
            id: 2,
            parent_turn_id: 1,
            answer: null,
            options: [{ id: 11, position: 0, content: 'Web', is_recommended: true, is_selected: false }],
          }),
        ]),
      ),
    ).toEqual({ kind: 'frontier-turn', phase: 'grounding', turnId: 2 });

    expect(
      deriveSpecificationLanding({
        ...createSpecificationState({}, { turnId: null }, [
          createTurn({ id: 1, answer: null, options: [], question: '' }),
        ]),
        structuralArtifactTurnIds: [1],
      }),
    ).toEqual({ kind: 'kickoff', phase: 'grounding', mode: 'start' });
  });

  it('classifies turns as control artifacts by structural id membership, not by parts or turn_kind', () => {
    const structuralIds = new Set([10, 20, 30]);
    expect(turnIsControlOrClosureArtifact(createTurn({ id: 10 }), structuralIds)).toBe(true);
    expect(turnIsControlOrClosureArtifact(createTurn({ id: 20 }), structuralIds)).toBe(true);
    expect(turnIsControlOrClosureArtifact(createTurn({ id: 30 }), structuralIds)).toBe(true);
    expect(turnIsControlOrClosureArtifact(createTurn({ id: 1 }), structuralIds)).toBe(false);
    expect(turnIsControlOrClosureArtifact(createTurn({ id: 99 }), structuralIds)).toBe(false);
    expect(turnIsControlOrClosureArtifact(createTurn({ id: 1 }), new Set())).toBe(false);
  });

  it('reads persisted grounding-card artifacts from assistant parts', () => {
    const groundingTurn = createTurn({
      answer: null,
      assistant_parts: JSON.stringify([
        {
          type: 'data-grounding-card',
          data: {
            observation: 'The repo already uses local-first persistence.',
            elaboration: 'The next turn should narrow the feature-area boundary before design choices.',
            continueLabel: 'Continue',
          },
        },
      ]),
      options: [{ id: 11, position: 0, content: 'Continue', is_recommended: true, is_selected: false }],
    });

    expect(getPersistedGroundingCard(groundingTurn)).toEqual({
      observation: 'The repo already uses local-first persistence.',
      elaboration: 'The next turn should narrow the feature-area boundary before design choices.',
      continueLabel: 'Continue',
    });
  });

  it('replays an accepted closure from the persisted confirmation and summary parts', () => {
    const turn = createTurn({
      answer: 'Confirm grounding closure',
      is_resolution: true,
      user_parts: JSON.stringify([
        { type: 'text', text: 'Confirm grounding closure' },
        {
          type: 'data-confirmation',
          data: { kind: 'confirm-proposed-phase-closure', proposalTurnId: 1, phase: 'grounding' },
        },
      ]),
      assistant_parts: JSON.stringify([
        {
          type: 'data-phase-summary',
          data: {
            turnId: 1,
            phase: 'grounding',
            summary: 'Goals, terms, context, and constraints are sufficiently captured.',
          },
        },
      ]),
    });

    expect(getAcceptedClosureReplay(turn, createPhaseState())).toEqual({
      turnId: 1,
      phase: 'grounding',
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
    ).toEqual({ tools: [] });
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
      assistant_parts: JSON.stringify([
        {
          type: 'tool-ask_question',
          toolCallId: 'tool-review',
          state: 'output-available',
          input: {
            question: 'Please review the requirement set.',
            why: 'Review keeps the set truthful before closing the phase.',
            impact: 'high',
            options: [
              { content: 'Accept review', is_recommended: true },
              { content: 'Request changes', is_recommended: false },
            ],
            reviewActions: [
              { action: 'accept', optionPosition: 0 },
              { action: 'request-changes', optionPosition: 1 },
            ],
            reviewSet: {
              phase: 'requirements',
              title: 'Requirements',
              items: [
                {
                  reviewItemId: 'requirements:1',
                  referenceCode: createKnowledgeReferenceCode('requirement', 1),
                  content: 'Resume the interview from persisted local state',
                  rationale: 'Core local-first promise.',
                },
              ],
            },
          },
          output: { ok: true, turnId: 1, optionCount: 2 },
        },
      ]),
      user_parts: JSON.stringify([
        { type: 'text', text: 'Ship this set' },
        {
          type: 'data-turn-response',
          data: { turnId: 1, selectedOptionIds: [11], reviewAction: 'accept' },
        },
      ]),
    });

    expect(getPersistedReviewAction(reviewTurn)).toBe('accept');
    expect(getReviewPositionForAction(reviewTurn, 'accept')).toBe(0);
    expect(getReviewPositionForAction(reviewTurn, 'request-changes')).toBe(1);
    expect(getReviewPositionForAction(createTurn(), 'accept')).toBeNull();
    expect(getReviewActionForSelectedPositions(reviewTurn, [0])).toBe('accept');
    expect(getReviewActionForSelectedPositions(reviewTurn, [1])).toBe('request-changes');
    expect(getReviewActionForSelectedPositions(createTurn(), [0])).toBeNull();
  });

  it('reads persisted turn-owned review-set artifacts from assistant parts', () => {
    const reviewTurn = createTurn({
      phase: 'requirements',
      assistant_parts: JSON.stringify([
        { type: 'text', text: 'Please review the synthesized requirement set.' },
        {
          type: 'data-review-set',
          data: {
            phase: 'requirements',
            title: 'Requirements',
            items: [
              {
                reviewItemId: 'requirements:1',
                referenceCode: createKnowledgeReferenceCode('requirement', 1),
                content: 'Resume the interview from persisted local state',
                rationale: 'Core local-first promise.',
                grounding: [
                  { code: createKnowledgeReferenceCode('goal', 1) },
                  { code: createKnowledgeReferenceCode('context', 1) },
                ],
              },
            ],
          },
        },
      ]),
    });

    expect(getPersistedReviewSet(reviewTurn)).toEqual({
      phase: 'requirements',
      title: 'Requirements',
      items: [
        {
          reviewItemId: 'requirements:1',
          referenceCode: createKnowledgeReferenceCode('requirement', 1),
          content: 'Resume the interview from persisted local state',
          rationale: 'Core local-first promise.',
          grounding: [
            { code: createKnowledgeReferenceCode('goal', 1) },
            { code: createKnowledgeReferenceCode('context', 1) },
          ],
        },
      ],
    });
  });
});
