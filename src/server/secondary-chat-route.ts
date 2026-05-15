import { anthropic } from '@ai-sdk/anthropic';
import { streamText } from 'ai';
import { and, asc, eq } from 'drizzle-orm';
import type { Request, Response } from 'express';
import * as z from 'zod/v4';

import { secondaryChatModeSchema, type MutationErrorResponse } from '@/shared/api-types.js';
import { createKnowledgeReferenceCode, knowledgeKinds } from '@/shared/knowledge.js';

import {
  appendSecondaryChatTurn,
  createKickoffTurn,
  createSecondaryChat,
  getDownstreamItems,
  getKnowledgeItem,
  getSpecification,
  isItemInActiveReviewSet,
  setSecondaryChatMode,
  type DB,
} from './db.js';
import { classifyEditImpact, type EditImpactTier } from './edit-impact.js';
import {
  formatMentionedItemsContextBlock,
  parseIntentItemReferences,
  resolveIntentItemReferences,
} from './intent-item-resolver.js';
import * as schema from './schema.js';
import {
  buildSideChatPrompt,
  getSideChatTools,
  proposeDrillDownToolName,
  proposeEdgeToolName,
  proposeEditToolName,
  type SideChatMode,
  type SideChatPinnedItem,
  type SideChatPriorTurn,
} from './side-chat-prompt.js';

// Invariant: the secondary-chat surface only ever writes chats with
// `parent_chat_id IS NOT NULL`. The popover side-chat endpoint
// (`./side-chat-route.ts`) is stateless and never sets `parent_chat_id`,
// so popover sessions are not double-rendered as inline secondary chats.

const secondaryChatRequestSchema = z.object({
  parentChatId: z.number().int().positive(),
  invokedInTurnId: z.number().int().positive(),
  itemKind: z.enum(knowledgeKinds),
  itemId: z.number().int().positive(),
  spanHint: z.string().min(1).optional(),
  mode: secondaryChatModeSchema.optional(),
});

function badRequest(res: Response, error: string): void {
  res.status(400).json({ error } satisfies MutationErrorResponse);
}

function notFound(res: Response, error: string): void {
  res.status(404).json({ error } satisfies MutationErrorResponse);
}

function buildKickoffContent(itemContent: string, spanHint: string | undefined, mode: SideChatMode): string {
  const snippet = itemContent.length > 80 ? `${itemContent.slice(0, 77)}…` : itemContent;
  // Per UNIFIED_CHAT_UX.md §6: explore mode anchors, edit mode signals editing.
  // Span-hint suffix preserved across modes for the V1 minimal wording; the
  // richer "<N> related items may need updating" suffix is deferred.
  const verb = mode === 'edit' ? 'Editing' : 'Anchored to';
  if (spanHint) {
    return `${verb} '${snippet}', focused on '${spanHint}'.`;
  }
  return `${verb} '${snippet}'.`;
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

  const mode: SideChatMode = parsed.data.mode ?? 'explore';

  const chat = createSecondaryChat(db, specificationId, {
    parent_chat_id: parsed.data.parentChatId,
    invoked_in_turn_id: parsed.data.invokedInTurnId,
    pinned_item_id: parsed.data.itemId,
    pinned_span_hint: parsed.data.spanHint ?? null,
    mode,
  });

  const kickoffTurn = createKickoffTurn(db, chat.id, {
    phase: 'grounding',
    content: buildKickoffContent(item.content, parsed.data.spanHint, mode),
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

const secondaryChatMessageRequestSchema = z.object({
  message: z.string().trim().min(1),
});

interface TextDeltaPart {
  type: 'text-delta';
  text: string;
}

interface ToolCallPart {
  type: 'tool-call';
  toolCallId: string;
  toolName: string;
  input: unknown;
}

type SecondaryChatToolName =
  | typeof proposeEditToolName
  | typeof proposeEdgeToolName
  | typeof proposeDrillDownToolName;

type SecondaryChatSseChunk =
  | { type: 'text-delta'; delta: string }
  | {
      type: 'patch-proposal';
      toolCallId: string;
      toolName: SecondaryChatToolName;
      input: unknown;
      impact?: EditImpactTier;
    };

const SECONDARY_CHAT_TOOL_NAMES = new Set<string>([
  proposeEditToolName,
  proposeEdgeToolName,
  proposeDrillDownToolName,
]);

function secondaryChatStreamChunkFromPart(
  part: unknown,
  getEditImpact: () => EditImpactTier,
): SecondaryChatSseChunk | null {
  if (!part || typeof part !== 'object' || !('type' in part)) {
    return null;
  }
  const typed = part as { type: unknown };
  if (typed.type === 'text-delta') {
    const delta = (part as Partial<TextDeltaPart>).text;
    if (typeof delta !== 'string') {
      return null;
    }
    return { type: 'text-delta', delta };
  }
  if (typed.type === 'tool-call') {
    const call = part as Partial<ToolCallPart>;
    if (typeof call.toolName !== 'string' || !SECONDARY_CHAT_TOOL_NAMES.has(call.toolName)) {
      return null;
    }
    if (typeof call.toolCallId !== 'string') {
      return null;
    }
    const isEdit = call.toolName === proposeEditToolName;
    return {
      type: 'patch-proposal',
      toolCallId: call.toolCallId,
      toolName: call.toolName as SecondaryChatToolName,
      input: call.input ?? null,
      ...(isEdit ? { impact: getEditImpact() } : {}),
    };
  }
  return null;
}

function writeSecondaryChatStreamError(res: Response): void {
  res.write(
    `data: ${JSON.stringify({
      type: 'error',
      message: 'Secondary-chat stream failed before completion',
    })}\n\n`,
  );
}

function loadPriorTurns(db: DB, chatId: number): SideChatPriorTurn[] {
  // Replay round-trip turns ordered by id: each row carries either user_parts
  // or assistant_parts (never both). Kickoff turns live under turn_kind='kickoff'
  // and are excluded from history — they're rendered as the chat's anchor card,
  // not as a model-visible exchange.
  const rows = db
    .select({
      user_parts: schema.turn.user_parts,
      assistant_parts: schema.turn.assistant_parts,
    })
    .from(schema.turn)
    .where(and(eq(schema.turn.chat_id, chatId), eq(schema.turn.turn_kind, 'question')))
    .orderBy(asc(schema.turn.id))
    .all();

  const history: SideChatPriorTurn[] = [];
  for (const row of rows) {
    if (row.user_parts !== null) {
      history.push({ role: 'user', text: row.user_parts });
    } else if (row.assistant_parts !== null) {
      history.push({ role: 'assistant', text: row.assistant_parts });
    }
  }
  return history;
}

export async function handleSecondaryChatMessageRequest(db: DB, req: Request, res: Response): Promise<void> {
  const specificationId = Number(req.params.id);
  const chatId = Number(req.params.chatId);
  if (Number.isNaN(specificationId) || Number.isNaN(chatId)) {
    badRequest(res, 'Invalid specification or chat ID');
    return;
  }

  const specification = getSpecification(db, specificationId);
  if (!specification) {
    notFound(res, 'Specification not found');
    return;
  }

  const parsed = secondaryChatMessageRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    badRequest(res, 'Invalid secondary-chat message payload');
    return;
  }

  const chatRow = db
    .select({
      id: schema.chat.id,
      specification_id: schema.chat.specification_id,
      parent_chat_id: schema.chat.parent_chat_id,
      pinned_item_id: schema.chat.pinned_item_id,
      pinned_span_hint: schema.chat.pinned_span_hint,
      mode: schema.chat.mode,
    })
    .from(schema.chat)
    .where(eq(schema.chat.id, chatId))
    .get();
  if (!chatRow || chatRow.specification_id !== specificationId || chatRow.parent_chat_id === null) {
    notFound(res, 'Secondary chat not found');
    return;
  }
  if (chatRow.pinned_item_id === null) {
    // Secondary chats created via the C3c-route always set pinned_item_id; a
    // null here indicates a malformed substrate row that shouldn't reach this
    // path. Treat as not found rather than 500 to keep the boundary tight.
    notFound(res, 'Secondary chat is not pinned to an item');
    return;
  }

  const item = getKnowledgeItem(db, chatRow.pinned_item_id);
  if (!item || item.specification_id !== specificationId) {
    notFound(res, 'Pinned item not found in specification');
    return;
  }

  const mode: SideChatMode = chatRow.mode ?? 'explore';
  const pinnedItem: SideChatPinnedItem = {
    kind: item.kind,
    referenceCode: createKnowledgeReferenceCode(item.kind, item.kind_ordinal),
    content: item.content,
    rationale: item.rationale ?? null,
  };

  const history = loadPriorTurns(db, chatId);

  // FE-716 C6: resolve `#REF-CODE` mentions server-side and capture them as a
  // snapshot artifact on the user turn. Persisting the snapshot inline in
  // user_parts keeps replay/audit faithful without requiring a separate turn
  // artifact column (Track 5 / chat-context-provision will formalise the
  // snapshot lifecycle). Codes that don't resolve are silently dropped — the
  // user message itself still carries the literal `#R1` token.
  const parsedReferences = parseIntentItemReferences(parsed.data.message);
  const { matched } = resolveIntentItemReferences(db, specificationId, parsedReferences);
  const mentionedItemsContextBlock = formatMentionedItemsContextBlock(matched);
  const persistedUserContent = mentionedItemsContextBlock
    ? `${parsed.data.message}\n\n${mentionedItemsContextBlock}`
    : parsed.data.message;

  // Persist the user turn before streaming so a mid-stream disconnect still
  // leaves a recoverable transcript on the secondary chat.
  appendSecondaryChatTurn(db, chatId, { role: 'user', content: persistedUserContent });

  const { system: baseSystem, messages } = buildSideChatPrompt(
    pinnedItem,
    parsed.data.message,
    {
      specName: specification.name,
      groundingSummary: null,
    },
    history,
    {
      spanHint: chatRow.pinned_span_hint ?? undefined,
      mode,
    },
  );
  const system = mentionedItemsContextBlock ? `${baseSystem}\n\n${mentionedItemsContextBlock}` : baseSystem;

  const tools = getSideChatTools(mode);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const abortController = new AbortController();
  const onClientClose = (): void => {
    if (!res.writableEnded) {
      abortController.abort();
    }
  };
  res.on('close', onClientClose);

  const result = streamText({
    model: anthropic(process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514'),
    system,
    messages: messages.map((message) => ({ role: message.role, content: message.content })),
    tools,
    abortSignal: abortController.signal,
  });

  // Mirror side-chat-route's lazy edit-impact computation: only compute when the
  // model actually emits an edit proposal, then cache for the rest of the stream.
  const computeEditImpact = (): EditImpactTier => {
    const downstream = getDownstreamItems(db, specificationId, chatRow.pinned_item_id!);
    const inReviewSet =
      isItemInActiveReviewSet(db, specificationId, chatRow.pinned_item_id!) ||
      downstream.some((downstreamItem) => isItemInActiveReviewSet(db, specificationId, downstreamItem.id));
    return classifyEditImpact(downstream.length, inReviewSet);
  };
  let cachedEditImpact: EditImpactTier | null = null;

  let assistantText = '';

  try {
    for await (const part of result.fullStream) {
      if (abortController.signal.aborted) {
        break;
      }
      const sseChunk = secondaryChatStreamChunkFromPart(part, () => {
        if (cachedEditImpact === null) {
          cachedEditImpact = computeEditImpact();
        }
        return cachedEditImpact;
      });
      if (sseChunk) {
        if (sseChunk.type === 'text-delta') {
          assistantText += sseChunk.delta;
        }
        res.write(`data: ${JSON.stringify(sseChunk)}\n\n`);
      }
    }
    if (!abortController.signal.aborted) {
      // Persist the assistant turn after the stream completes; if the client
      // disconnected mid-stream we still capture the partial text for replay.
      if (assistantText.length > 0) {
        appendSecondaryChatTurn(db, chatId, { role: 'assistant', content: assistantText });
      }
      res.write('data: [DONE]\n\n');
    } else if (assistantText.length > 0) {
      appendSecondaryChatTurn(db, chatId, { role: 'assistant', content: assistantText });
    }
  } catch {
    if (assistantText.length > 0) {
      appendSecondaryChatTurn(db, chatId, { role: 'assistant', content: assistantText });
    }
    if (!abortController.signal.aborted && !res.writableEnded) {
      writeSecondaryChatStreamError(res);
    }
  } finally {
    res.off('close', onClientClose);
    if (!res.writableEnded) {
      res.end();
    }
  }
}
