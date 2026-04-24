import { beforeEach, describe, expect, it } from 'vitest';

import { groundingStrategyKickoffQuestion, getGroundingStrategyTitle } from '@/shared/grounding-strategy.js';
import { getPersistedReviewAction } from '@/shared/specification-state.js';

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

    const response = submitTurnResponseTransition({
      db,
      specificationId: specification.id,
      turnId: turn.id,
      request: {
        kind: 'select-options',
        positions: selectedPositions,
        freeText: 'Covers both launch paths',
      },
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

    const response = submitTurnResponseTransition({
      db,
      specificationId: specification.id,
      turnId: turn.id,
      request: {
        kind: 'select-options',
        positions: selectedPositions,
      },
    });

    expect(response).toEqual({ ok: true });
    expect(getSpecification(db, specification.id)?.mode).toBe('brownfield');
    expect(getTurn(db, turn.id)?.answer).toBe(getGroundingStrategyTitle('brownfield'));
  });

  it('accepts a requirements review and advances to criteria', () => {
    const specification = createSpecification(db, 'Requirements review');
    const seededRequirements = seedRequirementsReviewReady(db, specification.id);

    const response = submitTurnResponseTransition({
      db,
      specificationId: specification.id,
      turnId: seededRequirements.reviewTurn.id,
      request: {
        kind: 'select-options',
        positions: [0],
        reviewAction: 'accept',
      },
    });

    expect(response).toEqual({ ok: true, advancedToPhase: 'criteria' });
    expect(getCurrentWorkflowState(db, specification.id).phases.requirements.status).toBe('closed');
    expect(getCurrentWorkflowState(db, specification.id).phases.criteria.status).toBe('in_progress');
  });

  it('accepts a criteria review and completes the workflow', () => {
    const specification = createSpecification(db, 'Criteria review');
    const seededCriteria = seedCriteriaReviewReady(db, specification.id);

    const response = submitTurnResponseTransition({
      db,
      specificationId: specification.id,
      turnId: seededCriteria.reviewTurn.id,
      request: {
        kind: 'select-options',
        positions: [0],
        reviewAction: 'accept',
      },
    });

    expect(response).toEqual({ ok: true, workflowCompleted: true });
    expect(getCurrentWorkflowState(db, specification.id).phases.criteria.status).toBe('closed');
  });

  it('rejects responses whose selected option positions do not exist', () => {
    const specification = createSpecification(db, 'Missing option position');
    const turn = createTurn(db, specification.id, {
      phase: 'grounding',
      question: 'Which platforms should we support first?',
      answer: '',
    });
    createOption(db, turn.id, { position: 0, content: 'Web', is_recommended: true });

    const response = submitTurnResponseTransition({
      db,
      specificationId: specification.id,
      turnId: turn.id,
      request: {
        kind: 'select-options',
        positions: [1],
      },
    });

    expect(response).toEqual({
      ok: false,
      kind: 'selected-option-not-found',
      message: 'Selected option not found',
    });
  });

  it('rejects review actions on non-review turns', () => {
    const specification = createSpecification(db, 'Unexpected review action');
    const turn = createTurn(db, specification.id, {
      phase: 'grounding',
      question: 'Which platforms should we support first?',
      answer: '',
    });
    createOption(db, turn.id, { position: 0, content: 'Web', is_recommended: true });

    const response = submitTurnResponseTransition({
      db,
      specificationId: specification.id,
      turnId: turn.id,
      request: {
        kind: 'select-options',
        positions: [0],
        reviewAction: 'accept',
      },
    });

    expect(response).toEqual({
      ok: false,
      kind: 'review-action-not-allowed',
      message: 'reviewAction is only valid for review turns',
    });
  });

  it('rejects review turns whose explicit reviewAction does not match the chosen option', () => {
    const specification = createSpecification(db, 'Mismatched review action');
    const seededRequirements = seedRequirementsReviewReady(db, specification.id);

    const response = submitTurnResponseTransition({
      db,
      specificationId: specification.id,
      turnId: seededRequirements.reviewTurn.id,
      request: {
        kind: 'select-options',
        positions: [0],
        reviewAction: 'request-changes',
      },
    });

    expect(response).toEqual({
      ok: false,
      kind: 'review-action-mismatch',
      message: 'Review turns must submit the explicit reviewAction for the selected option',
    });
  });

  it('persists request-changes review submissions without closing the phase', () => {
    const specification = createSpecification(db, 'Requirements request changes');
    const seededRequirements = seedRequirementsReviewReady(db, specification.id);

    const response = submitTurnResponseTransition({
      db,
      specificationId: specification.id,
      turnId: seededRequirements.reviewTurn.id,
      request: {
        kind: 'select-options',
        positions: [1],
        reviewAction: 'request-changes',
        freeText: 'Please clarify the scope boundary.',
      },
    });

    expect(response).toEqual({ ok: true });
    expect(getPersistedReviewAction(getTurn(db, seededRequirements.reviewTurn.id))).toBe('request-changes');
    expect(getCurrentWorkflowState(db, specification.id).phases.requirements.status).toBe('in_progress');
  });
});
