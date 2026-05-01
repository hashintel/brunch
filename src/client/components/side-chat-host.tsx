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
            // V1: surface errors via Card E; for now drop the partial response.
          }
          setActiveSideChat((session) =>
            session ? { ...session, messages: finalizePending(session.messages) } : session,
          );
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
