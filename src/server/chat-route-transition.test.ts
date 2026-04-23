import { beforeEach, describe, expect, it } from 'vitest';

import type { BrunchUserPart } from '@/shared/chat.js';

import { prepareChatRouteTransition } from './chat-route-transition.js';
import {
  advanceHead,
  createDb,
  createPhaseOutcome,
  createSpecification,
  createTurn,
  getTurn,
  type DB,
} from './db.js';

describe('prepareChatRouteTransition', () => {
  let db: DB;

  beforeEach(() => {
    db = createDb();
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

    const result = prepareChatRouteTransition({
      db,
      specificationId: specification.id,
      promptText: 'Web',
      persistedUserParts: [{ type: 'text', text: 'Web' }],
    });

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

    const result = prepareChatRouteTransition({
      db,
      specificationId: specification.id,
      promptText: 'Feature within existing codebase',
      persistedUserParts: [
        { type: 'text', text: 'Feature within existing codebase' },
        {
          type: 'data-phase-intent',
          data: { kind: 'phase-entry', phase: 'grounding', mode: 'brownfield' },
        },
      ],
      phaseIntentRequest: { kind: 'phase-entry', phase: 'grounding', mode: 'brownfield' },
    });

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
      projectId: specification.id,
      phase: 'grounding',
      proposal_turn_id: proposalTurn.id,
      summary: 'Grounding is ready to close.',
    });

    const result = prepareChatRouteTransition({
      db,
      specificationId: specification.id,
      promptText: 'Confirm grounding closure',
      persistedUserParts: [
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
      confirmationTarget,
    });

    expect(result).toEqual({
      ok: true,
      kind: 'confirm-phase-closure',
      confirmationTargetId: confirmationTarget.id,
      confirmedClosureTurnId: proposalTurn.id,
    });
    expect(getTurn(db, proposalTurn.id)?.answer).toBe('Confirm grounding closure');
  });

  it('prepares a force-close turn in the requested phase', () => {
    const specification = createSpecification(db, 'Force close');

    const result = prepareChatRouteTransition({
      db,
      specificationId: specification.id,
      promptText: 'Force close the active phase',
      persistedUserParts: [
        { type: 'text', text: 'Force close the active phase' },
        {
          type: 'data-confirmation',
          data: { kind: 'force-close-active-phase', phase: 'design' },
        },
      ],
      forceClosePhase: 'design',
    });

    expect(result).toMatchObject({
      ok: true,
      kind: 'force-close',
    });
    if (!result.ok || result.kind !== 'force-close') {
      throw new Error('Expected force-close result');
    }
    expect(result.prepared.turn.phase).toBe('design');
    expect(result.prepared.turn.answer).toBe('Force close the active phase');
  });
});
