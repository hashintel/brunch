import { eq } from 'drizzle-orm';

import type { DB } from './db.js';
import { getTurn, type Specification } from './db.js';
import * as schema from './schema.js';

export type SecondaryChatLineageFailure = {
  readonly status: 400 | 404;
  readonly error: string;
};

export function validateSecondaryChatParent(
  db: DB,
  specification: Specification,
  parentChatId: number,
): SecondaryChatLineageFailure | null {
  const primaryChatId = specification.primary_chat_id;
  if (primaryChatId === null) {
    return { status: 404, error: 'Specification has no primary chat' };
  }
  if (parentChatId !== primaryChatId) {
    return { status: 400, error: 'parentChatId must be this specification primary chat' };
  }

  const parentChat = db
    .select({
      id: schema.chat.id,
      specification_id: schema.chat.specification_id,
      parent_chat_id: schema.chat.parent_chat_id,
    })
    .from(schema.chat)
    .where(eq(schema.chat.id, parentChatId))
    .get();

  if (!parentChat || parentChat.specification_id !== specification.id) {
    return { status: 404, error: 'Parent chat not found in specification' };
  }
  if (parentChat.parent_chat_id !== null) {
    return { status: 400, error: 'parentChatId must be the primary interview chat' };
  }

  return null;
}

export function validateSecondaryChatInvokedTurn(
  db: DB,
  specificationId: number,
  parentChatId: number,
  invokedInTurnId: number,
): SecondaryChatLineageFailure | null {
  const turn = getTurn(db, invokedInTurnId);
  if (!turn || turn.specification_id !== specificationId) {
    return { status: 404, error: 'Invoked turn not found in specification' };
  }
  if (turn.chat_id !== parentChatId) {
    return { status: 400, error: 'invokedInTurnId must belong to the parent chat' };
  }
  return null;
}
