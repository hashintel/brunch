import { beforeEach, describe, expect, it } from 'vitest';

import type { BrunchUserPart } from '@/shared/chat.js';

import { applyChatRouteTransition } from './chat-route-transition.js';
import {
  advanceHead,
  createDb,
  createConfirmedPhaseOutcome,
  createPhaseOutcome,
  createSpecification,
  createTurn,
  findPhaseOutcomeForTurn,
  getSpecification,
  getTurn,
  supersedePhaseOutcome,
  type DB,
} from './db.js';

describe('applyChatRouteTransition', () => {
  let db: DB;

  beforeEach(() => {
    db = createDb();
  });

  it('rejects missing specifications before command-specific lookup', () => {
    const result = applyChatRouteTransition(
      { db, specificationId: 1234 },
      {
        kind: 'confirm-phase-closure',
        phase: 'grounding',
        proposalTurnId: 99,
        reply: {
          text: 'Confirm grounding closure',
          parts: [{ type: 'text', text: 'Confirm grounding closure' }],
        },
      },
    );

    expect(result).toEqual({
      ok: false,
      kind: 'specification-not-found',
      message: 'Specification not found',
    });
  });

  it('prepares an interviewer successor from an already-answered structured turn', () => {
    const specification = createSpecification(db, 'Answered structured turn');
    const activeTurn = createTurn(db, specification.id, {
      phase: 'grounding',
      question: 'What platform should we support first?',
      answer: 'Web',
      user_parts: JSON.stringify([
        { type: 'text', text: 'Web' },
        {
          type: 'data-turn-response',
          data: { turnId: 1, selectedOptionIds: [11] },
        },
      ] satisfies BrunchUserPart[]),
    });
    advanceHead(db, specification.id, activeTurn.id);

    const result = applyChatRouteTransition(
      { db, specificationId: specification.id },
      { kind: 'continue', reply: { text: 'Web', parts: [{ type: 'text', text: 'Web' }] } },
    );

    expect(result).toMatchObject({
      ok: true,
      kind: 'interviewer-turn',
      observedTurnId: activeTurn.id,
      deferObserverCaptureToRuntime: true,
      skipObserverForCurrentChatTurn: false,
    });
    if (!result.ok || result.kind !== 'interviewer-turn') {
      throw new Error('Expected interviewer-turn result');
    }
    expect(result.prepared.turn.parent_turn_id).toBe(activeTurn.id);
    expect(result.prepared.turn.answer).toBeNull();
  });

  it('prepares a successor turn for a phase-intent entry path', () => {
    const specification = createSpecification(db, 'Phase intent entry');

    const result = applyChatRouteTransition(
      { db, specificationId: specification.id },
      { kind: 'phase-entry', request: { kind: 'phase-entry', phase: 'grounding', mode: 'brownfield' } },
    );

    expect(result).toMatchObject({
      ok: true,
      kind: 'interviewer-turn',
      observedTurnId: null,
      deferObserverCaptureToRuntime: false,
      skipObserverForCurrentChatTurn: false,
    });
    if (!result.ok || result.kind !== 'interviewer-turn') {
      throw new Error('Expected interviewer-turn result');
    }
    expect(result.prepared.turn.phase).toBe('grounding');
    expect(result.prepared.turn.parent_turn_id).toBeNull();
  });

  it('resolves a closure confirmation against the proposal turn before streaming', () => {
    const specification = createSpecification(db, 'Closure confirmation');
    const proposalTurn = createTurn(db, specification.id, {
      phase: 'grounding',
      question: '',
      answer: 'We have enough grounding context',
    });
    advanceHead(db, specification.id, proposalTurn.id);
    const confirmationTarget = createPhaseOutcome(db, {
      specificationId: specification.id,
      phase: 'grounding',
      proposal_turn_id: proposalTurn.id,
      summary: 'Grounding is ready to close.',
    });

    const result = applyChatRouteTransition(
      { db, specificationId: specification.id },
      {
        kind: 'confirm-phase-closure',
        phase: 'grounding',
        proposalTurnId: proposalTurn.id,
        reply: {
          text: 'Confirm grounding closure',
          parts: [
            { type: 'text', text: 'Confirm grounding closure' },
            {
              type: 'data-confirmation',
              data: {
                kind: 'confirm-proposed-phase-closure',
                proposalTurnId: proposalTurn.id,
                phase: 'grounding',
              },
            },
          ],
        },
      },
    );

    expect(result).toEqual({ ok: true, kind: 'phase-closure-confirmed' });
    expect(getTurn(db, proposalTurn.id)?.answer).toBe('Confirm grounding closure');
    expect(findPhaseOutcomeForTurn(db, specification.id, proposalTurn.id)).toMatchObject({
      id: confirmationTarget.id,
      status: 'confirmed',
      confirmation_turn_id: proposalTurn.id,
    });
  });

  it('prepares a force-close turn in the requested phase', () => {
    const specification = createSpecification(db, 'Force close');
    const groundingTurn = createTurn(db, specification.id, {
      phase: 'grounding',
      question: 'What are we building?',
      answer: 'A spec tool',
    });
    advanceHead(db, specification.id, groundingTurn.id);
    createConfirmedPhaseOutcome(db, {
      specificationId: specification.id,
      phase: 'grounding',
      proposal_turn_id: groundingTurn.id,
      confirmation_turn_id: groundingTurn.id,
      summary: 'Grounding is complete.',
    });
    const designTurn = createTurn(db, specification.id, {
      parent_turn_id: groundingTurn.id,
      phase: 'design',
      question: 'What is the primary flow?',
      answer: 'Interview-first',
    });
    advanceHead(db, specification.id, designTurn.id);

    const result = applyChatRouteTransition(
      { db, specificationId: specification.id },
      {
        kind: 'force-close-phase',
        phase: 'design',
        reply: {
          text: 'Force close the active phase',
          parts: [
            { type: 'text', text: 'Force close the active phase' },
            {
              type: 'data-confirmation',
              data: { kind: 'force-close-active-phase', phase: 'design' },
            },
          ],
        },
      },
    );

    expect(result).toEqual({
      ok: true,
      kind: 'phase-force-closed',
    });
    const forceCloseTurn = getTurn(db, getSpecification(db, specification.id)?.active_turn_id ?? -1);
    expect(forceCloseTurn).toMatchObject({
      phase: 'design',
      answer: 'Force close the active phase',
    });
    expect(findPhaseOutcomeForTurn(db, specification.id, forceCloseTurn?.id ?? -1)).toMatchObject({
      status: 'confirmed',
      closure_basis: 'user_forced',
    });
  });

  it('rejects force-close commands when the target phase is not closeable', () => {
    const specification = createSpecification(db, 'Rejected force close');

    const result = applyChatRouteTransition(
      { db, specificationId: specification.id },
      {
        kind: 'force-close-phase',
        phase: 'grounding',
        reply: {
          text: 'Force close the active phase',
          parts: [
            { type: 'text', text: 'Force close the active phase' },
            {
              type: 'data-confirmation',
              data: { kind: 'force-close-active-phase', phase: 'grounding' },
            },
          ],
        },
      },
    );

    expect(result).toEqual({
      ok: false,
      kind: 'force-close-not-allowed',
      message: 'Phase is not closeable yet',
    });
  });

  it('rejects unavailable phase-intent paths at the helper seam', () => {
    const specification = createSpecification(db, 'Unavailable phase intent');

    const result = applyChatRouteTransition(
      { db, specificationId: specification.id },
      { kind: 'phase-entry', request: { kind: 'phase-entry', phase: 'design' } },
    );

    expect(result).toEqual({
      ok: false,
      kind: 'phase-intent-not-available',
      message: 'Phase entry is not currently available',
    });
  });

  it('rejects superseded closure confirmations when the proposal is no longer pending', () => {
    const specification = createSpecification(db, 'Superseded closure confirmation');
    const proposalTurn = createTurn(db, specification.id, {
      phase: 'grounding',
      question: '',
      answer: 'We have enough grounding context',
    });
    const outcome = createPhaseOutcome(db, {
      specificationId: specification.id,
      phase: 'grounding',
      proposal_turn_id: proposalTurn.id,
      summary: 'Grounding is ready to close.',
    });
    supersedePhaseOutcome(db, outcome.id);

    const result = applyChatRouteTransition(
      { db, specificationId: specification.id },
      {
        kind: 'confirm-phase-closure',
        phase: 'grounding',
        proposalTurnId: proposalTurn.id,
        reply: {
          text: 'Confirm grounding closure',
          parts: [
            { type: 'text', text: 'Confirm grounding closure' },
            {
              type: 'data-confirmation',
              data: {
                kind: 'confirm-proposed-phase-closure',
                proposalTurnId: proposalTurn.id,
                phase: 'grounding',
              },
            },
          ],
        },
      },
    );

    expect(result).toEqual({
      ok: false,
      kind: 'phase-closure-proposal-not-found',
      message: 'Phase closure proposal not found',
    });
  });

  it('rejects closure confirmations whose payload phase does not match the proposal phase', () => {
    const specification = createSpecification(db, 'Mismatched closure confirmation');
    const proposalTurn = createTurn(db, specification.id, {
      phase: 'grounding',
      question: '',
      answer: 'We have enough grounding context',
    });
    createPhaseOutcome(db, {
      specificationId: specification.id,
      phase: 'grounding',
      proposal_turn_id: proposalTurn.id,
      summary: 'Grounding is ready to close.',
    });

    const result = applyChatRouteTransition(
      { db, specificationId: specification.id },
      {
        kind: 'confirm-phase-closure',
        phase: 'design',
        proposalTurnId: proposalTurn.id,
        reply: {
          text: 'Confirm design closure',
          parts: [
            { type: 'text', text: 'Confirm design closure' },
            {
              type: 'data-confirmation',
              data: {
                kind: 'confirm-proposed-phase-closure',
                proposalTurnId: proposalTurn.id,
                phase: 'design',
              },
            },
          ],
        },
      },
    );

    expect(result).toEqual({
      ok: false,
      kind: 'phase-closure-phase-mismatch',
      message: 'Phase closure confirmation phase mismatch',
    });
  });

  it('supersedes an active proposed outcome before preparing the successor turn', () => {
    const specification = createSpecification(db, 'Supersede active proposal');
    const activeTurn = createTurn(db, specification.id, {
      phase: 'grounding',
      question: 'What platform should we support first?',
      answer: 'Web',
      user_parts: JSON.stringify([
        { type: 'text', text: 'Web' },
        {
          type: 'data-turn-response',
          data: { turnId: 1, selectedOptionIds: [11] },
        },
      ] satisfies BrunchUserPart[]),
    });
    advanceHead(db, specification.id, activeTurn.id);
    createPhaseOutcome(db, {
      specificationId: specification.id,
      phase: 'grounding',
      proposal_turn_id: activeTurn.id,
      summary: 'Grounding is ready to close.',
    });

    const result = applyChatRouteTransition(
      { db, specificationId: specification.id },
      { kind: 'continue', reply: { text: 'Web', parts: [{ type: 'text', text: 'Web' }] } },
    );

    expect(result).toMatchObject({
      ok: true,
      kind: 'interviewer-turn',
      observedTurnId: activeTurn.id,
    });
    expect(findPhaseOutcomeForTurn(db, specification.id, activeTurn.id)?.status).toBe('superseded');
  });
});
