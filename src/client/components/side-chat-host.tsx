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

import {
  listAnnotationsForSpecificationRequest,
  type CreatedAnnotation,
} from '@/client/lib/annotation-api.js';
import { streamSideChatResponse, type SideChatPriorTurn } from '@/client/lib/side-chat-stream.js';
import type { KnowledgeKind } from '@/shared/knowledge.js';

import {
  useLastBatchAppliedMeta,
  usePatchList,
  usePatchListState,
  useStagedPatches,
} from './patch-list-host.js';
import {
  SideChatPopover,
  type SideChatExistingAnnotation,
  type SideChatMessage,
  type SideChatPinnedItem,
  type SideChatStagedPatchSummary,
  type SideChatThreadItem,
} from './side-chat-popover.js';

export interface SideChatPinnableItem {
  kind: KnowledgeKind;
  id: number;
  referenceCode: string;
  content: string;
}

interface SideChatContextValue {
  openFor: (item: SideChatPinnableItem) => void;
  openWithSpanHint: (item: SideChatPinnableItem, hint: string) => void;
  activeCardIds: readonly number[];
  dismissCard: (annotationId: number) => void;
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
  annotateMode: boolean;
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

const SIDE_CHAT_LAYOUT_STORAGE_KEY = 'brunch.side-chat.layout';

function readStoredLayout(): 'docked' | 'floating' {
  if (typeof window === 'undefined') return 'docked';
  try {
    return window.localStorage.getItem(SIDE_CHAT_LAYOUT_STORAGE_KEY) === 'floating' ? 'floating' : 'docked';
  } catch {
    return 'docked';
  }
}

function writeStoredLayout(layout: 'docked' | 'floating'): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SIDE_CHAT_LAYOUT_STORAGE_KEY, layout);
  } catch {
    // Storage may be unavailable (privacy mode, sandboxed iframe, quota); ignore.
  }
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
  const [pendingSpanHint, setPendingSpanHint] = useState<string | null>(null);
  const [layout, setLayout] = useState<'docked' | 'floating'>(readStoredLayout);
  useEffect(() => {
    writeStoredLayout(layout);
  }, [layout]);
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
        pinnedItem: { referenceCode: item.referenceCode, content: item.content, kind: item.kind },
        itemKind: item.kind,
        itemId: item.id,
        messages: [],
        annotateMode: false,
      });
    },
    [abortActiveStream],
  );

  const openWithSpanHint = useCallback(
    (item: SideChatPinnableItem, hint: string) => {
      openFor(item);
      setPendingSpanHint(hint);
    },
    [openFor],
  );

  const dismiss = useCallback(() => {
    abortActiveStream();
    setActiveSideChat(null);
  }, [abortActiveStream]);

  const requestAnnotate = useCallback(() => {
    setActiveSideChat((current) => (current ? { ...current, annotateMode: true } : current));
  }, []);

  const cancelAnnotate = useCallback(() => {
    setActiveSideChat((current) => (current ? { ...current, annotateMode: false } : current));
  }, []);

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
      const hintForThisRequest = pendingSpanHint;
      if (hintForThisRequest) {
        setPendingSpanHint(null);
      }

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
              ...(hintForThisRequest ? { spanHint: hintForThisRequest } : {}),
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
    [specificationId, abortActiveStream, pendingSpanHint],
  );
  interface ActiveCard {
    id: number;
    summary: string;
    body: string;
    timestamp: number;
  }
  const [activeCards, setActiveCards] = useState<ActiveCard[]>([]);
  const pushActiveCard = useCallback((card: { id: number; summary: string; body: string }) => {
    setActiveCards((prev) =>
      prev.some((existing) => existing.id === card.id) ? prev : [...prev, { ...card, timestamp: Date.now() }],
    );
  }, []);
  const dismissCard = useCallback((annotationId: number) => {
    setActiveCards((prev) => prev.filter((card) => card.id !== annotationId));
  }, []);
  const activeCardIds: readonly number[] = activeCards.map((card) => card.id);
  const sideChatContextValue = useMemo(
    () => ({ openFor, openWithSpanHint, activeCardIds, dismissCard }),
    [openFor, openWithSpanHint, activeCardIds, dismissCard],
  );

  const patchList = usePatchList();
  const patchListState = usePatchListState();
  const stagedForActive = useStagedPatches(
    activeSideChat
      ? { anchor: { kind: activeSideChat.itemKind, itemId: activeSideChat.itemId }, kind: 'annotate' }
      : undefined,
  );

  const submitAnnotate = useCallback(
    (summary: string, body: string) => {
      if (!activeSideChat || !patchList) {
        return;
      }
      patchList.stage({
        kind: 'annotate',
        anchor: { kind: activeSideChat.itemKind, itemId: activeSideChat.itemId },
        summary,
        body,
      });
      setActiveSideChat((current) => (current ? { ...current, annotateMode: false } : current));
    },
    [activeSideChat, patchList],
  );

  const stagedSummaries: readonly SideChatStagedPatchSummary[] = stagedForActive.map((patch) => ({
    id: patch.id,
    kind: 'annotate',
    summary: patch.summary,
  }));
  const canUndoForActive =
    patchListState.canUndo &&
    activeSideChat !== null &&
    patchListState.lastBatchPatches.some(
      (patch) =>
        patch.kind === 'annotate' &&
        patch.anchor.kind === activeSideChat.itemKind &&
        patch.anchor.itemId === activeSideChat.itemId,
    );

  const triggeredAutoApplyIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!patchList || patchListState.isApplying) return;
    const triggered = triggeredAutoApplyIdsRef.current;
    const stagedIds = new Set(patchListState.staged.map((patch) => patch.id));
    for (const id of triggered) {
      if (!stagedIds.has(id)) triggered.delete(id);
    }
    const allAutoApplyable = patchListState.staged.every((patch) => patch.kind === 'annotate');
    if (!allAutoApplyable) return;
    const hasUntriggered = patchListState.staged.some((patch) => !triggered.has(patch.id));
    if (!hasUntriggered) return;
    for (const patch of patchListState.staged) {
      triggered.add(patch.id);
    }
    void patchList.apply();
  }, [patchList, patchListState.staged, patchListState.isApplying]);

  const lastBatchAppliedMeta = useLastBatchAppliedMeta();
  const lastSeenBatchIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (patchListState.lastBatchId === lastSeenBatchIdRef.current) return;
    lastSeenBatchIdRef.current = patchListState.lastBatchId;
    for (const meta of lastBatchAppliedMeta) {
      if (meta.applied && typeof meta.applied === 'object' && 'id' in meta.applied) {
        const applied = meta.applied as { id: unknown; summary?: unknown; body?: unknown };
        if (typeof applied.id === 'number') {
          pushActiveCard({
            id: applied.id,
            summary: typeof applied.summary === 'string' ? applied.summary : '',
            body: typeof applied.body === 'string' ? applied.body : '',
          });
        }
      }
    }
  }, [patchListState.lastBatchId, lastBatchAppliedMeta, pushActiveCard]);

  const activeItemId = activeSideChat?.itemId;
  const activeItemKind = activeSideChat?.itemKind;
  const [annotations, setAnnotations] = useState<readonly CreatedAnnotation[]>([]);
  useEffect(() => {
    if (activeItemId === undefined || activeItemKind === undefined) {
      setAnnotations([]);
      return;
    }
    let cancelled = false;
    void listAnnotationsForSpecificationRequest(specificationId)
      .then((list) => {
        if (!cancelled) setAnnotations(list);
      })
      .catch(() => {
        if (!cancelled) setAnnotations([]);
      });
    return () => {
      cancelled = true;
    };
  }, [activeItemId, activeItemKind, specificationId, patchListState.lastBatchId]);

  const existingAnnotations: readonly SideChatExistingAnnotation[] = activeSideChat
    ? annotations
        .filter((annotation) => annotation.knowledge_item_id === activeSideChat.itemId)
        .map((annotation) => ({
          id: annotation.id,
          summary: annotation.summary,
          body: annotation.body,
        }))
    : [];

  const threadItems: readonly SideChatThreadItem[] = activeSideChat
    ? (() => {
        const messageItems: SideChatThreadItem[] = activeSideChat.messages.map((message, index) => ({
          kind: 'message' as const,
          id: `m-${index}`,
          message,
          timestamp: index,
        }));
        const cardItems: SideChatThreadItem[] = activeCards.map((card) => ({
          kind: 'card' as const,
          id: `c-${card.id}`,
          annotationId: card.id,
          summary: card.summary,
          body: card.body,
          itemKind: activeSideChat.itemKind,
          referenceCode: activeSideChat.pinnedItem.referenceCode,
          inContext: true,
          timestamp: card.timestamp,
        }));
        // Cards use Date.now() timestamps; messages use index. To interleave correctly
        // for the V1 single-pin happy path (cards staged after messages), append cards
        // after messages. Sort by timestamp anyway for any future cross-pin scenarios
        // where both share the same time scale.
        return [...messageItems, ...cardItems].sort((a, b) => a.timestamp - b.timestamp);
      })()
    : [];

  const docksContent = activeSideChat !== null && layout === 'docked';

  return (
    <SideChatContext.Provider value={sideChatContextValue}>
      <div
        className="h-full min-h-0 min-w-0 overflow-hidden transition-[padding] duration-200 ease-out"
        style={{ paddingRight: docksContent ? 'calc(588px + 1rem)' : undefined }}
      >
        {children}
      </div>
      {activeSideChat && (
        <SideChatPopover
          key={activeSideChat.sessionId}
          pinnedItem={activeSideChat.pinnedItem}
          threadItems={threadItems}
          onDismiss={dismiss}
          onSubmit={submitMessage}
          onDismissCard={dismissCard}
          annotateMode={activeSideChat.annotateMode}
          onAnnotateRequest={patchList ? requestAnnotate : undefined}
          onAnnotateCancel={cancelAnnotate}
          onAnnotateSubmit={submitAnnotate}
          stagedPatches={stagedSummaries}
          canUndo={canUndoForActive}
          isApplying={patchListState.isApplying}
          onApply={patchList?.apply}
          onUndo={patchList?.undo}
          onDiscardPatch={patchList?.discard}
          existingAnnotations={existingAnnotations}
          layout={layout}
          onLayoutChange={setLayout}
        />
      )}
    </SideChatContext.Provider>
  );
}
