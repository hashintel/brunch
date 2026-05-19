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
import {
  brunchDataPartSchemas,
  type BrunchUIMessage,
  type BrunchUIMessagePart,
  type EditImpactTier,
} from '@/shared/chat.js';
import type { KnowledgeKind } from '@/shared/knowledge.js';

import { usePatchListForChat, type PatchListForChat } from './patch-list-host.js';
import { SecondaryChatCollapsible, SecondaryChatComposerPanel } from './secondary-chat-collapsible.js';
import type { MentionItem } from './secondary-chat-mention-popup.js';
import { useSetSecondaryChatModeMutation } from './secondary-chat-trigger.js';

type SecondaryChat = z.infer<typeof secondaryChatStateSchema>;

function summarizeEditContent(content: string): string {
  const trimmed = content.trim();
  return trimmed.length > 60 ? `${trimmed.slice(0, 57)}…` : trimmed;
}

interface SecondaryChatStreamState {
  readonly isStreaming: boolean;
  readonly assistantText: string;
  readonly send: (message: string) => Promise<void>;
}

type ToolPropoosePart = Extract<
  BrunchUIMessagePart,
  { type: 'tool-propose_edit' | 'tool-propose_edge' | 'tool-propose_drill_down' }
>;

function getToolPart(part: BrunchUIMessagePart): ToolPropoosePart | null {
  if (
    part.type === 'tool-propose_edit' ||
    part.type === 'tool-propose_edge' ||
    part.type === 'tool-propose_drill_down'
  ) {
    return part;
  }
  return null;
}

function extractAssistantText(message: BrunchUIMessage | undefined): string {
  if (!message || message.role !== 'assistant') return '';
  let out = '';
  for (const part of message.parts) {
    if (part.type === 'text') out += part.text;
  }
  return out;
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

  const consumedToolCallIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    consumedToolCallIds.current = new Set();
  }, [chatId]);

  useEffect(() => {
    if (!patchList || pinnedAnchor === null || pinnedItemKind === null) return;
    const anchor = { kind: pinnedItemKind, itemId: pinnedAnchor };

    for (const message of messages) {
      if (message.role !== 'assistant') continue;
      for (const rawPart of message.parts) {
        const part = getToolPart(rawPart);
        if (!part) continue;
        const toolCallId = part.toolCallId;
        if (consumedToolCallIds.current.has(toolCallId)) continue;
        if (part.state !== 'input-available' && part.state !== 'output-available') continue;

        if (part.type === 'tool-propose_edit') {
          const input = part.input as { newContent: string; newRationale?: string };
          const impact = editImpactByToolCallId.get(toolCallId);
          if (impact === undefined) continue;
          patchList.stage({
            kind: 'edit',
            producerChatId: chatId,
            anchor,
            summary: summarizeEditContent(input.newContent),
            newContent: input.newContent,
            ...(input.newRationale ? { newRationale: input.newRationale } : {}),
            impact,
          });
          consumedToolCallIds.current.add(toolCallId);
        } else if (part.type === 'tool-propose_edge') {
          const input = part.input as { targetReferenceCode: string; relation: string };
          // Drop proposals that target the pinned anchor or fail to resolve.
          const targetAnchor = anchorByRefCode.get(input.targetReferenceCode);
          if (!targetAnchor || (targetAnchor.kind === anchor.kind && targetAnchor.itemId === anchor.itemId)) {
            consumedToolCallIds.current.add(toolCallId);
            continue;
          }
          patchList.stage({
            kind: 'edge',
            producerChatId: chatId,
            anchor,
            targetAnchor,
            relation: input.relation,
            summary: `Edge: ${input.targetReferenceCode} (${input.relation})`,
          });
          consumedToolCallIds.current.add(toolCallId);
        } else if (part.type === 'tool-propose_drill_down') {
          const input = part.input as { focusArea: string };
          patchList.stage({
            kind: 'drill-down',
            producerChatId: chatId,
            anchor,
            summary: `Drill-down: ${input.focusArea}`,
            focusArea: input.focusArea,
          });
          consumedToolCallIds.current.add(toolCallId);
        }
      }
    }
  }, [anchorByRefCode, chatId, editImpactByToolCallId, messages, patchList, pinnedAnchor, pinnedItemKind]);

  const send = useCallback(
    async (message: string): Promise<void> => {
      await sendMessage({ text: message });
    },
    [sendMessage],
  );

  return { isStreaming, assistantText, send };
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
  /** Fires on transitions of useChat status so the shell can track streaming. */
  onStreamingChange?: (chatId: number, isStreaming: boolean) => void;
  /**
   * Fires when an assistant turn settles after a streaming round so the shell
   * can flag inactive (background-mounted) tabs as unread.
   */
  onAssistantTurnArrival?: (chatId: number) => void;
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
  onStreamingChange,
  onAssistantTurnArrival,
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
        void stream.send(message);
      }}
      isStreaming={stream.isStreaming}
      mentionableItems={mentionableItems}
      refCodeByItemId={refCodeByItemId}
    />
  ) : null;

  return (
    <>
      {renderTranscript && (
        <SecondaryChatCollapsible
          secondaryChat={secondaryChat}
          streamingAssistantText={stream.assistantText}
          isStreaming={stream.isStreaming}
          onPickStartSuggestion={(prompt) => {
            void stream.send(prompt);
          }}
        />
      )}
      {composerPanel &&
        (composerPortalTarget ? createPortal(composerPanel, composerPortalTarget) : composerPanel)}
    </>
  );
}
