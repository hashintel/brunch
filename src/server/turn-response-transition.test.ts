import { beforeEach, describe, expect, it } from 'vitest';

import { groundingStrategyKickoffQuestion, getGroundingStrategyTitle } from '@/shared/grounding-strategy.js';

import {
  createDb,
  createOption,
  createSpecification,
  createTurn,
  getCurrentWorkflowState,
  getOptionsForTurn,
  getSpecification,
  getTurn,
  type DB,
} from './db.js';
import { seedCriteriaReviewReady, seedRequirementsReviewReady } from './fixtures/scenarios.js';
import { submitTurnResponseTransition } from './turn-response-transition.js';

describe('submitTurnResponseTransition', () => {
  let db: DB;

  beforeEach(() => {
    db = createDb();
  });

  it('persists a normal structured turn response', () => {
    const specification = createSpecification(db, 'Structured turn response');
    const turn = createTurn(db, specification.id, {
      phase: 'grounding',
      question: 'Which platforms should we support first?',
      answer: '',
    });
    createOption(db, turn.id, { position: 0, content: 'Web', is_recommended: true });
    createOption(db, turn.id, { position: 1, content: 'Desktop', is_recommended: false });

    const selectedPositions = [0, 1];
    const selectedOptions = getOptionsForTurn(db, turn.id).filter((option) =>
      selectedPositions.includes(option.position),
    );

    const response = submitTurnResponseTransition({
      db,
      specificationId: specification.id,
      turn,
      turnId: turn.id,
      request: {
        kind: 'select-options',
        positions: selectedPositions,
        freeText: 'Covers both launch paths',
      },
      selectedOptions,
      selectedPositions,
    });

    expect(response).toEqual({ ok: true });
    expect(getTurn(db, turn.id)?.answer).toBe('Web, Desktop — Covers both launch paths');
    expect(getOptionsForTurn(db, turn.id).map((option) => option.is_selected)).toEqual([true, true]);
  });

  it('updates specification mode when the turn is the grounding strategy kickoff', () => {
    const specification = createSpecification(db, 'Grounding kickoff');
    const turn = createTurn(db, specification.id, {
      phase: 'grounding',
      turn_kind: 'kickoff',
      question: groundingStrategyKickoffQuestion,
      answer: '',
    });
    createOption(db, turn.id, { position: 0, content: 'New concept from scratch', is_recommended: true });
    createOption(db, turn.id, {
      position: 1,
      content: 'Feature within existing codebase',
      is_recommended: false,
    });

    const selectedPositions = [1];
    const selectedOptions = getOptionsForTurn(db, turn.id).filter((option) =>
      selectedPositions.includes(option.position),
    );

    const response = submitTurnResponseTransition({
      db,
      specificationId: specification.id,
      turn,
      turnId: turn.id,
      request: {
        kind: 'select-options',
        positions: selectedPositions,
      },
      selectedOptions,
      selectedPositions,
    });

    expect(response).toEqual({ ok: true });
    expect(getSpecification(db, specification.id)?.mode).toBe('brownfield');
    expect(getTurn(db, turn.id)?.answer).toBe(getGroundingStrategyTitle('brownfield'));
  });

  it('accepts a requirements review and advances to criteria', () => {
    const specification = createSpecification(db, 'Requirements review');
    const seededRequirements = seedRequirementsReviewReady(db, specification.id);
    const acceptOption = getOptionsForTurn(db, seededRequirements.reviewTurn.id).find(
      (option) => option.position === 0,
    );
    if (!acceptOption) {
      throw new Error('Expected requirements review accept option');
    }

    const response = submitTurnResponseTransition({
      db,
      specificationId: specification.id,
      turn: seededRequirements.reviewTurn,
      turnId: seededRequirements.reviewTurn.id,
      request: {
        kind: 'select-options',
        positions: [0],
        reviewAction: 'accept',
      },
      selectedOptions: [acceptOption],
      selectedPositions: [0],
    });

    expect(response).toEqual({ ok: true, advancedToPhase: 'criteria' });
    expect(getCurrentWorkflowState(db, specification.id).phases.requirements.status).toBe('closed');
    expect(getCurrentWorkflowState(db, specification.id).phases.criteria.status).toBe('in_progress');
  });

  it('accepts a criteria review and completes the workflow', () => {
    const specification = createSpecification(db, 'Criteria review');
    const seededCriteria = seedCriteriaReviewReady(db, specification.id);
    const acceptOption = getOptionsForTurn(db, seededCriteria.reviewTurn.id).find(
      (option) => option.position === 0,
    );
    if (!acceptOption) {
      throw new Error('Expected criteria review accept option');
    }

    const response = submitTurnResponseTransition({
      db,
      specificationId: specification.id,
      turn: seededCriteria.reviewTurn,
      turnId: seededCriteria.reviewTurn.id,
      request: {
        kind: 'select-options',
        positions: [0],
        reviewAction: 'accept',
      },
      selectedOptions: [acceptOption],
      selectedPositions: [0],
    });

    expect(response).toEqual({ ok: true, workflowCompleted: true });
    expect(getCurrentWorkflowState(db, specification.id).phases.criteria.status).toBe('closed');
  });
});
