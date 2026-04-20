import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { BrunchUIMessage, BrunchUserPart } from '@/shared/chat.js';
import { createKnowledgeReferenceCode } from '@/shared/knowledge.js';
import { getSpecificationRecord } from '@/shared/specification.js';

import {
  extractPrompt,
  finalizeTurn,
  getSpecificationState,
  prepareTurn,
  readSpecificationStateProjection,
} from './core.js';
import {
  confirmPhaseOutcome,
  createDb,
  createKnowledgeItem,
  createPhaseOutcome,
  createProject,
  createTurn,
  getActivePath,
  getProject,
  getTurn,
  linkKnowledgeItemToTurn,
  type DB,
} from './db.js';
import { createLegacyKickoffTurnForTesting } from './test-support/legacy-control-rows.js';

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
          {
            type: 'data-confirmation',
            data: { kind: 'confirm-proposed-phase-closure', proposalTurnId: 7, phase: 'grounding' },
          },
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
      {
        type: 'data-confirmation',
        data: { kind: 'confirm-proposed-phase-closure', proposalTurnId: 1, phase: 'grounding' },
      },
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
      phase: 'grounding',
      question: 'What platform?',
      answer: 'Web',
    });
    finalizeTurn(db, project.id, parent.id);

    const prepared = prepareTurn(db, project.id, 'TypeScript', [{ type: 'text', text: 'TypeScript' }]);

    expect(prepared.activePath).toHaveLength(1);
    expect(prepared.activePath[0].id).toBe(parent.id);
  });

  it('selects design as the next turn phase after grounding is confirmed closed', () => {
    const project = createProject(db, 'Spec');
    const scopeTurn = createTurn(db, project.id, {
      phase: 'grounding',
      question: 'What platform?',
      answer: 'Web',
    });
    finalizeTurn(db, project.id, scopeTurn.id);

    const proposalTurn = createTurn(db, project.id, {
      phase: 'grounding',
      parent_turn_id: scopeTurn.id,
      question: '',
      answer: 'We have enough grounding context',
    });
    finalizeTurn(db, project.id, proposalTurn.id);

    const outcome = createPhaseOutcome(db, {
      projectId: project.id,
      phase: 'grounding',
      proposal_turn_id: proposalTurn.id,
      summary: 'Goals, terms, context, and constraints are sufficiently captured.',
    });

    const confirmationTurn = createTurn(db, project.id, {
      phase: 'grounding',
      parent_turn_id: proposalTurn.id,
      question: '',
      answer: 'Confirm grounding closure',
    });
    confirmPhaseOutcome(db, outcome.id, confirmationTurn.id);
    finalizeTurn(db, project.id, confirmationTurn.id);

    const prepared = prepareTurn(db, project.id, 'Let us compare SQLite and Postgres', [
      { type: 'text', text: 'Let us compare SQLite and Postgres' },
    ]);

    expect(prepared.turn.phase).toBe('design');
  });

  it('selects requirements as the next turn phase after design is confirmed closed', () => {
    const project = createProject(db, 'Spec');

    const scopeTurn = createTurn(db, project.id, {
      phase: 'grounding',
      question: 'What platform?',
      answer: 'Web',
    });
    finalizeTurn(db, project.id, scopeTurn.id);

    const scopeProposalTurn = createTurn(db, project.id, {
      phase: 'grounding',
      parent_turn_id: scopeTurn.id,
      question: '',
      answer: 'We have enough grounding context',
    });
    finalizeTurn(db, project.id, scopeProposalTurn.id);

    const scopeOutcome = createPhaseOutcome(db, {
      projectId: project.id,
      phase: 'grounding',
      proposal_turn_id: scopeProposalTurn.id,
      summary: 'Goals, terms, context, and constraints are sufficiently captured.',
    });

    const scopeConfirmationTurn = createTurn(db, project.id, {
      phase: 'grounding',
      parent_turn_id: scopeProposalTurn.id,
      question: '',
      answer: 'Confirm grounding closure',
    });
    confirmPhaseOutcome(db, scopeOutcome.id, scopeConfirmationTurn.id);
    finalizeTurn(db, project.id, scopeConfirmationTurn.id);

    const designTurn = createTurn(db, project.id, {
      phase: 'design',
      parent_turn_id: scopeConfirmationTurn.id,
      question: 'Which module boundary matters first?',
      answer: 'Persistence should stay behind one repository seam',
    });
    finalizeTurn(db, project.id, designTurn.id);

    const designOutcome = createPhaseOutcome(db, {
      projectId: project.id,
      phase: 'design',
      proposal_turn_id: designTurn.id,
      summary: 'The main architectural commitments are captured well enough to review requirements.',
    });

    const designConfirmationTurn = createTurn(db, project.id, {
      phase: 'design',
      parent_turn_id: designTurn.id,
      question: '',
      answer: 'Confirm elicitation closure',
    });
    confirmPhaseOutcome(db, designOutcome.id, designConfirmationTurn.id);
    finalizeTurn(db, project.id, designConfirmationTurn.id);

    const prepared = prepareTurn(db, project.id, 'Let us review the must-have capabilities', [
      { type: 'text', text: 'Let us review the must-have capabilities' },
    ]);

    expect(prepared.turn.phase).toBe('requirements');
  });

  it('selects criteria as the next turn phase after requirements is confirmed closed', () => {
    const project = createProject(db, 'Spec');

    const scopeTurn = createTurn(db, project.id, {
      phase: 'grounding',
      question: 'What platform?',
      answer: 'Web',
    });
    finalizeTurn(db, project.id, scopeTurn.id);

    const scopeProposalTurn = createTurn(db, project.id, {
      phase: 'grounding',
      parent_turn_id: scopeTurn.id,
      question: '',
      answer: 'We have enough grounding context',
    });
    finalizeTurn(db, project.id, scopeProposalTurn.id);

    const scopeOutcome = createPhaseOutcome(db, {
      projectId: project.id,
      phase: 'grounding',
      proposal_turn_id: scopeProposalTurn.id,
      summary: 'Goals, terms, context, and constraints are sufficiently captured.',
    });

    const scopeConfirmationTurn = createTurn(db, project.id, {
      phase: 'grounding',
      parent_turn_id: scopeProposalTurn.id,
      question: '',
      answer: 'Confirm grounding closure',
    });
    confirmPhaseOutcome(db, scopeOutcome.id, scopeConfirmationTurn.id);
    finalizeTurn(db, project.id, scopeConfirmationTurn.id);

    const designTurn = createTurn(db, project.id, {
      phase: 'design',
      parent_turn_id: scopeConfirmationTurn.id,
      question: 'Which module boundary matters first?',
      answer: 'Persistence should stay behind one repository seam',
    });
    finalizeTurn(db, project.id, designTurn.id);

    const designOutcome = createPhaseOutcome(db, {
      projectId: project.id,
      phase: 'design',
      proposal_turn_id: designTurn.id,
      summary: 'The main architectural commitments are captured well enough to review requirements.',
    });

    const designConfirmationTurn = createTurn(db, project.id, {
      phase: 'design',
      parent_turn_id: designTurn.id,
      question: '',
      answer: 'Confirm elicitation closure',
    });
    confirmPhaseOutcome(db, designOutcome.id, designConfirmationTurn.id);
    finalizeTurn(db, project.id, designConfirmationTurn.id);

    const requirementsTurn = createTurn(db, project.id, {
      phase: 'requirements',
      parent_turn_id: designConfirmationTurn.id,
      question: 'Are these requirements fully reviewed?',
      answer: 'Yes — the set is complete and reviewed.',
    });
    finalizeTurn(db, project.id, requirementsTurn.id);

    const requirementsProposalTurn = createTurn(db, project.id, {
      phase: 'requirements',
      parent_turn_id: requirementsTurn.id,
      question: '',
      answer: 'The requirement set has explicit review coverage and is ready to move into criteria.',
    });
    finalizeTurn(db, project.id, requirementsProposalTurn.id);

    const requirementsOutcome = createPhaseOutcome(db, {
      projectId: project.id,
      phase: 'requirements',
      proposal_turn_id: requirementsProposalTurn.id,
      summary: 'The requirement set has explicit review coverage and is ready to move into criteria.',
    });

    const requirementsConfirmationTurn = createTurn(db, project.id, {
      phase: 'requirements',
      parent_turn_id: requirementsProposalTurn.id,
      question: '',
      answer: 'Confirm requirements closure',
    });
    confirmPhaseOutcome(db, requirementsOutcome.id, requirementsConfirmationTurn.id);
    finalizeTurn(db, project.id, requirementsConfirmationTurn.id);

    const prepared = prepareTurn(db, project.id, 'Let us define the first acceptance criterion', [
      { type: 'text', text: 'Let us define the first acceptance criterion' },
    ]);

    expect(prepared.turn.phase).toBe('criteria');
  });

  it('selects requirements as the next turn phase after design is force-closed by the user', () => {
    const project = createProject(db, 'Spec');

    const scopeTurn = createTurn(db, project.id, {
      phase: 'grounding',
      question: 'What platform?',
      answer: 'Web',
    });
    finalizeTurn(db, project.id, scopeTurn.id);

    const scopeProposalTurn = createTurn(db, project.id, {
      phase: 'grounding',
      parent_turn_id: scopeTurn.id,
      question: '',
      answer: 'We have enough grounding context',
    });
    finalizeTurn(db, project.id, scopeProposalTurn.id);

    const scopeOutcome = createPhaseOutcome(db, {
      projectId: project.id,
      phase: 'grounding',
      proposal_turn_id: scopeProposalTurn.id,
      summary: 'Goals, terms, context, and constraints are sufficiently captured.',
    });

    const scopeConfirmationTurn = createTurn(db, project.id, {
      phase: 'grounding',
      parent_turn_id: scopeProposalTurn.id,
      question: '',
      answer: 'Confirm grounding closure',
    });
    confirmPhaseOutcome(db, scopeOutcome.id, scopeConfirmationTurn.id);
    finalizeTurn(db, project.id, scopeConfirmationTurn.id);

    const designTurn = createTurn(db, project.id, {
      phase: 'design',
      parent_turn_id: scopeConfirmationTurn.id,
      question: 'Which module boundary matters first?',
      answer: 'Persistence should stay behind one repository seam',
    });
    finalizeTurn(db, project.id, designTurn.id);

    const designForceCloseTurn = createTurn(db, project.id, {
      phase: 'design',
      parent_turn_id: designTurn.id,
      question: '',
      answer: 'Force elicitation closure',
      user_parts: JSON.stringify([
        { type: 'text', text: 'Force elicitation closure' },
        {
          type: 'data-confirmation',
          data: { kind: 'force-close-active-phase', phase: 'design' },
        },
      ]),
    });

    const designOutcome = createPhaseOutcome(db, {
      projectId: project.id,
      phase: 'design',
      proposal_turn_id: designForceCloseTurn.id,
      summary: 'Elicitation closed by user without an interviewer recommendation.',
    });
    confirmPhaseOutcome(db, designOutcome.id, designForceCloseTurn.id);
    finalizeTurn(db, project.id, designForceCloseTurn.id);

    const prepared = prepareTurn(db, project.id, 'Let us review the must-have capabilities', [
      { type: 'text', text: 'Let us review the must-have capabilities' },
    ]);

    expect(prepared.turn.phase).toBe('requirements');
  });
});

describe('finalizeTurn', () => {
  it('advances the project head to the completed turn', () => {
    const project = createProject(db, 'Spec');
    const turn = createTurn(db, project.id, {
      phase: 'grounding',
      question: '',
      answer: 'hello',
    });

    finalizeTurn(db, project.id, turn.id);

    expect(getProject(db, project.id)?.active_turn_id).toBe(turn.id);
  });
});

describe('getSpecificationState', () => {
  it('keeps projection-only reads free of fabricated kickoff or recovery rows', () => {
    const project = createProject(db, 'Spec');

    const kickoffProjection = readSpecificationStateProjection(db, project.id);

    expect(kickoffProjection?.landing).toEqual({ kind: 'kickoff', phase: 'grounding', mode: 'start' });
    expect(kickoffProjection?.turns).toEqual([]);
    expect(getActivePath(db, project.id)).toEqual([]);

    const turn = createTurn(db, project.id, {
      phase: 'grounding',
      question: 'What are we building?',
      answer: 'A chat app',
    });
    finalizeTurn(db, project.id, turn.id);

    const recoveryProjection = readSpecificationStateProjection(db, project.id);

    expect(recoveryProjection?.landing).toEqual({ kind: 'recovery', phase: 'grounding' });
    expect(recoveryProjection?.turns.filter((candidate) => candidate.turn_kind === 'question')).toHaveLength(
      1,
    );
    expect(recoveryProjection?.turns.some((candidate) => candidate.turn_kind === 'recovery')).toBe(false);
  });

  it('projects the first grounding landing as kickoff with grounding strategy choices once the runtime seeds entry state', () => {
    const project = createProject(db, 'Spec');
    createLegacyKickoffTurnForTesting(db, project.id);

    const state = getSpecificationState(db, project.id);

    expect(state?.landing).toEqual({ kind: 'kickoff', phase: 'grounding', mode: 'start' });
    expect(state?.turns).toHaveLength(1);
    expect(state?.turns[0]).toMatchObject({
      phase: 'grounding',
      question: 'How should this specification start?',
      why: 'Choose how to start grounding this specification.',
      answer: null,
      options: [
        {
          position: 0,
          content: 'New concept from scratch',
          is_recommended: true,
          is_selected: false,
        },
        {
          position: 1,
          content: 'Feature within existing codebase',
          is_recommended: false,
          is_selected: false,
        },
      ],
    });
  });

  it('returns specification plus active path turns and projects recovery when the frontier is missing', () => {
    const project = createProject(db, 'Spec');
    const turn = createTurn(db, project.id, {
      phase: 'grounding',
      question: 'What are we building?',
      answer: 'A chat app',
    });
    const context = createKnowledgeItem(db, project.id, 'context', 'The app starts from a fresh repo');
    const decision = createKnowledgeItem(db, project.id, 'decision', 'Start with the web app');
    linkKnowledgeItemToTurn(db, context.id, turn.id);
    linkKnowledgeItemToTurn(db, decision.id, turn.id);
    finalizeTurn(db, project.id, turn.id);

    const state = getSpecificationState(db, project.id);

    expect(state ? getSpecificationRecord(state).id : null).toBe(project.id);
    expect(state?.landing).toEqual({ kind: 'recovery', phase: 'grounding' });
    expect(state?.turns.filter((candidate) => candidate.turn_kind === 'question')).toHaveLength(1);
    expect(state?.turns[0]?.specification_id ?? state?.turns[0]?.project_id).toBe(project.id);
    expect(state?.turns[0].question).toBe('What are we building?');
    expect(state?.turns[0].turn_kind).toBe('question');
    expect(state?.turns[0].captured_items).toEqual([
      {
        collection: 'knowledge_item',
        kind: 'context',
        id: context.id,
        content: 'The app starts from a fresh repo',
        referenceCode: createKnowledgeReferenceCode('context', 1),
      },
      {
        collection: 'knowledge_item',
        kind: 'decision',
        id: decision.id,
        content: 'Start with the web app',
        referenceCode: createKnowledgeReferenceCode('decision', 1),
      },
    ]);
    expect(state?.turns.some((candidate) => candidate.turn_kind === 'recovery')).toBe(false);
  });
});
