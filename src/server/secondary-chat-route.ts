import { anthropic } from '@ai-sdk/anthropic';
import { createUIMessageStream, pipeUIMessageStreamToResponse, streamText, validateUIMessages } from 'ai';
import { and, asc, eq } from 'drizzle-orm';
import type { Request, Response } from 'express';
import * as z from 'zod/v4';

import { secondaryChatModeSchema, type MutationErrorResponse } from '@/shared/api-types.js';
import {
  brunchDataPartSchemas,
  brunchValidationTools,
  extractTextFromMessage,
  type BrunchUIMessage,
} from '@/shared/chat.js';
import { createKnowledgeReferenceCode, knowledgeKinds } from '@/shared/knowledge.js';

import {
  appendSecondaryChatTurn,
  createKickoffTurn,
  createSecondaryChat,
  getDownstreamItems,
  getKnowledgeItem,
  getOrCreateItemSecondaryChat,
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
  // FE-716 C9: optional anchor to a substantive `reconciliation_need` row.
  // When set, the bundle hydration joins the row so the inline collapsible can
  // render the "elements being reconciled" panel.
  reconciliationNeedId: z.number().int().positive().optional(),
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

  if (parsed.data.reconciliationNeedId !== undefined) {
    const need = db
      .select({
        id: schema.reconciliationNeed.id,
        specification_id: schema.reconciliationNeed.specification_id,
      })
      .from(schema.reconciliationNeed)
      .where(eq(schema.reconciliationNeed.id, parsed.data.reconciliationNeedId))
      .get();
    if (!need || need.specification_id !== specificationId) {
      notFound(res, 'Reconciliation need not found in specification');
      return;
    }
  }

  const mode: SideChatMode = parsed.data.mode ?? 'explore';

  // Reconciliation entries (FE-716 C9) create their own dedicated chats —
  // they carry the `reconciliation_need` pin used by the C9 panel.
  if (parsed.data.reconciliationNeedId !== undefined) {
    const chat = createSecondaryChat(db, specificationId, {
      parent_chat_id: parsed.data.parentChatId,
      invoked_in_turn_id: parsed.data.invokedInTurnId,
      pinned_item_id: parsed.data.itemId,
      pinned_span_hint: parsed.data.spanHint ?? null,
      pinned_reconciliation_need_id: parsed.data.reconciliationNeedId,
      mode,
    });
    const kickoffTurn = createKickoffTurn(db, chat.id, {
      phase: 'grounding',
      content: buildKickoffContent(item.content, parsed.data.spanHint, mode),
    });
    res.json({ chatId: chat.id, kickoffTurnId: kickoffTurn.id });
    return;
  }

  // Item action-rail entries get one chat per (parent, item) pair — clicking
  // the same item twice re-opens the existing chat rather than duplicating.
  const result = getOrCreateItemSecondaryChat(db, specificationId, {
    parent_chat_id: parsed.data.parentChatId,
    invokedInTurnId: parsed.data.invokedInTurnId,
    itemId: parsed.data.itemId,
    itemKind: parsed.data.itemKind,
    spanHint: parsed.data.spanHint ?? null,
    mode,
  });
  res.json({ chatId: result.chat.id, kickoffTurnId: result.kickoffTurnId });
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

  const pinnedItemId = chatRow.pinned_item_id;

  const item = getKnowledgeItem(db, pinnedItemId);
  if (!item || item.specification_id !== specificationId) {
    notFound(res, 'Pinned item not found in specification');
    return;
  }

  // FE-716 C24b: validate the inbound UIMessage envelope. The client sends
  // the full conversation prefix per `useChat<BrunchUIMessage>` convention;
  // we only need the latest user turn for the prompt + persistence — history
  // is reloaded server-side from the secondary chat's persisted turns.
  let validatedMessages: BrunchUIMessage[];
  try {
    validatedMessages = await validateUIMessages<BrunchUIMessage>({
      messages: (req.body as { messages?: unknown }).messages ?? [],
      dataSchemas: brunchDataPartSchemas,
      tools: brunchValidationTools,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid secondary-chat message payload';
    badRequest(res, message);
    return;
  }

  const lastMessage = validatedMessages.at(-1);
  if (!lastMessage || lastMessage.role !== 'user') {
    badRequest(res, 'Last message must be from user');
    return;
  }
  const userText = extractTextFromMessage(lastMessage).trim();
  if (userText.length === 0) {
    badRequest(res, 'message content is required');
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
  // artifact column. Codes that don't resolve are silently dropped — the user
  // message itself still carries the literal `#R1` token.
  const parsedReferences = parseIntentItemReferences(userText);
  const { matched } = resolveIntentItemReferences(db, specificationId, parsedReferences);
  const mentionedItemsContextBlock = formatMentionedItemsContextBlock(matched);
  const persistedUserContent = mentionedItemsContextBlock
    ? `${userText}\n\n${mentionedItemsContextBlock}`
    : userText;

  // Persist the user turn before streaming so a mid-stream disconnect still
  // leaves a recoverable transcript on the secondary chat.
  appendSecondaryChatTurn(db, chatId, { role: 'user', content: persistedUserContent });

  const { system: baseSystem, messages } = buildSideChatPrompt(
    pinnedItem,
    userText,
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

  // Mirror side-chat-route's lazy edit-impact computation: only compute when
  // we know an edit proposal actually surfaced, then reuse for all of them.
  const computeEditImpact = (): EditImpactTier => {
    const downstream = getDownstreamItems(db, specificationId, pinnedItemId);
    const inReviewSet =
      isItemInActiveReviewSet(db, specificationId, pinnedItemId) ||
      downstream.some((downstreamItem) => isItemInActiveReviewSet(db, specificationId, downstreamItem.id));
    return classifyEditImpact(downstream.length, inReviewSet);
  };
  let cachedEditImpact: EditImpactTier | null = null;

  const stream = createUIMessageStream<BrunchUIMessage>({
    async execute({ writer }) {
      const result = streamText({
        model: anthropic(process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514'),
        system,
        messages: messages.map((message) => ({ role: message.role, content: message.content })),
        tools,
      });

      writer.merge(
        result.toUIMessageStream<BrunchUIMessage>({
          sendReasoning: false,
          sendFinish: false,
        }),
      );

      // Wait for the stream to finalize before joining tool-call IDs back to
      // edit-impact tiers. By this point every `tool-propose_*` UIMessage part
      // has already been written to the merged writer; data-edit-impact
      // arrives as a sibling part keyed by `toolCallId` so the client can
      // attach the tier to the corresponding staged patch.
      const finishReason = await result.finishReason;
      const toolCalls = await result.toolCalls;
      for (const toolCall of toolCalls) {
        if (!toolCall || toolCall.toolName !== proposeEditToolName) continue;
        if (cachedEditImpact === null) {
          cachedEditImpact = computeEditImpact();
        }
        writer.write({
          type: 'data-edit-impact',
          data: { toolCallId: toolCall.toolCallId, tier: cachedEditImpact },
        });
      }
      writer.write({ type: 'finish', finishReason });
    },
    async onFinish({ responseMessage }) {
      const assistantText = extractTextFromMessage(responseMessage);
      if (assistantText.length > 0) {
        appendSecondaryChatTurn(db, chatId, { role: 'assistant', content: assistantText });
      }
    },
  });

  pipeUIMessageStreamToResponse({ response: res, stream });
}
