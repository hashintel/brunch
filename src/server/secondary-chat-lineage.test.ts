import { describe, expect, it } from 'vitest';

import { createDb, createKnowledgeItem, createSpecification, createTurn, getSpecification } from './db.js';
import * as schema from './schema.js';
import { validateSecondaryChatInvokedTurn, validateSecondaryChatParent } from './secondary-chat-lineage.js';

describe('secondary-chat lineage validation', () => {
  it('accepts the specification primary chat as parent', () => {
    const db = createDb();
    const spec = createSpecification(db, 'Lineage ok');
    const specRow = getSpecification(db, spec.id)!;

    expect(validateSecondaryChatParent(db, specRow, specRow.primary_chat_id!)).toBeNull();
    db.$client.close();
  });

  it('rejects a parent chat id from another specification', () => {
    const db = createDb();
    const specA = createSpecification(db, 'Spec A');
    const specB = createSpecification(db, 'Spec B');
    const specRowA = getSpecification(db, specA.id)!;
    const otherPrimary = getSpecification(db, specB.id)!.primary_chat_id!;

    expect(validateSecondaryChatParent(db, specRowA, otherPrimary)).toEqual({
      status: 400,
      error: 'parentChatId must be this specification primary chat',
    });
    db.$client.close();
  });

  it('rejects a secondary chat id used as parent', () => {
    const db = createDb();
    const spec = createSpecification(db, 'Spec');
    const specRow = getSpecification(db, spec.id)!;
    const item = createKnowledgeItem(db, spec.id, 'goal', 'G');
    const parentTurn = createTurn(db, spec.id, { phase: 'grounding', question: 'Q' });

    const secondary = db
      .insert(schema.chat)
      .values({
        specification_id: spec.id,
        parent_chat_id: specRow.primary_chat_id,
        invoked_in_turn_id: parentTurn.id,
        pinned_item_id: item.id,
        kind: 'side_chat',
      })
      .returning()
      .get();

    expect(validateSecondaryChatParent(db, specRow, secondary.id)).toEqual({
      status: 400,
      error: 'parentChatId must be this specification primary chat',
    });
    db.$client.close();
  });

  it('accepts an invoked turn on the parent chat', () => {
    const db = createDb();
    const spec = createSpecification(db, 'Spec');
    const specRow = getSpecification(db, spec.id)!;
    const parentTurn = createTurn(db, spec.id, { phase: 'grounding', question: 'Q' });

    expect(validateSecondaryChatInvokedTurn(db, spec.id, specRow.primary_chat_id!, parentTurn.id)).toBeNull();
    db.$client.close();
  });

  it('rejects an invoked turn from another specification', () => {
    const db = createDb();
    const specA = createSpecification(db, 'Spec A');
    const specB = createSpecification(db, 'Spec B');
    const specRowA = getSpecification(db, specA.id)!;
    const foreignTurn = createTurn(db, specB.id, { phase: 'grounding', question: 'Q' });

    expect(validateSecondaryChatInvokedTurn(db, specA.id, specRowA.primary_chat_id!, foreignTurn.id)).toEqual(
      {
        status: 404,
        error: 'Invoked turn not found in specification',
      },
    );
    db.$client.close();
  });

  it('rejects an invoked turn that lives on a different chat', () => {
    const db = createDb();
    const spec = createSpecification(db, 'Spec');
    const specRow = getSpecification(db, spec.id)!;
    const parentTurn = createTurn(db, spec.id, { phase: 'grounding', question: 'Q' });
    const item = createKnowledgeItem(db, spec.id, 'goal', 'G');

    const secondaryChat = db
      .insert(schema.chat)
      .values({
        specification_id: spec.id,
        parent_chat_id: specRow.primary_chat_id,
        invoked_in_turn_id: parentTurn.id,
        pinned_item_id: item.id,
        kind: 'side_chat',
      })
      .returning()
      .get();

    const foreignTurn = db
      .insert(schema.turn)
      .values({
        specification_id: spec.id,
        chat_id: secondaryChat.id,
        phase: 'grounding',
        question: 'On secondary chat',
      })
      .returning()
      .get();

    expect(validateSecondaryChatInvokedTurn(db, spec.id, specRow.primary_chat_id!, foreignTurn.id)).toEqual({
      status: 400,
      error: 'invokedInTurnId must belong to the parent chat',
    });
    db.$client.close();
  });
});
