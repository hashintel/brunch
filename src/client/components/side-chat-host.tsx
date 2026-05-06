import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { streamSideChatResponse, type SideChatPriorTurn } from '@/client/lib/side-chat-stream.js';
import type { KnowledgeKind } from '@/shared/knowledge.js';

import { SideChatPopover, type SideChatMessage, type SideChatPinnedItem } from './side-chat-popover.js';

export interface SideChatPinnableItem {
  kind: KnowledgeKind;
  id: number;
  referenceCode: string;
  content: string;
}

interface SideChatContextValue {
  openFor: (item: SideChatPinnableItem) => void;
}

const SideChatContext = createContext<SideChatContextValue | null>(null);

export function useSideChat(): SideChatContextValue | null {
  return useContext(SideChatContext);
}

interface ActiveSideChat {
  sessionId: number;
  pinnedItem: SideChatPinnedItem;
  itemKind: KnowledgeKind;
  itemId: number;
  messages: SideChatMessage[];
}

function replacePendingText(messages: readonly SideChatMessage[], text: string): SideChatMessage[] {
  return messages.map((message) => (message.pending ? { ...message, text } : message));
}

function finalizePending(messages: readonly SideChatMessage[]): SideChatMessage[] {
  return messages.flatMap((message) => {
    if (!message.pending) {
      return [message];
    }
    return message.text ? [{ role: message.role, text: message.text }] : [];
  });
}

const SIDE_CHAT_ERROR_MESSAGE = 'Something went wrong — try again.';

function buildHistory(messages: readonly SideChatMessage[]): SideChatPriorTurn[] {
  const history: SideChatPriorTurn[] = [];
  for (const message of messages) {
    if (message.pending || message.error || message.text.length === 0) {
      if (message.role === 'assistant' && history.at(-1)?.role === 'user') {
        history.pop();
      }
      continue;
    }
    history.push({ role: message.role, text: message.text });
  }
  if (history.at(-1)?.role === 'user') {
    history.pop();
  }
  return history;
}

function failPending(messages: readonly SideChatMessage[]): SideChatMessage[] {
  let replaced = false;
  const next = messages.map((message) => {
    if (message.pending) {
      replaced = true;
      return { role: message.role, text: SIDE_CHAT_ERROR_MESSAGE, error: true } as SideChatMessage;
    }
    return message;
  });
  if (!replaced) {
    next.push({ role: 'assistant', text: SIDE_CHAT_ERROR_MESSAGE, error: true });
  }
  return next;
}

export function SideChatHost({
  specificationId,
  children,
}: {
  specificationId: number;
  children: ReactNode;
}) {
  const [activeSideChat, setActiveSideChat] = useState<ActiveSideChat | null>(null);
  const activeRef = useRef<ActiveSideChat | null>(null);
  const sessionCounterRef = useRef(0);
  const streamControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    activeRef.current = activeSideChat;
  }, [activeSideChat]);

  const abortActiveStream = useCallback(() => {
    streamControllerRef.current?.abort();
    streamControllerRef.current = null;
  }, []);

  useEffect(() => abortActiveStream, [abortActiveStream]);

  const openFor = useCallback(
    (item: SideChatPinnableItem) => {
      abortActiveStream();
      sessionCounterRef.current += 1;
      setActiveSideChat({
        sessionId: sessionCounterRef.current,
        pinnedItem: { referenceCode: item.referenceCode, content: item.content },
        itemKind: item.kind,
        itemId: item.id,
        messages: [],
      });
    },
    [abortActiveStream],
  );

  const dismiss = useCallback(() => {
    abortActiveStream();
    setActiveSideChat(null);
  }, [abortActiveStream]);

  const submitMessage = useCallback(
    (message: string) => {
      const session = activeRef.current;
      if (!session) {
        return;
      }
      const { sessionId } = session;

      abortActiveStream();
      const controller = new AbortController();
      streamControllerRef.current = controller;
      const history = buildHistory(session.messages);

      setActiveSideChat((current) => {
        if (!current || current.sessionId !== sessionId) {
          return current;
        }
        return {
          ...current,
          messages: [
            ...current.messages,
            { role: 'user', text: message },
            { role: 'assistant', text: '', pending: true },
          ],
        };
      });

      void (async () => {
        let buffered = '';
        let failed = false;
        try {
          await streamSideChatResponse(
            {
              specificationId,
              itemKind: session.itemKind,
              itemId: session.itemId,
              message,
              history,
              signal: controller.signal,
            },
            (event) => {
              if (controller.signal.aborted) {
                return;
              }
              if (event.type === 'text-delta') {
                buffered += event.delta;
                setActiveSideChat((current) =>
                  current && current.sessionId === sessionId
                    ? { ...current, messages: replacePendingText(current.messages, buffered) }
                    : current,
                );
              }
            },
          );
        } catch {
          failed = !controller.signal.aborted;
        }
        if (controller.signal.aborted) {
          return;
        }
        if (streamControllerRef.current === controller) {
          streamControllerRef.current = null;
        }
        setActiveSideChat((current) => {
          if (!current || current.sessionId !== sessionId) {
            return current;
          }
          return {
            ...current,
            messages: failed ? failPending(current.messages) : finalizePending(current.messages),
          };
        });
      })();
    },
    [specificationId, abortActiveStream],
  );
  const sideChatContextValue = useMemo(() => ({ openFor }), [openFor]);

  return (
    <SideChatContext.Provider value={sideChatContextValue}>
      {children}
      {activeSideChat && (
        <SideChatPopover
          pinnedItem={activeSideChat.pinnedItem}
          messages={activeSideChat.messages}
          onDismiss={dismiss}
          onSubmit={submitMessage}
        />
      )}
    </SideChatContext.Provider>
  );
}
