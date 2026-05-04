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
  createSpecification,
  createTurn,
  getActivePath,
  getSpecification,
  getTurn,
  linkKnowledgeItemToTurn,
  type DB,
} from './db.js';
import { createLegacyKickoffTurnForTesting } from './test-support/legacy-control-rows.js';

let db: DB;

beforeEach(async () => {
  db = await createDb();
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
  it('persists a new turn with answer and user parts', async () => {
    const project = await createSpecification(db, 'Spec');
    const userParts: BrunchUserPart[] = [
      { type: 'text', text: 'Use SQLite' },
      {
        type: 'data-confirmation',
        data: { kind: 'confirm-proposed-phase-closure', proposalTurnId: 1, phase: 'grounding' },
      },
    ];

    const prepared = await prepareTurn(db, project.id, 'Use SQLite', userParts);

    expect(prepared.specification.id).toBe(project.id);
    expect(prepared.activePath).toEqual([]);

    const persistedTurn = await getTurn(db, prepared.turn.id);
    expect(persistedTurn?.answer).toBe('Use SQLite');
    expect(JSON.parse(persistedTurn?.user_parts ?? '[]')).toEqual(userParts);
  });

  it('returns the prior active path for context building', async () => {
    const project = await createSpecification(db, 'Spec');
    const parent = await createTurn(db, project.id, {
      phase: 'grounding',
      question: 'What platform?',
      answer: 'Web',
    });
    await finalizeTurn(db, project.id, parent.id);

    const prepared = await prepareTurn(db, project.id, 'TypeScript', [{ type: 'text', text: 'TypeScript' }]);

    expect(prepared.activePath).toHaveLength(1);
    expect(prepared.activePath[0].id).toBe(parent.id);
  });

  it('selects design as the next turn phase after grounding is confirmed closed', async () => {
    const project = await createSpecification(db, 'Spec');
    const scopeTurn = await createTurn(db, project.id, {
      phase: 'grounding',
      question: 'What platform?',
      answer: 'Web',
    });
    await finalizeTurn(db, project.id, scopeTurn.id);

    const proposalTurn = await createTurn(db, project.id, {
      phase: 'grounding',
      parent_turn_id: scopeTurn.id,
      question: '',
      answer: 'We have enough grounding context',
    });
    await finalizeTurn(db, project.id, proposalTurn.id);

    const outcome = await createPhaseOutcome(db, {
      specificationId: project.id,
      phase: 'grounding',
      proposal_turn_id: proposalTurn.id,
      summary: 'Goals, terms, context, and constraints are sufficiently captured.',
    });

    const confirmationTurn = await createTurn(db, project.id, {
      phase: 'grounding',
      parent_turn_id: proposalTurn.id,
      question: '',
      answer: 'Confirm grounding closure',
    });
    await confirmPhaseOutcome(db, outcome.id, confirmationTurn.id);
    await finalizeTurn(db, project.id, confirmationTurn.id);

    const prepared = await prepareTurn(db, project.id, 'Let us compare SQLite and Postgres', [
      { type: 'text', text: 'Let us compare SQLite and Postgres' },
    ]);

    expect(prepared.turn.phase).toBe('design');
  });

  it('selects requirements as the next turn phase after design is confirmed closed', async () => {
    const project = await createSpecification(db, 'Spec');

    const scopeTurn = await createTurn(db, project.id, {
      phase: 'grounding',
      question: 'What platform?',
      answer: 'Web',
    });
    await finalizeTurn(db, project.id, scopeTurn.id);

    const scopeProposalTurn = await createTurn(db, project.id, {
      phase: 'grounding',
      parent_turn_id: scopeTurn.id,
      question: '',
      answer: 'We have enough grounding context',
    });
    await finalizeTurn(db, project.id, scopeProposalTurn.id);

    const scopeOutcome = await createPhaseOutcome(db, {
      specificationId: project.id,
      phase: 'grounding',
      proposal_turn_id: scopeProposalTurn.id,
      summary: 'Goals, terms, context, and constraints are sufficiently captured.',
    });

    const scopeConfirmationTurn = await createTurn(db, project.id, {
      phase: 'grounding',
      parent_turn_id: scopeProposalTurn.id,
      question: '',
      answer: 'Confirm grounding closure',
    });
    await confirmPhaseOutcome(db, scopeOutcome.id, scopeConfirmationTurn.id);
    await finalizeTurn(db, project.id, scopeConfirmationTurn.id);

    const designTurn = await createTurn(db, project.id, {
      phase: 'design',
      parent_turn_id: scopeConfirmationTurn.id,
      question: 'Which module boundary matters first?',
      answer: 'Persistence should stay behind one repository seam',
    });
    await finalizeTurn(db, project.id, designTurn.id);

    const designOutcome = await createPhaseOutcome(db, {
      specificationId: project.id,
      phase: 'design',
      proposal_turn_id: designTurn.id,
      summary: 'The main architectural commitments are captured well enough to review requirements.',
    });

    const designConfirmationTurn = await createTurn(db, project.id, {
      phase: 'design',
      parent_turn_id: designTurn.id,
      question: '',
      answer: 'Confirm elicitation closure',
    });
    await confirmPhaseOutcome(db, designOutcome.id, designConfirmationTurn.id);
    await finalizeTurn(db, project.id, designConfirmationTurn.id);

    const prepared = await prepareTurn(db, project.id, 'Let us review the must-have capabilities', [
      { type: 'text', text: 'Let us review the must-have capabilities' },
    ]);

    expect(prepared.turn.phase).toBe('requirements');
  });

  it('selects criteria as the next turn phase after requirements is confirmed closed', async () => {
    const project = await createSpecification(db, 'Spec');

    const scopeTurn = await createTurn(db, project.id, {
      phase: 'grounding',
      question: 'What platform?',
      answer: 'Web',
    });
    await finalizeTurn(db, project.id, scopeTurn.id);

    const scopeProposalTurn = await createTurn(db, project.id, {
      phase: 'grounding',
      parent_turn_id: scopeTurn.id,
      question: '',
      answer: 'We have enough grounding context',
    });
    await finalizeTurn(db, project.id, scopeProposalTurn.id);

    const scopeOutcome = await createPhaseOutcome(db, {
      specificationId: project.id,
      phase: 'grounding',
      proposal_turn_id: scopeProposalTurn.id,
      summary: 'Goals, terms, context, and constraints are sufficiently captured.',
    });

    const scopeConfirmationTurn = await createTurn(db, project.id, {
      phase: 'grounding',
      parent_turn_id: scopeProposalTurn.id,
      question: '',
      answer: 'Confirm grounding closure',
    });
    await confirmPhaseOutcome(db, scopeOutcome.id, scopeConfirmationTurn.id);
    await finalizeTurn(db, project.id, scopeConfirmationTurn.id);

    const designTurn = await createTurn(db, project.id, {
      phase: 'design',
      parent_turn_id: scopeConfirmationTurn.id,
      question: 'Which module boundary matters first?',
      answer: 'Persistence should stay behind one repository seam',
    });
    await finalizeTurn(db, project.id, designTurn.id);

    const designOutcome = await createPhaseOutcome(db, {
      specificationId: project.id,
      phase: 'design',
      proposal_turn_id: designTurn.id,
      summary: 'The main architectural commitments are captured well enough to review requirements.',
    });

    const designConfirmationTurn = await createTurn(db, project.id, {
      phase: 'design',
      parent_turn_id: designTurn.id,
      question: '',
      answer: 'Confirm elicitation closure',
    });
    await confirmPhaseOutcome(db, designOutcome.id, designConfirmationTurn.id);
    await finalizeTurn(db, project.id, designConfirmationTurn.id);

    const requirementsTurn = await createTurn(db, project.id, {
      phase: 'requirements',
      parent_turn_id: designConfirmationTurn.id,
      question: 'Are these requirements fully reviewed?',
      answer: 'Yes — the set is complete and reviewed.',
    });
    await finalizeTurn(db, project.id, requirementsTurn.id);

    const requirementsProposalTurn = await createTurn(db, project.id, {
      phase: 'requirements',
      parent_turn_id: requirementsTurn.id,
      question: '',
      answer: 'The requirement set has explicit review coverage and is ready to move into criteria.',
    });
    await finalizeTurn(db, project.id, requirementsProposalTurn.id);

    const requirementsOutcome = await createPhaseOutcome(db, {
      specificationId: project.id,
      phase: 'requirements',
      proposal_turn_id: requirementsProposalTurn.id,
      summary: 'The requirement set has explicit review coverage and is ready to move into criteria.',
    });

    const requirementsConfirmationTurn = await createTurn(db, project.id, {
      phase: 'requirements',
      parent_turn_id: requirementsProposalTurn.id,
      question: '',
      answer: 'Confirm requirements closure',
    });
    await confirmPhaseOutcome(db, requirementsOutcome.id, requirementsConfirmationTurn.id);
    await finalizeTurn(db, project.id, requirementsConfirmationTurn.id);

    const prepared = await prepareTurn(db, project.id, 'Let us define the first acceptance criterion', [
      { type: 'text', text: 'Let us define the first acceptance criterion' },
    ]);

    expect(prepared.turn.phase).toBe('criteria');
  });

  it('selects requirements as the next turn phase after design is force-closed by the user', async () => {
    const project = await createSpecification(db, 'Spec');

    const scopeTurn = await createTurn(db, project.id, {
      phase: 'grounding',
      question: 'What platform?',
      answer: 'Web',
    });
    await finalizeTurn(db, project.id, scopeTurn.id);

    const scopeProposalTurn = await createTurn(db, project.id, {
      phase: 'grounding',
      parent_turn_id: scopeTurn.id,
      question: '',
      answer: 'We have enough grounding context',
    });
    await finalizeTurn(db, project.id, scopeProposalTurn.id);

    const scopeOutcome = await createPhaseOutcome(db, {
      specificationId: project.id,
      phase: 'grounding',
      proposal_turn_id: scopeProposalTurn.id,
      summary: 'Goals, terms, context, and constraints are sufficiently captured.',
    });

    const scopeConfirmationTurn = await createTurn(db, project.id, {
      phase: 'grounding',
      parent_turn_id: scopeProposalTurn.id,
      question: '',
      answer: 'Confirm grounding closure',
    });
    await confirmPhaseOutcome(db, scopeOutcome.id, scopeConfirmationTurn.id);
    await finalizeTurn(db, project.id, scopeConfirmationTurn.id);

    const designTurn = await createTurn(db, project.id, {
      phase: 'design',
      parent_turn_id: scopeConfirmationTurn.id,
      question: 'Which module boundary matters first?',
      answer: 'Persistence should stay behind one repository seam',
    });
    await finalizeTurn(db, project.id, designTurn.id);

    const designForceCloseTurn = await createTurn(db, project.id, {
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

    const designOutcome = await createPhaseOutcome(db, {
      specificationId: project.id,
      phase: 'design',
      proposal_turn_id: designForceCloseTurn.id,
      summary: 'Elicitation closed by user without an interviewer recommendation.',
    });
    await confirmPhaseOutcome(db, designOutcome.id, designForceCloseTurn.id);
    await finalizeTurn(db, project.id, designForceCloseTurn.id);

    const prepared = await prepareTurn(db, project.id, 'Let us review the must-have capabilities', [
      { type: 'text', text: 'Let us review the must-have capabilities' },
    ]);

    expect(prepared.turn.phase).toBe('requirements');
  });
});

describe('finalizeTurn', () => {
  it('advances the project head to the completed turn', async () => {
    const project = await createSpecification(db, 'Spec');
    const turn = await createTurn(db, project.id, {
      phase: 'grounding',
      question: '',
      answer: 'hello',
    });

    await finalizeTurn(db, project.id, turn.id);

    expect((await getSpecification(db, project.id))?.active_turn_id).toBe(turn.id);
  });
});

describe('getSpecificationState', () => {
  it('keeps projection-only reads free of fabricated kickoff or recovery rows', async () => {
    const project = await createSpecification(db, 'Spec');

    const kickoffProjection = await readSpecificationStateProjection(db, project.id);

    expect(kickoffProjection?.landing).toEqual({ kind: 'kickoff', phase: 'grounding', mode: 'start' });
    expect(kickoffProjection?.turns).toEqual([]);
    expect(await getActivePath(db, project.id)).toEqual([]);

    const turn = await createTurn(db, project.id, {
      phase: 'grounding',
      question: 'What are we building?',
      answer: 'A chat app',
    });
    await finalizeTurn(db, project.id, turn.id);

    const recoveryProjection = await readSpecificationStateProjection(db, project.id);

    expect(recoveryProjection?.landing).toEqual({ kind: 'recovery', phase: 'grounding' });
    expect(recoveryProjection?.turns.filter((candidate) => candidate.turn_kind === 'question')).toHaveLength(
      1,
    );
    expect(recoveryProjection?.turns.some((candidate) => candidate.turn_kind === 'recovery')).toBe(false);
  });

  it('projects the first grounding landing as kickoff with grounding strategy choices once the runtime seeds entry state', async () => {
    const project = await createSpecification(db, 'Spec');
    await createLegacyKickoffTurnForTesting(db, project.id);

    const state = await getSpecificationState(db, project.id);

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

  it('returns specification plus active path turns and projects recovery when the frontier is missing', async () => {
    const project = await createSpecification(db, 'Spec');
    const turn = await createTurn(db, project.id, {
      phase: 'grounding',
      question: 'What are we building?',
      answer: 'A chat app',
    });
    const context = await createKnowledgeItem(db, project.id, 'context', 'The app starts from a fresh repo');
    const decision = await createKnowledgeItem(db, project.id, 'decision', 'Start with the web app');
    await linkKnowledgeItemToTurn(db, context.id, turn.id);
    await linkKnowledgeItemToTurn(db, decision.id, turn.id);
    await finalizeTurn(db, project.id, turn.id);

    const state = await getSpecificationState(db, project.id);

    expect(state ? getSpecificationRecord(state).id : null).toBe(project.id);
    expect(state?.landing).toEqual({ kind: 'recovery', phase: 'grounding' });
    expect(state?.turns.filter((candidate) => candidate.turn_kind === 'question')).toHaveLength(1);
    expect(state?.turns[0]?.specification_id ?? state?.turns[0]?.specification_id).toBe(project.id);
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
