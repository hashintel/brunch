import { useCallback, useEffect, useRef, useState } from 'react';
import type { z } from 'zod/v4';

import { streamSecondaryChatMessage } from '@/client/lib/secondary-chat-stream.js';
import { useInvalidateSpecificationQueryDomains } from '@/client/routes/specification/$id/-specification-data.js';
import type { secondaryChatStateSchema } from '@/shared/api-types.js';

import { useChatShellPresence } from './chat-shell-presence.js';
import { usePatchListForChat, type PatchListForChat } from './patch-list-host.js';
import { SecondaryChatCollapsible } from './secondary-chat-collapsible.js';
import { SecondaryChatStagingStrip } from './secondary-chat-staging-strip.js';
import { useSetSecondaryChatModeMutation } from './secondary-chat-trigger.js';

type SecondaryChat = z.infer<typeof secondaryChatStateSchema>;

interface SecondaryChatStreamState {
  readonly isStreaming: boolean;
  readonly assistantText: string;
  readonly send: (message: string) => Promise<void>;
}

function summarizeEditContent(content: string): string {
  const trimmed = content.trim();
  return trimmed.length > 60 ? `${trimmed.slice(0, 57)}…` : trimmed;
}

/**
 * Per-chat hook owning the streaming lifecycle for one secondary chat.
 * Posts to `POST /secondary-chats/:chatId/messages`, accumulates assistant
 * text deltas for live display, and invalidates the specification bundle on
 * completion so the persisted user/assistant turns replace the in-flight
 * `assistantText` on next render.
 *
 * Each instance owns its own in-flight ref so multiple secondary chats can
 * stream in parallel without state cross-talk. `propose_*` SSE chunks are
 * translated into chat-scoped staged patches via `usePatchListForChat`.
 */
function useSecondaryChatStream(
  secondaryChat: SecondaryChat,
  patchList: PatchListForChat | null,
): SecondaryChatStreamState {
  const specificationId = secondaryChat.chat.specification_id;
  const chatId = secondaryChat.chat.id;
  const pinnedAnchor = secondaryChat.chat.pinned_item_id;
  const { invalidateSpecificationBundle } = useInvalidateSpecificationQueryDomains();
  const [isStreaming, setIsStreaming] = useState(false);
  const [assistantText, setAssistantText] = useState('');
  const inFlightRef = useRef<AbortController | null>(null);
  const patchListRef = useRef(patchList);
  patchListRef.current = patchList;

  const pinnedItemKind = secondaryChat.pinnedItemKind;

  const send = useCallback(
    async (message: string): Promise<void> => {
      if (inFlightRef.current) return; // ignore overlapping submits — one stream per chat
      const controller = new AbortController();
      inFlightRef.current = controller;
      setIsStreaming(true);
      setAssistantText('');

      try {
        await streamSecondaryChatMessage(
          { specificationId, chatId, message, signal: controller.signal },
          (event) => {
            if (event.type === 'text-delta') {
              setAssistantText((prev) => prev + event.delta);
              return;
            }
            if (event.type !== 'patch-proposal') return;
            // Patch staging requires a chat-scoped patch list, a pinned
            // item id (anchor), and the resolved item kind. Without any of
            // them, the proposal can't be routed; drop it silently — the
            // assistant text already conveys the model's intent.
            const list = patchListRef.current;
            if (!list || pinnedAnchor === null || pinnedItemKind === null) return;
            const anchor = { kind: pinnedItemKind, itemId: pinnedAnchor };
            if (event.toolName === 'propose_edit') {
              list.stage({
                kind: 'edit',
                producerChatId: chatId,
                anchor,
                summary: summarizeEditContent(event.input.newContent),
                newContent: event.input.newContent,
                ...(event.input.newRationale ? { newRationale: event.input.newRationale } : {}),
                ...(event.impact !== undefined ? { impact: event.impact } : {}),
              });
            } else if (event.toolName === 'propose_edge') {
              list.stage({
                kind: 'edge',
                producerChatId: chatId,
                anchor,
                // Resolving targetReferenceCode → (kind, itemId) requires an
                // entity lookup not threaded through the secondary-chat
                // bundle for V1; mirror the anchor item as a placeholder so
                // the staged row renders with a correct relation label.
                // PR follow-up: surface a target-resolver hook.
                targetAnchor: anchor,
                relation: event.input.relation,
                summary: `Edge: ${event.input.targetReferenceCode} (${event.input.relation})`,
              });
            } else if (event.toolName === 'propose_drill_down') {
              list.stage({
                kind: 'drill-down',
                producerChatId: chatId,
                anchor,
                summary: `Drill-down: ${event.input.focusArea}`,
                focusArea: event.input.focusArea,
              });
            }
          },
        );
      } catch {
        // Swallow stream errors at this layer; the bundle invalidation below
        // surfaces the persisted partial transcript on the next render.
      } finally {
        inFlightRef.current = null;
        setIsStreaming(false);
        setAssistantText('');
        await invalidateSpecificationBundle();
      }
    },
    [chatId, invalidateSpecificationBundle, pinnedAnchor, pinnedItemKind, specificationId],
  );

  return { isStreaming, assistantText, send };
}

export interface SecondaryChatHostProps {
  secondaryChat: SecondaryChat;
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
      {...(presence?.jumpToAnchor ? { onJumpToAnchor: presence.jumpToAnchor } : {})}
    />
  );
}
