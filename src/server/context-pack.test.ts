import { describe, expect, it } from 'vitest';

import {
  buildCandidateSpecContextPack,
  buildObserverCaptureContextPack,
  buildWebResearchContextPack,
  renderCandidateSpecContextPack,
  renderObserverCaptureContextPack,
  renderWebResearchContextPack,
  type ObserverContextPackInput,
} from './context-pack.js';
import type { TurnWithOptions } from './core.js';

function emptyEntities(): ObserverContextPackInput['entities'] {
  return {
    goals: [],
    terms: [],
    contexts: [],
    constraints: [],
    requirements: [],
    criteria: [],
    decisions: [],
    assumptions: [],
  };
}

function makeTurn(overrides: Partial<TurnWithOptions> = {}): TurnWithOptions {
  return {
    id: 5,
    specification_id: 1,
    parent_turn_id: 4,
    phase: 'grounding',
    turn_kind: 'question',
    question: 'What is the target audience?',
    answer: 'Developers building APIs',
    why: 'Audience shapes feature priorities.',
    impact: 'high',
    is_resolution: false,
    user_parts: null,
    assistant_parts: null,
    created_at: '2026-01-01',
    ...overrides,
  };
}

function expectObserverContextPackRendering(input: ObserverContextPackInput, expected: string) {
  expect(renderObserverCaptureContextPack(buildObserverCaptureContextPack(input))).toBe(expected);
}

describe('candidate-spec context packs', () => {
  it('renders a deterministic proposal brief from ranked anchors and known commitments', () => {
    const pack = buildCandidateSpecContextPack({
      objective: 'Synthesize plausible directions for a partial-scope Brunch feature.',
      requestedCandidateCount: 3,
      entities: {
        ...emptyEntities(),
        goals: [{ id: 1, content: 'Help users react to concrete candidate directions' }],
        constraints: [{ id: 4, content: 'Do not close the phase automatically' }],
        decisions: [{ id: 7, content: 'Candidate sets are turn-owned proposal artifacts' }],
        assumptions: [{ id: 8, content: 'Reaction-first synthesis can reduce interview fatigue' }],
      },
    });

    expect(pack.scenario).toBe('candidate-spec');
    expect(renderCandidateSpecContextPack(pack)).toBe(`Candidate-spec objective:
Synthesize plausible directions for a partial-scope Brunch feature.

Requested candidate count:
3

Known intent anchors:
#1 goal | Help users react to concrete candidate directions
#4 constraint | Do not close the phase automatically
#7 decision | Candidate sets are turn-owned proposal artifacts
#8 assumption | Reaction-first synthesis can reduce interview fatigue

Constraints:
- #4 Do not close the phase automatically

Assumptions:
- #8 Reaction-first synthesis can reduce interview fatigue

Decisions:
- #7 Candidate sets are turn-owned proposal artifacts

Generation instructions:
- Generate proposal directions only; do not treat output as accepted graph truth.
- For each direction, name implications, tradeoffs, likely generated knowledge, and what it rules out.
- Prefer directions that expose unresolved assumptions or constraints for human review.`);
  });
});

describe('web research context packs', () => {
  it('renders a deterministic research brief from graph anchors and constraints', () => {
    const pack = buildWebResearchContextPack({
      researchObjective: 'Find current evidence for OpenRouter tool-call compatibility.',
      triggeringQuestion: 'Should OpenRouter be the default onboarding provider?',
      constraints: ['Do not call providers during this probe.', 'Prefer vendor docs over blog posts.'],
      entities: {
        ...emptyEntities(),
        goals: [{ id: 1, content: 'Reduce first-run LLM setup friction' }],
        assumptions: [{ id: 74, content: 'OpenRouter will reduce first-run friction for Brunch users' }],
      },
    });

    expect(pack.scenario).toBe('web-research');
    expect(renderWebResearchContextPack(pack)).toBe(`Research objective:
Find current evidence for OpenRouter tool-call compatibility.

Triggering question:
Should OpenRouter be the default onboarding provider?

Known intent anchors:
#1 goal | Reduce first-run LLM setup friction
#74 assumption | OpenRouter will reduce first-run friction for Brunch users

Research constraints:
- Do not call providers during this probe.
- Prefer vendor docs over blog posts.`);
  });
});

describe('observer context packs', () => {
  it('builds a typed observer-capture pack with compact anchors and current-turn evidence', () => {
    const pack = buildObserverCaptureContextPack({
      turn: makeTurn(),
      activePathSummary: 'Turn 1: goal defined.',
      specificationMode: 'brownfield',
      workspaceDirectory: '/tmp/repo',
      entities: {
        ...emptyEntities(),
        contexts: [{ id: 3, content: 'The project starts from a fuzzy brief' }],
        requirements: [{ id: 5, content: 'Users can resume their interview later' }],
      },
    });

    expect(pack.scenario).toBe('observer-capture');
    expect(pack.data.specification).toEqual({ mode: 'brownfield', workspaceDirectory: '/tmp/repo' });
    expect(pack.data.activePathSummary).toBe('Turn 1: goal defined.');
    expect(pack.data.existingKnowledgeAnchors).toEqual([
      {
        id: 3,
        kind: 'context',
        content: 'The project starts from a fuzzy brief',
        preview: 'The project starts from a fuzzy brief',
      },
      {
        id: 5,
        kind: 'requirement',
        content: 'Users can resume their interview later',
        preview: 'Users can resume their interview later',
      },
    ]);
    expect(pack.data.currentTurn).toEqual({
      id: 5,
      phase: 'grounding',
      question: 'What is the target audience?',
      why: 'Audience shapes feature priorities.',
      impact: 'high',
      response: '  Answer: Developers building APIs',
    });
  });

  it('preserves empty observer context rendering', () => {
    expectObserverContextPackRendering(
      {
        turn: makeTurn(),
        activePathSummary: '',
        entities: emptyEntities(),
      },
      `Current turn #5:
  Phase: grounding
  Question: What is the target audience?
  Why: Audience shapes feature priorities.
  Impact: high
  Answer: Developers building APIs`,
    );
  });

  it('preserves brownfield observer context rendering', () => {
    expectObserverContextPackRendering(
      {
        turn: makeTurn({
          question: 'Which part of the existing auth flow should we refine first?',
          answer: 'The login callback and redirect behavior.',
          why: 'Grounding: The repo has a dedicated auth module and callback route.',
        }),
        activePathSummary: '',
        specificationMode: 'brownfield',
        workspaceDirectory: '/tmp/repo',
        entities: emptyEntities(),
      },
      `This specification is scoped to a feature or change within an existing codebase.
Workspace directory: /tmp/repo

Current turn #5:
  Phase: grounding
  Question: Which part of the existing auth flow should we refine first?
  Why: Grounding: The repo has a dedicated auth module and callback route.
  Impact: high
  Answer: The login callback and redirect behavior.`,
    );
  });

  it('preserves long-anchor observer context rendering', () => {
    const longContext =
      'The project is still being clarified with a deliberately long captured context that should be summarized as an anchor preview instead of copied wholesale into the observer prompt inventory.';

    const input: ObserverContextPackInput = {
      turn: makeTurn({ question: 'Q5', answer: 'A5', why: null, impact: null }),
      activePathSummary: '',
      entities: {
        ...emptyEntities(),
        contexts: [{ id: 3, content: longContext }],
        constraints: [{ id: 4, content: 'Keep setup instant' }],
        requirements: [{ id: 5, content: 'Resume the interview from SQLite' }],
        decisions: [{ id: 1, content: 'Use React' }],
        assumptions: [{ id: 2, content: 'Users have browsers' }],
      },
    };

    const pack = buildObserverCaptureContextPack(input);
    expect(pack.data.existingKnowledgeAnchors[0]?.preview).toContain('…');
    expect(renderObserverCaptureContextPack(pack)).not.toContain(longContext);
    expectObserverContextPackRendering(
      input,
      `Existing knowledge anchors:
#3 context | The project is still being clarified with a deliberately long captured context that should be summarized as an anchor preview instead of copied wholesale into…
#4 constraint | Keep setup instant
#5 requirement | Resume the interview from SQLite
#1 decision | Use React
#2 assumption | Users have browsers

Current turn #5:
  Phase: grounding
  Question: Q5
  Answer: A5`,
    );
  });

  it('preserves preface observer context rendering', () => {
    expectObserverContextPackRendering(
      {
        turn: makeTurn({
          question: 'What is the primary user persona?',
          answer: 'Developers building AI tools',
          user_parts: JSON.stringify([
            { type: 'text', text: 'Developers building AI tools' },
            {
              type: 'data-turn-response',
              data: { turnId: 5, selectedOptionIds: [], freeText: 'Developers building AI tools' },
            },
          ]),
          assistant_parts: JSON.stringify([
            {
              type: 'data-preface',
              data: {
                observation: 'The repo uses a React frontend with SQLite storage.',
                elaboration: 'Provisional context from workspace analysis.',
              },
            },
          ]),
        }),
        activePathSummary: '',
        entities: emptyEntities(),
      },
      `Current turn #5:
  Phase: grounding
  Preface: The repo uses a React frontend with SQLite storage.
  Preface elaboration: Provisional context from workspace analysis.
  Question: What is the primary user persona?
  Why: Audience shapes feature priorities.
  Impact: high
Turn response:
  Free-text response: Developers building AI tools`,
    );
  });

  it('preserves structured-response observer context rendering', () => {
    expectObserverContextPackRendering(
      {
        turn: makeTurn({
          phase: 'requirements',
          question: 'Which requirements are still missing?',
          answer: 'Web, Desktop — Covers both launch paths',
          user_parts: JSON.stringify([
            { type: 'text', text: 'Web, Desktop — Covers both launch paths' },
            {
              type: 'data-turn-response',
              data: {
                turnId: 5,
                selectedOptionIds: [11, 12],
                freeText: 'Covers both launch paths',
              },
            },
          ]),
          options: [
            { id: 11, position: 0, content: 'Web', is_recommended: true, is_selected: true },
            { id: 12, position: 1, content: 'Desktop', is_recommended: false, is_selected: true },
          ],
        }),
        activePathSummary: '',
        entities: {
          ...emptyEntities(),
          requirements: [{ id: 3, content: 'Support both launch paths' }],
        },
      },
      `Existing knowledge anchors:
#3 requirement | Support both launch paths

Current turn #5:
  Phase: requirements
  Question: Which requirements are still missing?
  Why: Audience shapes feature priorities.
  Impact: high
Turn response:
  Chosen options: Web, Desktop
  Free-text response: Covers both launch paths`,
    );
  });

  it('preserves review-turn observer context rendering', () => {
    expectObserverContextPackRendering(
      {
        turn: makeTurn({
          phase: 'criteria',
          question: 'What would prove the resume flow is complete?',
          answer: 'It should restore the active path after restart.',
        }),
        activePathSummary: '',
        entities: {
          ...emptyEntities(),
          requirements: [{ id: 5, content: 'Resume the interview from SQLite' }],
          criteria: [{ id: 6, content: 'Restoring the project shows the active path' }],
        },
      },
      `Existing knowledge anchors:
#5 requirement | Resume the interview from SQLite
#6 criterion | Restoring the project shows the active path

Current turn #5:
  Phase: criteria
  Question: What would prove the resume flow is complete?
  Why: Audience shapes feature priorities.
  Impact: high
  Answer: It should restore the active path after restart.`,
    );
  });
});
