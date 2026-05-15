import type { Request, Response } from 'express';
import * as z from 'zod/v4';

import type { MutationErrorResponse } from '@/shared/api-types.js';
import { knowledgeKinds } from '@/shared/knowledge.js';

import { createKickoffTurn, createSecondaryChat, getKnowledgeItem, getSpecification, type DB } from './db.js';

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
