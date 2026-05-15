import { eq } from 'drizzle-orm';
import type { Request, Response } from 'express';
import * as z from 'zod/v4';

import { secondaryChatModeSchema, type MutationErrorResponse } from '@/shared/api-types.js';
import { knowledgeKinds } from '@/shared/knowledge.js';

import {
  createKickoffTurn,
  createSecondaryChat,
  getKnowledgeItem,
  getSpecification,
  setSecondaryChatMode,
  type DB,
} from './db.js';
import * as schema from './schema.js';

const secondaryChatRequestSchema = z.object({
  parentChatId: z.number().int().positive(),
  invokedInTurnId: z.number().int().positive(),
  itemKind: z.enum(knowledgeKinds),
  itemId: z.number().int().positive(),
  spanHint: z.string().min(1).optional(),
});

function badRequest(res: Response, error: string): void {
  res.status(400).json({ error } satisfies MutationErrorResponse);
}

function notFound(res: Response, error: string): void {
  res.status(404).json({ error } satisfies MutationErrorResponse);
}

function buildKickoffContent(itemContent: string, spanHint: string | undefined): string {
  const snippet = itemContent.length > 80 ? `${itemContent.slice(0, 77)}…` : itemContent;
  if (spanHint) {
    return `Anchored to '${snippet}', focused on '${spanHint}'.`;
  }
  return `Anchored to '${snippet}'.`;
}

export function handleCreateSecondaryChatRequest(db: DB, req: Request, res: Response): void {
  const specificationId = Number(req.params.id);
  if (Number.isNaN(specificationId)) {
    badRequest(res, 'Invalid specification ID');
    return;
  }

  const specification = getSpecification(db, specificationId);
  if (!specification) {
    notFound(res, 'Specification not found');
    return;
  }

  const parsed = secondaryChatRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    badRequest(res, 'Invalid secondary-chat payload');
    return;
  }

  const item = getKnowledgeItem(db, parsed.data.itemId);
  if (!item || item.specification_id !== specificationId || item.kind !== parsed.data.itemKind) {
    notFound(res, 'Item not found in specification');
    return;
  }

  const chat = createSecondaryChat(db, specificationId, {
    parent_chat_id: parsed.data.parentChatId,
    invoked_in_turn_id: parsed.data.invokedInTurnId,
    pinned_item_id: parsed.data.itemId,
    pinned_span_hint: parsed.data.spanHint ?? null,
  });

  const kickoffTurn = createKickoffTurn(db, chat.id, {
    phase: 'grounding',
    content: buildKickoffContent(item.content, parsed.data.spanHint),
  });

  res.json({ chatId: chat.id, kickoffTurnId: kickoffTurn.id });
}

const setSecondaryChatModeRequestSchema = z.object({
  mode: secondaryChatModeSchema,
});

export function handleSetSecondaryChatModeRequest(db: DB, req: Request, res: Response): void {
  const specificationId = Number(req.params.id);
  const chatId = Number(req.params.chatId);
  if (Number.isNaN(specificationId) || Number.isNaN(chatId)) {
    badRequest(res, 'Invalid specification or chat ID');
    return;
  }

  const parsed = setSecondaryChatModeRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    badRequest(res, 'Invalid mode payload');
    return;
  }

  const chatRow = db
    .select({
      id: schema.chat.id,
      specification_id: schema.chat.specification_id,
      parent_chat_id: schema.chat.parent_chat_id,
    })
    .from(schema.chat)
    .where(eq(schema.chat.id, chatId))
    .get();
  if (!chatRow || chatRow.specification_id !== specificationId || chatRow.parent_chat_id === null) {
    notFound(res, 'Secondary chat not found');
    return;
  }

  const updated = setSecondaryChatMode(db, chatId, parsed.data.mode);
  res.json({ chatId: updated.id, mode: updated.mode });
}
