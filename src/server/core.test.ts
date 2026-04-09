import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { BrunchUIMessage, BrunchUserPart } from '../shared/chat.js';
import { extractPrompt, finalizeTurn, getProjectState, prepareTurn } from './core.js';
import {
  confirmPhaseOutcome,
  createDb,
  createPhaseOutcome,
  createProject,
  createTurn,
  getProject,
  getTurn,
  type DB,
} from './db.js';

let db: DB;

beforeEach(() => {
  db = createDb();
});

afterEach(() => {
  db.$client.close();
});

describe('extractPrompt', () => {
  it('extracts the last user text from UI messages', () => {
    const messages: BrunchUIMessage[] = [
      {
        id: 'm1',
        role: 'user',
        parts: [{ type: 'text', text: 'first' }],
      },
      {
        id: 'm2',
        role: 'assistant',
        parts: [{ type: 'text', text: 'ignored' }],
      },
      {
        id: 'm3',
        role: 'user',
        parts: [
          { type: 'text', text: 'hello' },
          { type: 'data-confirmation', data: { turnId: 7, confirmed: true } },
        ],
      },
    ];

    expect(extractPrompt(messages)).toBe('hello');
  });

  it('returns empty string for no messages', () => {
    expect(extractPrompt([])).toBe('');
  });
});

describe('prepareTurn', () => {
  it('persists a new turn with answer and user parts', () => {
    const project = createProject(db, 'Spec');
    const userParts: BrunchUserPart[] = [
      { type: 'text', text: 'Use SQLite' },
      { type: 'data-confirmation', data: { turnId: 1, confirmed: true } },
    ];

    const prepared = prepareTurn(db, project.id, 'Use SQLite', userParts);

    expect(prepared.project.id).toBe(project.id);
    expect(prepared.activePath).toEqual([]);

    const persistedTurn = getTurn(db, prepared.turn.id);
    expect(persistedTurn?.answer).toBe('Use SQLite');
    expect(JSON.parse(persistedTurn?.user_parts ?? '[]')).toEqual(userParts);
  });

  it('returns the prior active path for context building', () => {
    const project = createProject(db, 'Spec');
    const parent = createTurn(db, project.id, {
      phase: 'scope',
      question: 'What platform?',
      answer: 'Web',
    });
    finalizeTurn(db, project.id, parent.id);

    const prepared = prepareTurn(db, project.id, 'TypeScript', [{ type: 'text', text: 'TypeScript' }]);

    expect(prepared.activePath).toHaveLength(1);
    expect(prepared.activePath[0].id).toBe(parent.id);
  });

  it('selects design as the next turn phase after scope is confirmed closed', () => {
    const project = createProject(db, 'Spec');
    const scopeTurn = createTurn(db, project.id, {
      phase: 'scope',
      question: 'What platform?',
      answer: 'Web',
    });
    finalizeTurn(db, project.id, scopeTurn.id);

    const proposalTurn = createTurn(db, project.id, {
      phase: 'scope',
      parent_turn_id: scopeTurn.id,
      question: '',
      answer: 'We have enough scope context',
    });
    finalizeTurn(db, project.id, proposalTurn.id);

    const outcome = createPhaseOutcome(db, {
      projectId: project.id,
      phase: 'scope',
      proposal_turn_id: proposalTurn.id,
      summary: 'Goals, terms, context, and constraints are sufficiently captured.',
    });

    const confirmationTurn = createTurn(db, project.id, {
      phase: 'scope',
      parent_turn_id: proposalTurn.id,
      question: '',
      answer: 'Confirm scope closure',
    });
    confirmPhaseOutcome(db, outcome.id, confirmationTurn.id);
    finalizeTurn(db, project.id, confirmationTurn.id);

    const prepared = prepareTurn(db, project.id, 'Let us compare SQLite and Postgres', [
      { type: 'text', text: 'Let us compare SQLite and Postgres' },
    ]);

    expect(prepared.turn.phase).toBe('design');
  });
});

describe('finalizeTurn', () => {
  it('advances the project head to the completed turn', () => {
    const project = createProject(db, 'Spec');
    const turn = createTurn(db, project.id, {
      phase: 'scope',
      question: '',
      answer: 'hello',
    });

    finalizeTurn(db, project.id, turn.id);

    expect(getProject(db, project.id)?.active_turn_id).toBe(turn.id);
  });
});

describe('getProjectState', () => {
  it('returns project plus active path turns', () => {
    const project = createProject(db, 'Spec');
    const turn = createTurn(db, project.id, {
      phase: 'scope',
      question: 'What are we building?',
      answer: 'A chat app',
    });
    finalizeTurn(db, project.id, turn.id);

    const state = getProjectState(db, project.id);

    expect(state?.project.id).toBe(project.id);
    expect(state?.turns).toHaveLength(1);
    expect(state?.turns[0].question).toBe('What are we building?');
  });
});
