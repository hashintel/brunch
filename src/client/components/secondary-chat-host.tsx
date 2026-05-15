import { useCallback, useRef, useState } from 'react';
import type { z } from 'zod/v4';

import { streamSecondaryChatMessage } from '@/client/lib/secondary-chat-stream.js';
import { useInvalidateSpecificationQueryDomains } from '@/client/routes/specification/$id/-specification-data.js';
import type { secondaryChatStateSchema } from '@/shared/api-types.js';

import { SecondaryChatCollapsible } from './secondary-chat-collapsible.js';
import { useSetSecondaryChatModeMutation } from './secondary-chat-trigger.js';

type SecondaryChat = z.infer<typeof secondaryChatStateSchema>;

interface SecondaryChatStreamState {
  readonly isStreaming: boolean;
  readonly assistantText: string;
  readonly send: (message: string) => Promise<void>;
}

/**
 * Per-chat hook owning the streaming lifecycle for one secondary chat.
 * Posts to `POST /secondary-chats/:chatId/messages`, accumulates assistant
 * text deltas for live display, and invalidates the specification bundle on
 * completion so the persisted user/assistant turns replace the in-flight
 * `assistantText` on next render.
 *
 * Each instance owns its own in-flight ref so multiple secondary chats can
 * stream in parallel without state cross-talk.
 */
function useSecondaryChatStream(specificationId: number, chatId: number): SecondaryChatStreamState {
  const { invalidateSpecificationBundle } = useInvalidateSpecificationQueryDomains();
  const [isStreaming, setIsStreaming] = useState(false);
  const [assistantText, setAssistantText] = useState('');
  const inFlightRef = useRef<AbortController | null>(null);

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
    [chatId, invalidateSpecificationBundle, specificationId],
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
 * folding the mode mutation and the stream consumer into a single seam keeps
 * the artifact-renderer one component shallower.
 */
export function SecondaryChatHost({ secondaryChat }: SecondaryChatHostProps) {
  const specificationId = secondaryChat.chat.specification_id;
  const chatId = secondaryChat.chat.id;
  const modeMutation = useSetSecondaryChatModeMutation(specificationId, chatId);
  const stream = useSecondaryChatStream(specificationId, chatId);

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
    />
  );
}
