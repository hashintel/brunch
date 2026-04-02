import { describe, it, expect } from 'vitest';

import { buildInterviewerContext, buildObserverContext } from './context.js';
import { formatHistory, type TurnWithOptions } from './core.js';
import type { Turn } from './db.js';

// --- Interviewer context equivalence (I19) ---

describe('interviewer-context-equivalence', () => {
  it('returns prompt as-is when no turns — matches formatHistory', () => {
    const result = buildInterviewerContext([], 'hello');
    const expected = formatHistory([], 'hello');
    expect(result).toBe(expected);
  });

  it('formats turns into conversation history — matches formatHistory', () => {
    const turns = [
      {
        id: 1,
        project_id: 1,
        parent_turn_id: null,
        phase: 'scope' as const,
        question: 'What is the project about?',
        answer: 'A chat app',
        why: null,
        impact: null,
        is_resolution: false,
        user_parts: null,
        assistant_parts: null,
        created_at: '2026-01-01',
      },
    ] satisfies TurnWithOptions[];

    const result = buildInterviewerContext(turns, 'next question');
    const expected = formatHistory(turns, 'next question');
    expect(result).toBe(expected);
  });

  it('includes grounding, impact, and options — matches formatHistory', () => {
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
          { content: 'Build a new product', is_recommended: false, is_selected: true },
          { content: 'Improve existing', is_recommended: true, is_selected: false },
        ],
      },
    ];

    const result = buildInterviewerContext(turns, 'next');
    const expected = formatHistory(turns, 'next');
    expect(result).toBe(expected);
  });

  it('handles multi-turn history — matches formatHistory', () => {
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
    const expected = formatHistory(turns, 'Q3?');
    expect(result).toBe(expected);
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
      entities: { decisions: [], assumptions: [] },
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
        decisions: [{ id: 1, content: 'Use TypeScript' }],
        assumptions: [{ id: 1, content: 'Team knows TS' }],
      },
    });

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
      entities: { decisions: [], assumptions: [] },
    });

    // Should NOT contain the full Q&A pairs from earlier turns
    expect(result).not.toContain('Previous conversation:');
  });
});
