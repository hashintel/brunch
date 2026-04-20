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
        specification_id: 1,
        parent_turn_id: null,
        phase: 'grounding',
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
        specification_id: 1,
        parent_turn_id: null,
        phase: 'grounding',
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

  it('replays grounding cards as provisional history instead of ordinary questions', () => {
    const turns: TurnWithOptions[] = [
      {
        id: 1,
        specification_id: 1,
        parent_turn_id: null,
        phase: 'grounding',
        question: '',
        answer: 'Continue — Focus on the routed workspace seam.',
        why: null,
        impact: null,
        is_resolution: false,
        user_parts: JSON.stringify([
          { type: 'text', text: 'Continue — Focus on the routed workspace seam.' },
          {
            type: 'data-turn-response',
            data: { turnId: 1, selectedOptionIds: [11], freeText: 'Focus on the routed workspace seam.' },
          },
        ]),
        assistant_parts: JSON.stringify([
          {
            type: 'data-grounding-card',
            data: {
              summary: 'The repo already uses SQLite-backed local persistence.',
              detail: 'This is provisional context before the next substantive question.',
            },
          },
        ]),
        created_at: '2026-01-01',
        options: [{ id: 11, position: 0, content: 'Continue', is_recommended: true, is_selected: true }],
      },
    ];

    const result = buildInterviewerContext(turns, 'next');
    expect(result).toContain('Grounding card: The repo already uses SQLite-backed local persistence.');
    expect(result).toContain('Detail: This is provisional context before the next substantive question.');
    expect(result).toContain('Free-text response: Focus on the routed workspace seam.');
    expect(result).not.toContain('Question:');
  });

  it('projects selected options and free-text response as structured history', () => {
    const turns: TurnWithOptions[] = [
      {
        id: 1,
        specification_id: 1,
        parent_turn_id: null,
        phase: 'grounding',
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
        specification_id: 1,
        parent_turn_id: null,
        phase: 'grounding',
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
        specification_id: 1,
        parent_turn_id: null,
        phase: 'grounding',
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
        specification_id: 1,
        parent_turn_id: null,
        phase: 'grounding',
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
        specification_id: 1,
        parent_turn_id: 1,
        phase: 'grounding',
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

  it('includes the approved requirement inventory and current criterion inventory when criteria review is active', () => {
    const turns: TurnWithOptions[] = [
      {
        id: 10,
        specification_id: 1,
        parent_turn_id: 9,
        phase: 'criteria',
        question: 'What would prove the resume flow is complete?',
        answer: 'It should restore the active path after restart.',
        why: null,
        impact: null,
        is_resolution: false,
        user_parts: null,
        assistant_parts: null,
        created_at: '2026-01-04',
      },
    ];

    const result = buildInterviewerContext(turns, 'Propose a first criterion', {
      phase: 'criteria',
      entities: {
        approvedRequirements: [
          { id: 5, content: 'Resume the interview from SQLite after restart' },
          { id: 7, content: 'Export the reviewed spec as markdown' },
        ],
        criteria: [
          { id: 9, content: 'Restarting restores the active path' },
          { id: 10, content: 'Markdown export includes accepted requirements only' },
        ],
      },
    });

    expect(result).toContain('Approved requirements for criteria review:');
    expect(result).toContain('- [5] Resume the interview from SQLite after restart');
    expect(result).toContain('- [7] Export the reviewed spec as markdown');
    expect(result).toContain('Current criteria under review:');
    expect(result).toContain('- [9] Restarting restores the active path');
    expect(result).toContain('- [10] Markdown export includes accepted requirements only');
    expect(result).toContain('User: Propose a first criterion');
  });

  it('includes the current requirement inventory when requirements review is active', () => {
    const turns: TurnWithOptions[] = [
      {
        id: 7,
        specification_id: 1,
        parent_turn_id: 6,
        phase: 'requirements',
        question: 'Which requirements are still missing?',
        answer: 'A requirement is missing — Export the reviewed spec as markdown',
        why: 'Completeness review needs the current requirement set.',
        impact: 'high',
        is_resolution: false,
        user_parts: null,
        assistant_parts: null,
        created_at: '2026-01-03',
      },
    ];

    const result = (buildInterviewerContext as any)(turns, 'Review the next gap', {
      phase: 'requirements',
      entities: {
        requirements: [
          { id: 5, content: 'Resume the interview from SQLite after restart' },
          { id: 6, content: 'Export the reviewed spec as markdown' },
        ],
      },
    });

    expect(result).toContain('Current requirements under review:');
    expect(result).toContain('- [5] Resume the interview from SQLite after restart');
    expect(result).toContain('- [6] Export the reviewed spec as markdown');
    expect(result).toContain('User: Review the next gap');
  });
});

// --- Observer context projection ---

describe('observer-context-projection', () => {
  it('includes current turn question and answer', () => {
    const turn: Turn = {
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
    };

    const result = buildObserverContext({
      turn,
      activePathSummary: '',
      entities: {
        goals: [],
        terms: [],
        contexts: [],
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

  it('includes brownfield project context when kickoff is grounded in an existing repo', () => {
    const turn: Turn = {
      id: 5,
      specification_id: 1,
      parent_turn_id: 4,
      phase: 'grounding',
      turn_kind: 'question',
      question: 'Which part of the existing auth flow should we refine first?',
      answer: 'The login callback and redirect behavior.',
      why: 'Grounding: The repo has a dedicated auth module and callback route. We need the first question to stay anchored in that seam.',
      impact: 'high',
      is_resolution: false,
      user_parts: null,
      assistant_parts: null,
      created_at: '2026-01-01',
    };

    const result = buildObserverContext({
      turn,
      activePathSummary: '',
      projectMode: 'brownfield',
      projectCwd: '/tmp/repo',
      entities: {
        goals: [],
        terms: [],
        contexts: [],
        constraints: [],
        requirements: [],
        criteria: [],
        decisions: [],
        assumptions: [],
      },
    });

    expect(result).toContain('Project mode: brownfield');
    expect(result).toContain('Project directory: /tmp/repo');
    expect(result).toContain('Grounding: The repo has a dedicated auth module and callback route.');
  });

  it('includes existing entity graph', () => {
    const turn: Turn = {
      id: 5,
      specification_id: 1,
      parent_turn_id: 4,
      phase: 'grounding',
      turn_kind: 'question',
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
        goals: [],
        terms: [],
        contexts: [{ id: 3, content: 'The project starts from a fuzzy brief' }],
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
      specification_id: 1,
      parent_turn_id: 4,
      phase: 'grounding',
      turn_kind: 'question',
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
        goals: [],
        terms: [],
        contexts: [],
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

  it('projects structured turn responses in observer context through the shared response seam', () => {
    const turn: TurnWithOptions = {
      id: 5,
      specification_id: 1,
      parent_turn_id: 4,
      phase: 'requirements',
      turn_kind: 'question',
      question: 'Which requirements are still missing?',
      answer: 'Web, Desktop — Covers both launch paths',
      why: 'Requirement review needs the chosen response shape.',
      impact: 'high',
      is_resolution: false,
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
      assistant_parts: null,
      created_at: '2026-01-01',
      options: [
        { id: 11, position: 0, content: 'Web', is_recommended: true, is_selected: true },
        { id: 12, position: 1, content: 'Desktop', is_recommended: false, is_selected: true },
      ],
    };

    const result = buildObserverContext({
      turn,
      activePathSummary: '',
      entities: {
        goals: [],
        terms: [],
        contexts: [],
        constraints: [],
        requirements: [{ id: 3, content: 'Support both launch paths' }],
        criteria: [],
        decisions: [],
        assumptions: [],
      },
    });

    expect(result).toContain('Turn response:');
    expect(result).toContain('Chosen options: Web, Desktop');
    expect(result).toContain('Free-text response: Covers both launch paths');
    expect(result).not.toContain('Answer: Web, Desktop — Covers both launch paths');
  });

  it('renders entity tables with md-pen (not hand-rolled strings)', () => {
    const turn: Turn = {
      id: 5,
      specification_id: 1,
      parent_turn_id: 4,
      phase: 'grounding',
      turn_kind: 'question',
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
        goals: [],
        terms: [],
        contexts: [{ id: 3, content: 'The project is still being clarified' }],
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
    expect(result).toContain('### Existing Context');
    expect(result).toContain('### Existing Constraints');
    expect(result).toContain('### Existing Requirements');
    expect(result).toContain('### Existing Decisions');
    expect(result).toContain('### Existing Assumptions');
  });

  it('includes existing criteria alongside other generic entity sections for later-mode extraction', () => {
    const turn: Turn = {
      id: 6,
      specification_id: 1,
      parent_turn_id: 5,
      phase: 'criteria',
      turn_kind: 'question',
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
        goals: [],
        terms: [],
        contexts: [{ id: 3, content: 'The project is still being clarified' }],
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
