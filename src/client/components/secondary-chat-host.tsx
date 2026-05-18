import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

import { useChatShellPresence } from './chat-shell-presence.js';
import { usePatchListForChat, type PatchListForChat } from './patch-list-host.js';
import { SecondaryChatCollapsible } from './secondary-chat-collapsible.js';
import type { MentionItem } from './secondary-chat-mention-popup.js';
import { SecondaryChatStagingStrip } from './secondary-chat-staging-strip.js';
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

/**
 * Per-chat hook owning the streaming lifecycle for one secondary chat via
 * `useChat<BrunchUIMessage>` (FE-716 C24c). Mounts a transport pointed at
 * the C24b route, derives streaming text from the in-flight assistant
 * message, translates `tool-propose_*` UIMessage parts into chat-scoped
 * staged patches (joined with `data-edit-impact` parts via `toolCallId`),
 * and invalidates the bundle on stream completion so the persisted
 * user/assistant turns replace the in-flight `messages` on next render.
 *
 * Each `useChat` instance is keyed by `id: secondary-chat-${chatId}` so
 * multiple secondary chats can stream in parallel without state cross-talk.
 * The C5c partition seam (`producerChatId`) is preserved unchanged.
 */
function useSecondaryChatStream(
  secondaryChat: SecondaryChat,
  patchList: PatchListForChat | null,
): SecondaryChatStreamState {
  const specificationId = secondaryChat.chat.specification_id;
  const chatId = secondaryChat.chat.id;
  const pinnedAnchor = secondaryChat.chat.pinned_item_id;
  const pinnedItemKind = secondaryChat.pinnedItemKind;
  const { invalidateSpecificationBundle } = useInvalidateSpecificationQueryDomains();

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `/api/specifications/${specificationId}/secondary-chats/${chatId}/messages`,
      }),
    [chatId, specificationId],
  );

  // FE-716 C24b: edit-impact arrives as a sibling `data-edit-impact` part
  // after the corresponding `tool-propose_edit` part finalizes. Capture the
  // tier in state so the message-walking effect can stage the patch with
  // the right `impact` once both parts have arrived for a given toolCallId.
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

  // Dedupe tool parts: each toolCallId becomes a single `patchList.stage(...)`
  // call. The effect walks `messages` every render; without this set, an edit
  // would re-stage on every text-delta arrival.
  const consumedToolCallIds = useRef<Set<string>>(new Set());
  // Reset the consumed set when chat id changes so a remount starts fresh.
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
        // Only stage once the tool input is available (we need the `input` field).
        if (part.state !== 'input-available' && part.state !== 'output-available') continue;

        if (part.type === 'tool-propose_edit') {
          const input = part.input as { newContent: string; newRationale?: string };
          const impact = editImpactByToolCallId.get(toolCallId);
          // For edit proposals, wait for the matching edit-impact part before
          // staging. Other tool kinds stage immediately.
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
          patchList.stage({
            kind: 'edge',
            producerChatId: chatId,
            anchor,
            // Resolving targetReferenceCode → (kind, itemId) requires an entity
            // lookup not threaded through the secondary-chat bundle for V1;
            // mirror the anchor item as a placeholder so the staged row renders
            // with a correct relation label. PR follow-up: target-resolver hook.
            targetAnchor: anchor,
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
  }, [chatId, editImpactByToolCallId, messages, patchList, pinnedAnchor, pinnedItemKind]);

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
}

/**
 * Flatten the spec's entity bundle into the `MentionItem[]` shape consumed by
 * the composer's `#` autocomplete (FE-716 C25). Items without a `referenceCode`
 * are filtered out — the server resolver keys on `#PREFIX<digits>` so an item
 * without a refcode can't be mentioned.
 */
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

/**
 * Per-chat host component that owns ALL per-chat mutation/streaming hooks for
 * one secondary chat and renders `<SecondaryChatCollapsible>` with wired
 * props. Replaces the prior `SecondaryChatCollapsibleWithMode` wrapper —
 * folding the mode mutation, the stream consumer, and the staging strip into
 * a single seam keeps the artifact-renderer one component shallower.
 */
export function SecondaryChatHost({ secondaryChat }: SecondaryChatHostProps) {
  const specificationId = secondaryChat.chat.specification_id;
  const chatId = secondaryChat.chat.id;
  const modeMutation = useSetSecondaryChatModeMutation(specificationId, chatId);
  const patchList = usePatchListForChat(chatId);
  const stream = useSecondaryChatStream(secondaryChat, patchList);
  const entities = useSpecificationEntities();
  const mentionableItems = useMemo(() => flattenEntitiesToMentionItems(entities), [entities]);
  // FE-716 C14: the host watches the chat-shell presence context for two
  // signals: (1) `focusedChatId === chatId` auto-opens this collapsible
  // when a trigger creates this chat, (2) `jumpToAnchor` is forwarded to
  // the collapsible header so users can jump to the chat's
  // `invoked_in_turn_id` in the workspace center.
  const presence = useChatShellPresence();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (presence?.focusedChatId === chatId) {
      setIsOpen(true);
    }
  }, [chatId, presence?.focusedChatId]);

  return (
    <SecondaryChatCollapsible
      secondaryChat={secondaryChat}
      onSetMode={(next) => {
        void modeMutation.setMode(next);
      }}
      isModeUpdating={modeMutation.isPending}
      onSubmitMessage={(message) => {
        void stream.send(message);
      }}
      streamingAssistantText={stream.assistantText}
      isStreaming={stream.isStreaming}
      bodyExtras={<SecondaryChatStagingStrip chatId={chatId} />}
      open={isOpen}
      onOpenChange={setIsOpen}
      mentionableItems={mentionableItems}
      {...(presence?.jumpToAnchor ? { onJumpToAnchor: presence.jumpToAnchor } : {})}
    />
  );
}
