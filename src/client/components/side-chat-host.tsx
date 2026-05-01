import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

import { streamSideChatResponse } from '@/client/lib/side-chat-stream.js';
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

  const openFor = useCallback((item: SideChatPinnableItem) => {
    setActiveSideChat({
      pinnedItem: { referenceCode: item.referenceCode, content: item.content },
      itemKind: item.kind,
      itemId: item.id,
      messages: [],
    });
  }, []);

  const dismiss = useCallback(() => {
    setActiveSideChat(null);
  }, []);

  const submitMessage = useCallback(
    (message: string) => {
      setActiveSideChat((current) => {
        if (!current) {
          return current;
        }
        const next: ActiveSideChat = {
          ...current,
          messages: [
            ...current.messages,
            { role: 'user', text: message },
            { role: 'assistant', text: '', pending: true },
          ],
        };

        void (async () => {
          let buffered = '';
          let failed = false;
          try {
            await streamSideChatResponse(
              {
                specificationId,
                itemKind: next.itemKind,
                itemId: next.itemId,
                message,
              },
              (event) => {
                if (event.type === 'text-delta') {
                  buffered += event.delta;
                  setActiveSideChat((session) =>
                    session
                      ? { ...session, messages: replacePendingText(session.messages, buffered) }
                      : session,
                  );
                }
              },
            );
          } catch {
            failed = true;
          }
          setActiveSideChat((session) => {
            if (!session) {
              return session;
            }
            return {
              ...session,
              messages: failed ? failPending(session.messages) : finalizePending(session.messages),
            };
          });
        })();

        return next;
      });
    },
    [specificationId],
  );

  return (
    <SideChatContext.Provider value={{ openFor }}>
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
