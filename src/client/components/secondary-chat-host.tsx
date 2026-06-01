import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { z } from 'zod/v4';

import {
  useInvalidateSpecificationQueryDomains,
  useSpecificationEntities,
} from '@/client/routes/specification/$id/-specification-data.js';
import type { EntitiesData, secondaryChatStateSchema } from '@/shared/api-types.js';
import { brunchDataPartSchemas, type BrunchUIMessage, type EditImpactTier } from '@/shared/chat.js';
import type { KnowledgeKind } from '@/shared/knowledge.js';
import { persistedUserPartsShowsComposerText } from '@/shared/persisted-user-parts.js';

import { usePatchListForChat, type PatchListForChat } from './patch-list-host.js';
import { SecondaryChatCollapsible, SecondaryChatComposerPanel } from './secondary-chat-collapsible.js';
import { extractStagedIntents } from './secondary-chat-host/extract-staged-intents.js';
import type { MentionItem } from './secondary-chat-mention-popup.js';
import { useSetSecondaryChatModeMutation } from './secondary-chat-trigger.js';

type SecondaryChat = z.infer<typeof secondaryChatStateSchema>;

interface SecondaryChatStreamState {
  readonly isStreaming: boolean;
  readonly isHandoffPending: boolean;
  readonly assistantText: string;
  /**
   * Text of the in-flight user message — set as soon as the user submits,
   * cleared once the bundle re-fetch surfaces the persisted user turn.
   * Bridges the gap between submit (server persists the user turn before
   * streaming) and `onFinish` (when the client invalidates the bundle).
   * Without this, the user's message would vanish from the transcript
   * until the assistant reply completes.
   */
  readonly pendingUserText: string | null;
  readonly send: (message: string) => Promise<void>;
}

function extractTextFromMessage(message: BrunchUIMessage | undefined, role: 'user' | 'assistant'): string {
  if (!message || message.role !== role) return '';
  let out = '';
  for (const part of message.parts) {
    if (part.type === 'text') out += part.text;
  }
  return out;
}

function extractAssistantText(message: BrunchUIMessage | undefined): string {
  return extractTextFromMessage(message, 'assistant');
}

/**
 * Find the most recent user message in the useChat history. The user
 * message arrives at the tail when only the user has spoken; once the
 * assistant starts streaming, it slides to `at(-2)`.
 */
function extractPendingUserText(messages: readonly BrunchUIMessage[]): string {
  const last = messages.at(-1);
  if (last?.role === 'user') return extractTextFromMessage(last, 'user');
  const prev = messages.at(-2);
  if (prev?.role === 'user') return extractTextFromMessage(prev, 'user');
  return '';
}

function useSecondaryChatStream(
  secondaryChat: SecondaryChat,
  patchList: PatchListForChat | null,
): SecondaryChatStreamState {
  const specificationId = secondaryChat.chat.specification_id;
  const chatId = secondaryChat.chat.id;
  const pinnedAnchor = secondaryChat.chat.pinned_item_id;
  const pinnedItemKind = secondaryChat.pinnedItemKind;
  const { invalidateSpecificationBundle } = useInvalidateSpecificationQueryDomains();
  const entities = useSpecificationEntities();
  // Resolves `propose_edge.targetReferenceCode` → `(kind, itemId)` so the edge
  // applier never creates a self-referencing edge against the pinned anchor.
  const anchorByRefCode = useMemo(() => buildAnchorByRefCode(entities), [entities]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `/api/specifications/${specificationId}/secondary-chats/${chatId}/messages`,
      }),
    [chatId, specificationId],
  );

  const [editImpactByToolCallId, setEditImpactByToolCallId] = useState<ReadonlyMap<string, EditImpactTier>>(
    new Map(),
  );

  const handleData = useCallback((dataPart: { type: string; data?: unknown }): void => {
    if (dataPart.type !== 'data-edit-impact') return;
    const data = dataPart.data as { toolCallId?: string; tier?: EditImpactTier } | undefined;
    if (!data || typeof data.toolCallId !== 'string' || !data.tier) return;
    setEditImpactByToolCallId((prev) => {
      if (prev.get(data.toolCallId!) === data.tier) return prev;
      const next = new Map(prev);
      next.set(data.toolCallId!, data.tier!);
      return next;
    });
  }, []);

  const onFinish = useCallback(async () => {
    await invalidateSpecificationBundle();
  }, [invalidateSpecificationBundle]);

  const { messages, sendMessage, status } = useChat<BrunchUIMessage>({
    id: `secondary-chat-${chatId}`,
    transport,
    messages: [],
    dataPartSchemas: brunchDataPartSchemas,
    onData: handleData,
    onFinish,
  });

  const isStreaming = status === 'submitted' || status === 'streaming';
  const assistantText = useMemo(() => extractAssistantText(messages.at(-1)), [messages]);
  const assistantTurnCount = useMemo(
    () =>
      secondaryChat.turns.filter(
        (turn) => turn.assistant_parts !== null && turn.assistant_parts !== undefined,
      ).length,
    [secondaryChat.turns],
  );
  const streamBaselineRef = useRef(assistantTurnCount);
  const wasStreamingRef = useRef(false);
  useEffect(() => {
    if (isStreaming && !wasStreamingRef.current) streamBaselineRef.current = assistantTurnCount;
    wasStreamingRef.current = isStreaming;
  }, [assistantTurnCount, isStreaming]);
  const isHandoffPending =
    !isStreaming && assistantText.length > 0 && assistantTurnCount <= streamBaselineRef.current;
  // Surface the in-flight user message until the bundle re-fetch reflects
  // it. The persisted bundle's `turns` is the source of truth once it
  // arrives; this just bridges the submit → onFinish gap.
  const lastBundleUserText = useMemo(() => {
    for (let i = secondaryChat.turns.length - 1; i >= 0; i -= 1) {
      const turn = secondaryChat.turns[i]!;
      if (turn.user_parts && turn.user_parts.length > 0) return turn.user_parts;
    }
    return '';
  }, [secondaryChat.turns]);
  const pendingUserText = useMemo<string | null>(() => {
    if (!isStreaming) return null;
    const text = extractPendingUserText(messages);
    if (!text) return null;
    if (persistedUserPartsShowsComposerText(text, lastBundleUserText)) return null;
    return text;
  }, [isStreaming, lastBundleUserText, messages]);

  const consumedToolCallIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    consumedToolCallIds.current = new Set();
  }, [chatId]);

  useEffect(() => {
    if (!patchList || pinnedAnchor === null || pinnedItemKind === null) return;
    const decisions = extractStagedIntents(messages, {
      producerChatId: chatId,
      pinnedAnchor: { kind: pinnedItemKind, itemId: pinnedAnchor },
      editImpactByToolCallId,
      resolveTargetAnchor: (refCode) => anchorByRefCode.get(refCode),
    });

    for (const decision of decisions) {
      if (consumedToolCallIds.current.has(decision.toolCallId)) continue;
      // `defer` leaves the toolCallId unconsumed so a later
      // `data-edit-impact` arrival can re-emit a `stage` decision for the
      // same tool call. `skip` and `stage` both consume.
      if (decision.status === 'defer') continue;
      if (decision.status === 'stage') {
        patchList.stage(decision.intent);
      }
      consumedToolCallIds.current.add(decision.toolCallId);
    }
  }, [anchorByRefCode, chatId, editImpactByToolCallId, messages, patchList, pinnedAnchor, pinnedItemKind]);

  const send = useCallback(
    async (message: string): Promise<void> => {
      await sendMessage({ text: message });
    },
    [sendMessage],
  );

  return { isStreaming, isHandoffPending, assistantText, pendingUserText, send };
}

export interface SecondaryChatHostProps {
  secondaryChat: SecondaryChat;
  /** Render the transcript surface. Default true. */
  renderTranscript?: boolean;
  /** Render the composer panel. Default true. */
  renderComposer?: boolean;
  /**
   * When set, the composer is rendered via `createPortal` into this element
   * (the shell uses this to mount the composer into a footer slot beneath the
   * scrollable body). When null/undefined, the composer renders inline.
   */
  composerPortalTarget?: HTMLElement | null;
  /**
   * When set, the transcript surface (`<SecondaryChatCollapsible>`) is
   * rendered via `createPortal` into this element. Mirrors
   * `composerPortalTarget`: the shell uses this to mount the transcript
   * inside a popover anchored to the active tab while keeping the host's
   * per-chat `useChat` instance alive at shell scope. When null/undefined,
   * the transcript renders inline (current default).
   */
  transcriptPortalTarget?: HTMLElement | null;
  /** Fires on transitions of useChat status so the shell can track streaming. */
  onStreamingChange?: (chatId: number, isStreaming: boolean) => void;
  /**
   * Fires when an assistant turn settles after a streaming round so the shell
   * can flag inactive (background-mounted) tabs as unread.
   */
  onAssistantTurnArrival?: (chatId: number) => void;
  /**
   * Fires synchronously when the user submits a message through the
   * composer (before the network request resolves). Used by the shell to
   * auto-open the transcript popover on send (S1 refinement 1a).
   */
  onSendMessage?: (chatId: number) => void;
}

/** Lookup from knowledge-item id → referenceCode (e.g. "G1", "D5") for chip rendering. */
export function buildRefCodeByItemId(entities: EntitiesData): Map<number, string> {
  const map = new Map<number, string>();
  const buckets: ReadonlyArray<ReadonlyArray<{ id: number; referenceCode?: string }>> = [
    entities.goals,
    entities.terms,
    entities.contexts,
    entities.constraints,
    entities.requirements,
    entities.criteria,
    entities.decisions,
    entities.assumptions,
  ];
  for (const bucket of buckets) {
    for (const item of bucket) {
      if (typeof item.referenceCode === 'string' && item.referenceCode.length > 0) {
        map.set(item.id, item.referenceCode);
      }
    }
  }
  return map;
}

/** Reverse index from referenceCode → originating knowledge anchor. */
export function buildAnchorByRefCode(
  entities: EntitiesData,
): Map<string, { kind: KnowledgeKind; itemId: number }> {
  const map = new Map<string, { kind: KnowledgeKind; itemId: number }>();
  const buckets: ReadonlyArray<{
    kind: KnowledgeKind;
    items: ReadonlyArray<{ id: number; referenceCode?: string }>;
  }> = [
    { kind: 'goal', items: entities.goals },
    { kind: 'term', items: entities.terms },
    { kind: 'context', items: entities.contexts },
    { kind: 'constraint', items: entities.constraints },
    { kind: 'requirement', items: entities.requirements },
    { kind: 'criterion', items: entities.criteria },
    { kind: 'decision', items: entities.decisions },
    { kind: 'assumption', items: entities.assumptions },
  ];
  for (const bucket of buckets) {
    for (const item of bucket.items) {
      if (typeof item.referenceCode === 'string' && item.referenceCode.length > 0) {
        map.set(item.referenceCode, { kind: bucket.kind, itemId: item.id });
      }
    }
  }
  return map;
}

export function flattenEntitiesToMentionItems(entities: EntitiesData): MentionItem[] {
  const buckets: { items: ReadonlyArray<{ kind: string; content: string; referenceCode?: string }> }[] = [
    { items: entities.goals },
    { items: entities.terms },
    { items: entities.contexts },
    { items: entities.constraints },
    { items: entities.requirements },
    { items: entities.criteria },
    {
      items: entities.decisions.map((d) => ({
        kind: 'decision',
        content: d.content,
        referenceCode: d.referenceCode,
      })),
    },
    {
      items: entities.assumptions.map((a) => ({
        kind: 'assumption',
        content: a.content,
        referenceCode: a.referenceCode,
      })),
    },
  ];
  const out: MentionItem[] = [];
  for (const bucket of buckets) {
    for (const item of bucket.items) {
      if (typeof item.referenceCode === 'string' && item.referenceCode.length > 0) {
        out.push({ refCode: item.referenceCode, kind: item.kind, content: item.content });
      }
    }
  }
  return out;
}

export function SecondaryChatHost({
  secondaryChat,
  renderTranscript = true,
  renderComposer = true,
  composerPortalTarget,
  transcriptPortalTarget,
  onStreamingChange,
  onAssistantTurnArrival,
  onSendMessage,
}: SecondaryChatHostProps) {
  const specificationId = secondaryChat.chat.specification_id;
  const chatId = secondaryChat.chat.id;
  const modeMutation = useSetSecondaryChatModeMutation(specificationId, chatId);
  const patchList = usePatchListForChat(chatId);
  const stream = useSecondaryChatStream(secondaryChat, patchList);
  const entities = useSpecificationEntities();
  const mentionableItems = useMemo(() => flattenEntitiesToMentionItems(entities), [entities]);
  const refCodeByItemId = useMemo(() => buildRefCodeByItemId(entities), [entities]);

  // Notify shell of streaming state transitions (and a settle event when a
  // streaming round ends) so it can drive cross-tab streaming/unread badges.
  const prevStreamingRef = useRef(false);
  useEffect(() => {
    const wasStreaming = prevStreamingRef.current;
    const isStreaming = stream.isStreaming;
    if (wasStreaming !== isStreaming) {
      onStreamingChange?.(chatId, isStreaming);
    }
    if (wasStreaming && !isStreaming) {
      onAssistantTurnArrival?.(chatId);
    }
    prevStreamingRef.current = isStreaming;
  }, [chatId, stream.isStreaming, onStreamingChange, onAssistantTurnArrival]);

  const composerPanel = renderComposer ? (
    <SecondaryChatComposerPanel
      secondaryChat={secondaryChat}
      onSetMode={(next) => {
        void modeMutation.setMode(next);
      }}
      isModeUpdating={modeMutation.isPending}
      onSubmitMessage={(message) => {
        onSendMessage?.(chatId);
        void stream.send(message);
      }}
      isStreaming={stream.isStreaming || stream.isHandoffPending}
      mentionableItems={mentionableItems}
      refCodeByItemId={refCodeByItemId}
    />
  ) : null;

  const transcript = renderTranscript ? (
    <SecondaryChatCollapsible
      secondaryChat={secondaryChat}
      streamingAssistantText={stream.assistantText}
      pendingUserText={stream.pendingUserText}
      isStreaming={stream.isStreaming}
      onPickStartSuggestion={(prompt) => {
        onSendMessage?.(chatId);
        void stream.send(prompt);
      }}
    />
  ) : null;

  return (
    <>
      {transcript && (transcriptPortalTarget ? createPortal(transcript, transcriptPortalTarget) : transcript)}
      {composerPanel &&
        (composerPortalTarget ? createPortal(composerPanel, composerPortalTarget) : composerPanel)}
    </>
  );
}
