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

  beforeEach(async () => {
    db = await createDb();
  });

  it('persists a normal structured turn response', async () => {
    const specification = await createSpecification(db, 'Structured turn response');
    const turn = await createTurn(db, specification.id, {
      phase: 'grounding',
      question: 'Which platforms should we support first?',
      answer: '',
    });
    await createOption(db, turn.id, { position: 0, content: 'Web', is_recommended: true });
    await createOption(db, turn.id, { position: 1, content: 'Desktop', is_recommended: false });

    const selectedPositions = [0, 1];

    const response = await submitTurnResponseTransition({
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
    expect((await getTurn(db, turn.id))?.answer).toBe('Web, Desktop — Covers both launch paths');
    expect((await getOptionsForTurn(db, turn.id)).map((option) => option.is_selected)).toEqual([true, true]);
  });

  it('updates specification mode when the turn is the grounding strategy kickoff', async () => {
    const specification = await createSpecification(db, 'Grounding kickoff');
    const turn = await createTurn(db, specification.id, {
      phase: 'grounding',
      turn_kind: 'kickoff',
      question: groundingStrategyKickoffQuestion,
      answer: '',
    });
    await createOption(db, turn.id, {
      position: 0,
      content: 'New concept from scratch',
      is_recommended: true,
    });
    await createOption(db, turn.id, {
      position: 1,
      content: 'Feature within existing codebase',
      is_recommended: false,
    });

    const selectedPositions = [1];

    const response = await submitTurnResponseTransition({
      db,
      specificationId: specification.id,
      turnId: turn.id,
      request: {
        kind: 'select-options',
        positions: selectedPositions,
      },
    });

    expect(response).toEqual({ ok: true });
    expect((await getSpecification(db, specification.id))?.mode).toBe('brownfield');
    expect((await getTurn(db, turn.id))?.answer).toBe(getGroundingStrategyTitle('brownfield'));
  });

  it('accepts a requirements review and advances to criteria', async () => {
    const specification = await createSpecification(db, 'Requirements review');
    const seededRequirements = await seedRequirementsReviewReady(db, specification.id);

    const response = await submitTurnResponseTransition({
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
    expect((await getCurrentWorkflowState(db, specification.id)).phases.requirements.status).toBe('closed');
    expect((await getCurrentWorkflowState(db, specification.id)).phases.criteria.status).toBe('in_progress');
  });

  it('accepts a criteria review and completes the workflow', async () => {
    const specification = await createSpecification(db, 'Criteria review');
    const seededCriteria = await seedCriteriaReviewReady(db, specification.id);

    const response = await submitTurnResponseTransition({
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
    expect((await getCurrentWorkflowState(db, specification.id)).phases.criteria.status).toBe('closed');
  });

  it('rejects responses whose selected option positions do not exist', async () => {
    const specification = await createSpecification(db, 'Missing option position');
    const turn = await createTurn(db, specification.id, {
      phase: 'grounding',
      question: 'Which platforms should we support first?',
      answer: '',
    });
    await createOption(db, turn.id, { position: 0, content: 'Web', is_recommended: true });

    const response = await submitTurnResponseTransition({
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

  it('rejects review actions on non-review turns', async () => {
    const specification = await createSpecification(db, 'Unexpected review action');
    const turn = await createTurn(db, specification.id, {
      phase: 'grounding',
      question: 'Which platforms should we support first?',
      answer: '',
    });
    await createOption(db, turn.id, { position: 0, content: 'Web', is_recommended: true });

    const response = await submitTurnResponseTransition({
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

  it('rejects review turns whose explicit reviewAction does not match the chosen option', async () => {
    const specification = await createSpecification(db, 'Mismatched review action');
    const seededRequirements = await seedRequirementsReviewReady(db, specification.id);

    const response = await submitTurnResponseTransition({
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

  it('persists request-changes review submissions without closing the phase', async () => {
    const specification = await createSpecification(db, 'Requirements request changes');
    const seededRequirements = await seedRequirementsReviewReady(db, specification.id);

    const response = await submitTurnResponseTransition({
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
    expect(getPersistedReviewAction(await getTurn(db, seededRequirements.reviewTurn.id))).toBe(
      'request-changes',
    );
    expect((await getCurrentWorkflowState(db, specification.id)).phases.requirements.status).toBe(
      'in_progress',
    );
  });
});
