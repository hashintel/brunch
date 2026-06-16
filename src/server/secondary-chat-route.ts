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
import { composerTextFromPersistedUserParts } from '@/shared/persisted-user-parts.js';

import {
  appendSecondaryChatTurn,
  createEmptySecondaryChat,
  createKickoffTurn,
  createSecondaryChat,
  deleteSecondaryChat,
  getKnowledgeItem,
  getOrCreateItemSecondaryChat,
  getOrCreateMasterSecondaryChat,
  getSpecification,
  setSecondaryChatMode,
  type DB,
} from './db.js';
import { buildKnowledgeItemEditImpactProjection } from './edit-impact-projection.js';
import { type EditImpactTier } from './edit-impact.js';
import {
  formatMentionedItemsContextBlock,
  parseIntentItemReferences,
  resolveIntentItemReferences,
} from './intent-item-resolver.js';
import * as schema from './schema.js';
import { validateSecondaryChatInvokedTurn, validateSecondaryChatParent } from './secondary-chat-lineage.js';
import {
  buildSideChatPrompt,
  getSideChatTools,
  proposeEditToolName,
  type SideChatMode,
  type SideChatPinnedItem,
  type SideChatPriorTurn,
} from './side-chat-prompt.js';

// Invariant: secondary chats hang off the spec's primary interview chat.

// `itemKind` + `itemId` are optional so the master-chat path (no anchor)
// can share this endpoint; handler enforces the pair for item-anchored flows.
const secondaryChatRequestSchema = z.object({
  parentChatId: z.number().int().positive(),
  invokedInTurnId: z.number().int().positive().optional(),
  itemKind: z.enum(knowledgeKinds).optional(),
  itemId: z.number().int().positive().optional(),
  spanHint: z.string().min(1).optional(),
  reconciliationNeedId: z.number().int().positive().optional(),
  mode: secondaryChatModeSchema.optional(),
  /** When true, skip master-chat dedupe and always mint a new empty chat. */
  fresh: z.boolean().optional(),
});

function badRequest(res: Response, error: string): void {
  res.status(400).json({ error } satisfies MutationErrorResponse);
}

function notFound(res: Response, error: string): void {
  res.status(404).json({ error } satisfies MutationErrorResponse);
}

// Friendly kickoff greeting for reconciliation-pinned chats. Mirrors the
// shape used by the item-anchored path in `specification-store.ts` so both
// kinds of secondary chat open with the same simple "Hi" + anchor-by-ref
// frame and immediately yield to the user's first turn.
function buildKickoffContent(refCode: string, mode: SideChatMode): string {
  if (mode === 'edit') {
    return `Hi! What would you like to change about **#${refCode}**?`;
  }
  return `Hi! How can I help with **#${refCode}**?`;
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

  const parentLineage = validateSecondaryChatParent(db, specification, parsed.data.parentChatId);
  if (parentLineage) {
    if (parentLineage.status === 404) {
      notFound(res, parentLineage.error);
    } else {
      badRequest(res, parentLineage.error);
    }
    return;
  }

  if (
    parsed.data.itemId === undefined &&
    parsed.data.itemKind === undefined &&
    parsed.data.reconciliationNeedId === undefined
  ) {
    const result =
      parsed.data.fresh === true
        ? createEmptySecondaryChat(db, specificationId, {
            parent_chat_id: parsed.data.parentChatId,
          })
        : getOrCreateMasterSecondaryChat(db, specificationId, {
            parent_chat_id: parsed.data.parentChatId,
          });
    res.json({ chatId: result.chat.id, kickoffTurnId: result.kickoffTurnId });
    return;
  }

  if (parsed.data.itemId === undefined || parsed.data.itemKind === undefined) {
    badRequest(res, 'itemKind and itemId are required for item-anchored secondary chats');
    return;
  }
  if (parsed.data.invokedInTurnId === undefined) {
    badRequest(res, 'invokedInTurnId is required for item-anchored secondary chats');
    return;
  }

  const invokedLineage = validateSecondaryChatInvokedTurn(
    db,
    specificationId,
    parsed.data.parentChatId,
    parsed.data.invokedInTurnId,
  );
  if (invokedLineage) {
    if (invokedLineage.status === 404) {
      notFound(res, invokedLineage.error);
    } else {
      badRequest(res, invokedLineage.error);
    }
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

  // Reconciliation entries get their own dedicated chats carrying the
  // `reconciliation_need` pin, separate from the per-item dedupe path below.
  if (parsed.data.reconciliationNeedId !== undefined) {
    const chat = createSecondaryChat(db, specificationId, {
      parent_chat_id: parsed.data.parentChatId,
      invoked_in_turn_id: parsed.data.invokedInTurnId,
      pinned_item_id: parsed.data.itemId,
      pinned_span_hint: parsed.data.spanHint ?? null,
      pinned_reconciliation_need_id: parsed.data.reconciliationNeedId,
      mode,
    });
    const refCode = createKnowledgeReferenceCode(item.kind, item.kind_ordinal);
    const kickoffTurn = createKickoffTurn(db, chat.id, {
      phase: 'grounding',
      content: buildKickoffContent(refCode, mode),
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

export function handleDeleteSecondaryChatRequest(db: DB, req: Request, res: Response): void {
  const specificationId = Number(req.params.id);
  const chatId = Number(req.params.chatId);
  if (Number.isNaN(specificationId) || Number.isNaN(chatId)) {
    badRequest(res, 'Invalid specification or chat ID');
    return;
  }
  const deleted = deleteSecondaryChat(db, specificationId, chatId);
  if (!deleted) {
    notFound(res, 'Secondary chat not found');
    return;
  }
  res.json({ chatId, deleted: true });
}

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
      history.push({ role: 'user', text: composerTextFromPersistedUserParts(row.user_parts) });
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

  // Master chats have `pinned_item_id IS NULL`; only item-anchored chats must resolve a pin.
  const pinnedItemId = chatRow.pinned_item_id;
  const item = pinnedItemId !== null ? getKnowledgeItem(db, pinnedItemId) : null;
  if (pinnedItemId !== null && (!item || item.specification_id !== specificationId)) {
    notFound(res, 'Pinned item not found in specification');
    return;
  }

  // The client sends the full UIMessage conversation prefix, but only the
  // latest user turn is needed: history is reloaded server-side from the
  // chat's persisted turns to keep the source of truth on the server.
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
  const isMasterChat = pinnedItemId === null;

  const history = loadPriorTurns(db, chatId);

  // Persist the resolved-mentions snapshot inline in user_parts so replay
  // stays faithful without a separate turn-artifact column. Codes that fail
  // to resolve are silently dropped; the literal `#R1` token stays in the
  // user message.
  const parsedReferences = parseIntentItemReferences(userText);
  const { matched } = resolveIntentItemReferences(db, specificationId, parsedReferences);
  const mentionedItemsContextBlock = formatMentionedItemsContextBlock(matched);
  const persistedUserContent = mentionedItemsContextBlock
    ? `${userText}\n\n${mentionedItemsContextBlock}`
    : userText;

  // Persist the user turn before streaming so a mid-stream disconnect still
  // leaves a recoverable transcript on the secondary chat.
  appendSecondaryChatTurn(db, chatId, { role: 'user', content: persistedUserContent });

  let baseSystem: string;
  let messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  let tools: ReturnType<typeof getSideChatTools>;

  if (isMasterChat) {
    baseSystem = [
      `You are a helper for the brunch specification "${specification.name}".`,
      'The user is having an open-ended conversation about the spec as a whole.',
      "No single knowledge item is pinned — answer the user's question by drawing on what you know about the spec and the items they mention. If you do not have enough context to answer well, say so and ask a clarifying question.",
    ].join('\n\n');
    const turns: Array<{ role: 'user' | 'assistant'; text: string }> =
      history.at(-1)?.role === 'user' ? history.slice(0, -1) : [...history];
    turns.push({ role: 'user', text: userText });
    messages = turns.map((turn) => ({ role: turn.role, content: turn.text }));
    tools = {};
  } else {
    if (!item) {
      notFound(res, 'Pinned item not found in specification');
      return;
    }
    const pinnedItem: SideChatPinnedItem = {
      kind: item.kind,
      referenceCode: createKnowledgeReferenceCode(item.kind, item.kind_ordinal),
      content: item.content,
      rationale: item.rationale ?? null,
    };
    const prompt = buildSideChatPrompt(
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
    baseSystem = prompt.system;
    messages = prompt.messages;
    tools = getSideChatTools(mode);
  }

  const system = mentionedItemsContextBlock ? `${baseSystem}\n\n${mentionedItemsContextBlock}` : baseSystem;

  // Lazy edit-impact computation: only compute when
  // we know an edit proposal actually surfaced, then reuse for all of them.
  const computeEditImpact = (): EditImpactTier => {
    if (pinnedItemId === null) {
      throw new Error('computeEditImpact called for a master chat — no pinned item');
    }
    return buildKnowledgeItemEditImpactProjection(db, specificationId, pinnedItemId).impact;
  };
  let cachedEditImpact: EditImpactTier | null = null;

  const stream = createUIMessageStream<BrunchUIMessage>({
    async execute({ writer }) {
      const result = streamText({
        model: anthropic(process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6'),
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
