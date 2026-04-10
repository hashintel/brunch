import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { structuredQuestionSchema, type StructuredQuestion } from '../shared/chat.js';
import { createDb, createProject, createTurn, getOptionsForTurn, getTurn, type DB } from './db.js';
import {
  canProposePhaseClosure,
  getSystemPrompt,
  persistFallbackQuestionText,
  persistStructuredQuestion,
} from './interview.js';

let db: DB;

beforeEach(() => {
  db = createDb();
});

afterEach(() => {
  db.$client.close();
});

describe('structuredQuestionSchema', () => {
  it('parses a valid structured question', () => {
    const valid: StructuredQuestion = {
      question: 'What is the primary goal of your project?',
      why: 'Understanding the goal shapes all downstream decisions.',
      impact: 'high',
      options: [
        { content: 'Build a new product from scratch', is_recommended: false },
        { content: 'Improve an existing product', is_recommended: true },
      ],
    };

    expect(structuredQuestionSchema.parse(valid)).toEqual(valid);
  });

  it('rejects a question with fewer than two options', () => {
    expect(() =>
      structuredQuestionSchema.parse({
        question: 'What?',
        why: 'Because.',
        impact: 'high',
        options: [{ content: 'Only one', is_recommended: false }],
      }),
    ).toThrow();
  });
});

describe('getSystemPrompt', () => {
  it('returns distinct prompts for different phases', () => {
    expect(getSystemPrompt('scope')).not.toBe(getSystemPrompt('design'));
  });

  it('keeps the scope prompt specific to structured questioning', () => {
    expect(getSystemPrompt('scope')).toContain('ask_question');
    expect(getSystemPrompt('scope')).toContain('structured questions');
  });

  it('teaches the design prompt to propose closure when enough design direction is captured', () => {
    expect(getSystemPrompt('design')).toContain('propose_phase_closure');
  });

  it('grounds the requirements prompt in the current requirement inventory', () => {
    expect(getSystemPrompt('requirements')).toContain('current requirement inventory');
    expect(getSystemPrompt('requirements')).toContain('requirement-approval');
    expect(getSystemPrompt('requirements')).toContain('requirement-rejection');
    expect(getSystemPrompt('requirements')).toContain('propose_phase_closure');
  });
});

describe('canProposePhaseClosure', () => {
  it('enables closure proposals for scope and design, and for requirements only once closeable', () => {
    expect(canProposePhaseClosure('scope')).toBe(true);
    expect(canProposePhaseClosure('design')).toBe(true);
    expect(canProposePhaseClosure('requirements', false)).toBe(false);
    expect(canProposePhaseClosure('requirements', true)).toBe(true);
    expect(canProposePhaseClosure('criteria')).toBe(false);
  });
});

describe('persistStructuredQuestion', () => {
  it('stores question metadata and options on the turn', () => {
    const project = createProject(db, 'Spec');
    const turn = createTurn(db, project.id, { phase: 'scope', question: '', answer: 'hello' });

    persistStructuredQuestion(db, turn.id, {
      question: 'What platform should we support first?',
      why: 'Platform determines initial architecture.',
      impact: 'high',
      options: [
        { content: 'Web', is_recommended: true },
        { content: 'Desktop', is_recommended: false },
      ],
    });

    const updatedTurn = getTurn(db, turn.id);
    const options = getOptionsForTurn(db, turn.id);

    expect(updatedTurn?.question).toBe('What platform should we support first?');
    expect(updatedTurn?.why).toBe('Platform determines initial architecture.');
    expect(updatedTurn?.impact).toBe('high');
    expect(options).toHaveLength(2);
    expect(options[0].content).toBe('Web');
    expect(options[0].is_recommended).toBe(true);
  });
});

describe('createProposePhaseClosureTool', () => {
  it('persists the server-known phase, not the LLM-provided input phase', async () => {
    const { createProposePhaseClosureTool } = await import('./interview.js');
    const { listPhaseOutcomesForProject } = await import('./db.js');

    const project = createProject(db, 'Spec');
    const turn = createTurn(db, project.id, { phase: 'design', question: '', answer: '' });

    const tool = createProposePhaseClosureTool(db, turn.id, 'design', project.id);
    expect(tool.execute).toBeDefined();
    await tool.execute!(
      { phase: 'scope', summary: 'LLM hallucinated wrong phase' },
      { toolCallId: 'tc-1', messages: [], abortSignal: new AbortController().signal },
    );

    const outcomes = listPhaseOutcomesForProject(db, project.id);
    expect(outcomes).toHaveLength(1);
    expect(outcomes[0].phase).toBe('design');
  });
});

describe('persistFallbackQuestionText', () => {
  it('fills the question only when the turn does not already have one', () => {
    const project = createProject(db, 'Spec');
    const turn = createTurn(db, project.id, { phase: 'scope', question: '', answer: 'hello' });

    persistFallbackQuestionText(db, turn.id, 'Fallback question');
    expect(getTurn(db, turn.id)?.question).toBe('Fallback question');

    persistFallbackQuestionText(db, turn.id, 'Replacement question');
    expect(getTurn(db, turn.id)?.question).toBe('Fallback question');
  });
});
