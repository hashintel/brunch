import { describe, it, expect } from 'vitest';

import { buildInterviewerContext, buildObserverContext } from './context.js';
import type { TurnWithOptions } from './core.js';
import type { Turn } from './db.js';

// --- Interviewer context (I19) ---

describe('buildInterviewerContext', () => {
  it('returns prompt as-is when no turns', () => {
    expect(buildInterviewerContext([], 'hello')).toBe('hello');
  });

  it('formats turns into conversation history', () => {
    const turns: TurnWithOptions[] = [
      {
        id: 1,
        project_id: 1,
        parent_turn_id: null,
        phase: 'scope',
        question: 'What is the project about?',
        answer: 'A chat app',
        why: null,
        impact: null,
        is_resolution: false,
        user_parts: null,
        assistant_parts: null,
        created_at: '2026-01-01',
      },
    ];

    const result = buildInterviewerContext(turns, 'next question');
    expect(result).toContain('Question: What is the project about?');
    expect(result).toContain('Answer: A chat app');
    expect(result).toContain('User: next question');
  });

  it('includes grounding, impact, and options', () => {
    const turns: TurnWithOptions[] = [
      {
        id: 1,
        project_id: 1,
        parent_turn_id: null,
        phase: 'scope',
        question: 'What is the primary goal?',
        answer: 'Build a new product',
        why: 'Shapes downstream decisions.',
        impact: 'high',
        is_resolution: false,
        user_parts: null,
        assistant_parts: null,
        created_at: '2026-01-01',
        options: [
          { id: 11, position: 0, content: 'Build a new product', is_recommended: false, is_selected: true },
          { id: 12, position: 1, content: 'Improve existing', is_recommended: true, is_selected: false },
        ],
      },
    ];

    const result = buildInterviewerContext(turns, 'next');
    expect(result).toContain('Why it matters: Shapes downstream decisions.');
    expect(result).toContain('Impact: high');
    expect(result).toContain('Build a new product');
    expect(result).toContain('(recommended)');
    expect(result).toContain('[selected]');
  });

  it('projects selected options and free-text response as structured history', () => {
    const turns: TurnWithOptions[] = [
      {
        id: 1,
        project_id: 1,
        parent_turn_id: null,
        phase: 'scope',
        question: 'Which platform should we target?',
        answer: 'Desktop — Best fit for our launch',
        why: 'Platform shapes the first build.',
        impact: 'high',
        is_resolution: false,
        user_parts: JSON.stringify([
          { type: 'text', text: 'Desktop — Best fit for our launch' },
          {
            type: 'data-turn-response',
            data: { turnId: 1, selectedOptionIds: [12], freeText: 'Best fit for our launch' },
          },
        ]),
        assistant_parts: null,
        created_at: '2026-01-01',
        options: [
          { id: 11, position: 0, content: 'Web', is_recommended: true, is_selected: false },
          { id: 12, position: 1, content: 'Desktop', is_recommended: false, is_selected: true },
        ],
      },
    ];

    const result = buildInterviewerContext(turns, 'next');

    expect(result).toContain('Turn response:');
    expect(result).toContain('Chosen options: Desktop');
    expect(result).toContain('Free-text response: Best fit for our launch');
    expect(result).not.toContain('Answer: Desktop — Best fit for our launch');
  });

  it('projects free-text-only turn responses as structured history', () => {
    const turns: TurnWithOptions[] = [
      {
        id: 1,
        project_id: 1,
        parent_turn_id: null,
        phase: 'scope',
        question: 'Which platform should we target?',
        answer: 'None of these fit our use case',
        why: 'Platform shapes the first build.',
        impact: 'high',
        is_resolution: false,
        user_parts: JSON.stringify([
          { type: 'text', text: 'None of these fit our use case' },
          {
            type: 'data-turn-response',
            data: { turnId: 1, selectedOptionIds: [], freeText: 'None of these fit our use case' },
          },
        ]),
        assistant_parts: null,
        created_at: '2026-01-01',
        options: [
          { id: 11, position: 0, content: 'Web', is_recommended: true, is_selected: false },
          { id: 12, position: 1, content: 'Desktop', is_recommended: false, is_selected: false },
        ],
      },
    ];

    const result = buildInterviewerContext(turns, 'next');

    expect(result).toContain('Turn response:');
    expect(result).not.toContain('Chosen options:');
    expect(result).toContain('Free-text response: None of these fit our use case');
    expect(result).not.toContain('Answer: None of these fit our use case');
  });

  it('projects many selected options as one structured turn response', () => {
    const turns: TurnWithOptions[] = [
      {
        id: 1,
        project_id: 1,
        parent_turn_id: null,
        phase: 'scope',
        question: 'Which platform should we target?',
        answer: 'Web, Desktop — Covers both launch paths',
        why: 'Platform shapes the first build.',
        impact: 'high',
        is_resolution: false,
        user_parts: JSON.stringify([
          { type: 'text', text: 'Web, Desktop — Covers both launch paths' },
          {
            type: 'data-turn-response',
            data: { turnId: 1, selectedOptionIds: [11, 12], freeText: 'Covers both launch paths' },
          },
        ]),
        assistant_parts: null,
        created_at: '2026-01-01',
        options: [
          { id: 11, position: 0, content: 'Web', is_recommended: true, is_selected: true },
          { id: 12, position: 1, content: 'Desktop', is_recommended: false, is_selected: true },
        ],
      },
    ];

    const result = buildInterviewerContext(turns, 'next');

    expect(result).toContain('Turn response:');
    expect(result).toContain('Chosen options: Web, Desktop');
    expect(result).toContain('Free-text response: Covers both launch paths');
    expect(result).not.toContain('Answer: Web, Desktop — Covers both launch paths');
  });

  it('handles multi-turn history', () => {
    const turns: TurnWithOptions[] = [
      {
        id: 1,
        project_id: 1,
        parent_turn_id: null,
        phase: 'scope',
        question: 'Q1',
        answer: 'A1',
        why: 'W1',
        impact: 'high',
        is_resolution: false,
        user_parts: null,
        assistant_parts: null,
        created_at: '2026-01-01',
      },
      {
        id: 2,
        project_id: 1,
        parent_turn_id: 1,
        phase: 'scope',
        question: 'Q2',
        answer: 'A2',
        why: null,
        impact: null,
        is_resolution: false,
        user_parts: null,
        assistant_parts: null,
        created_at: '2026-01-02',
      },
    ];

    const result = buildInterviewerContext(turns, 'Q3?');
    expect(result).toContain('Q1');
    expect(result).toContain('A1');
    expect(result).toContain('Q2');
    expect(result).toContain('A2');
    expect(result).toContain('User: Q3?');
  });
});

// --- Observer context projection ---

describe('observer-context-projection', () => {
  it('includes current turn question and answer', () => {
    const turn: Turn = {
      id: 5,
      project_id: 1,
      parent_turn_id: 4,
      phase: 'scope',
      question: 'What is the target audience?',
      answer: 'Developers building APIs',
      why: 'Audience shapes feature priorities.',
      impact: 'high',
      is_resolution: false,
      user_parts: null,
      assistant_parts: null,
      created_at: '2026-01-01',
    };

    const result = buildObserverContext({
      turn,
      activePathSummary: '',
      entities: {
        framing: [],
        constraints: [],
        requirements: [],
        criteria: [],
        decisions: [],
        assumptions: [],
      },
    });

    expect(result).toContain('What is the target audience?');
    expect(result).toContain('Developers building APIs');
  });

  it('includes existing entity graph', () => {
    const turn: Turn = {
      id: 5,
      project_id: 1,
      parent_turn_id: 4,
      phase: 'scope',
      question: 'Q5',
      answer: 'A5',
      why: null,
      impact: null,
      is_resolution: false,
      user_parts: null,
      assistant_parts: null,
      created_at: '2026-01-01',
    };

    const result = buildObserverContext({
      turn,
      activePathSummary: 'Turn 1: goal defined. Turn 2: audience chosen.',
      entities: {
        framing: [{ id: 3, content: 'The project starts from a fuzzy brief' }],
        constraints: [{ id: 4, content: 'Avoid heavyweight setup' }],
        requirements: [{ id: 5, content: 'Users can resume their interview later' }],
        criteria: [],
        decisions: [{ id: 1, content: 'Use TypeScript' }],
        assumptions: [{ id: 1, content: 'Team knows TS' }],
      },
    });

    expect(result).toContain('The project starts from a fuzzy brief');
    expect(result).toContain('Avoid heavyweight setup');
    expect(result).toContain('Users can resume their interview later');
    expect(result).toContain('Use TypeScript');
    expect(result).toContain('Team knows TS');
  });

  it('omits full conversational history padding', () => {
    const turn: Turn = {
      id: 5,
      project_id: 1,
      parent_turn_id: 4,
      phase: 'scope',
      question: 'Q5',
      answer: 'A5',
      why: null,
      impact: null,
      is_resolution: false,
      user_parts: null,
      assistant_parts: null,
      created_at: '2026-01-01',
    };

    const result = buildObserverContext({
      turn,
      activePathSummary: 'Turn 1: goal. Turn 2: audience.',
      entities: {
        framing: [],
        constraints: [],
        requirements: [],
        criteria: [],
        decisions: [],
        assumptions: [],
      },
    });

    // Should NOT contain the full Q&A pairs from earlier turns
    expect(result).not.toContain('Previous conversation:');
  });

  it('renders entity tables with md-pen (not hand-rolled strings)', () => {
    const turn: Turn = {
      id: 5,
      project_id: 1,
      parent_turn_id: 4,
      phase: 'scope',
      question: 'Q5',
      answer: 'A5',
      why: null,
      impact: null,
      is_resolution: false,
      user_parts: null,
      assistant_parts: null,
      created_at: '2026-01-01',
    };

    const result = buildObserverContext({
      turn,
      activePathSummary: '',
      entities: {
        framing: [{ id: 3, content: 'The project is still being clarified' }],
        constraints: [{ id: 4, content: 'Keep setup instant' }],
        requirements: [{ id: 5, content: 'Resume the interview from SQLite' }],
        criteria: [],
        decisions: [{ id: 1, content: 'Use React' }],
        assumptions: [{ id: 2, content: 'Users have browsers' }],
      },
    });

    // md-pen table() produces pipe-separated markdown tables
    expect(result).toContain('| ID | Content |');
    expect(result).toContain('| 3 | The project is still being clarified |');
    expect(result).toContain('| 4 | Keep setup instant |');
    expect(result).toContain('| 5 | Resume the interview from SQLite |');
    expect(result).toContain('| 1 | Use React |');
    expect(result).toContain('| 2 | Users have browsers |');
    // md-pen h3() produces ### headings
    expect(result).toContain('### Existing Framing');
    expect(result).toContain('### Existing Constraints');
    expect(result).toContain('### Existing Requirements');
    expect(result).toContain('### Existing Decisions');
    expect(result).toContain('### Existing Assumptions');
  });

  it('includes existing criteria alongside other generic entity sections for later-mode extraction', () => {
    const turn: Turn = {
      id: 6,
      project_id: 1,
      parent_turn_id: 5,
      phase: 'criteria',
      question: 'What would prove the resume flow is complete?',
      answer: 'It should restore the active path after restart.',
      why: null,
      impact: null,
      is_resolution: false,
      user_parts: null,
      assistant_parts: null,
      created_at: '2026-01-02',
    };

    const result = buildObserverContext({
      turn,
      activePathSummary: '',
      entities: {
        framing: [{ id: 3, content: 'The project is still being clarified' }],
        constraints: [{ id: 4, content: 'Keep setup instant' }],
        requirements: [{ id: 5, content: 'Resume the interview from SQLite' }],
        criteria: [{ id: 6, content: 'Restoring the project shows the active path' }],
        decisions: [{ id: 1, content: 'Use React' }],
        assumptions: [{ id: 2, content: 'Users have browsers' }],
      },
    } as never);

    expect(result).toContain('### Existing Requirements');
    expect(result).toContain('| 5 | Resume the interview from SQLite |');
    expect(result).toContain('### Existing Criteria');
    expect(result).toContain('| 6 | Restoring the project shows the active path |');
    expect(result).toContain('### Existing Decisions');
    expect(result).toContain('### Existing Assumptions');
  });
});
