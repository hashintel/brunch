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

// Cap on how many ActiveCards we send as `activeAnnotations` in the stream payload,
// and how many of them we mark `inContext` in the rendered thread. Single source of truth
// referenced from both the request builder and the threadItems derivation.
const MAX_ACTIVE_ANNOTATIONS = 8;

interface ActiveSideChat {
  sessionId: number;
  pinnedItem: SideChatPinnedItem;
  itemKind: KnowledgeKind;
  itemId: number;
  messages: SideChatMessage[];
  // Parallel array: messageTimestamps[i] is the wall-clock time when messages[i] was first
  // appended (or, for the streamed assistant pending message, when it started streaming).
  // Preserved across replacePendingText / finalizePending so the timestamp is stable across
  // streaming. Used by threadItems to chronologically interleave with ActiveCard timestamps,
  // which also use Date.now().
  messageTimestamps: number[];
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

// Mirrors finalizePending: when finalizePending drops an empty pending message, the
// corresponding entry in messageTimestamps must drop too so the parallel arrays stay aligned.
function finalizeTimestamps(messages: readonly SideChatMessage[], timestamps: readonly number[]): number[] {
  const next: number[] = [];
  messages.forEach((message, index) => {
    const ts = timestamps[index] ?? Date.now();
    if (!message.pending) {
      next.push(ts);
      return;
    }
    if (message.text) {
      next.push(ts);
    }
  });
  return next;
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

interface ActiveCard {
  id: number;
  summary: string;
  body: string;
  timestamp: number;
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
  const [activeCards, setActiveCards] = useState<ActiveCard[]>([]);
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
      // Single-pin scope: cards/hint stay only when reopening the same item. Switching to a
      // different (kind, id) clears them so stale state doesn't leak across items.
      const current = activeRef.current;
      if (!current || current.itemKind !== item.kind || current.itemId !== item.id) {
        setActiveCards([]);
        setPendingSpanHint(null);
      }
      setActiveSideChat({
        sessionId: sessionCounterRef.current,
        pinnedItem: { referenceCode: item.referenceCode, content: item.content, kind: item.kind },
        itemKind: item.kind,
        itemId: item.id,
        messages: [],
        messageTimestamps: [],
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
    // Single-pin scope: closing the side-chat resets cards and any unsent span hint so
    // they don't leak into the next item the user opens.
    setActiveCards([]);
    setPendingSpanHint(null);
  }, [abortActiveStream]);

  const requestAnnotate = useCallback(() => {
    setActiveSideChat((current) => (current ? { ...current, annotateMode: true } : current));
  }, []);

  const cancelAnnotate = useCallback(() => {
    setActiveSideChat((current) => (current ? { ...current, annotateMode: false } : current));
  }, []);

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
        // Record one wall-clock timestamp per appended message. The pending assistant
        // message keeps its initial timestamp through replacePendingText so it doesn't
        // bounce around in the chronological sort as deltas arrive.
        const now = Date.now();
        return {
          ...current,
          messages: [
            ...current.messages,
            { role: 'user', text: message },
            { role: 'assistant', text: '', pending: true },
          ],
          messageTimestamps: [...current.messageTimestamps, now, now],
        };
      });

      const activeAnnotations = activeCards.slice(-MAX_ACTIVE_ANNOTATIONS).map((card) => ({
        referenceCode: session.pinnedItem.referenceCode,
        snapshot: card.summary,
        body: card.body.length > 0 ? card.body : null,
      }));

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
              ...(activeAnnotations.length > 0 ? { activeAnnotations } : {}),
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
          // failPending preserves message count (in-place replace + maybe append, but the
          // original pending always exists here), so timestamps stay aligned. finalizePending
          // may drop an empty pending message — finalizeTimestamps mirrors that drop.
          const nextMessages = failed ? failPending(current.messages) : finalizePending(current.messages);
          const nextTimestamps = failed
            ? // failPending may push a new error message when no pending was found; pad with now.
              nextMessages.length > current.messageTimestamps.length
              ? [...current.messageTimestamps, Date.now()]
              : current.messageTimestamps
            : finalizeTimestamps(current.messages, current.messageTimestamps);
          return {
            ...current,
            messages: nextMessages,
            messageTimestamps: nextTimestamps,
          };
        });
      })();
    },
    [specificationId, abortActiveStream, pendingSpanHint, activeCards],
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
        // Both messages and cards record wall-clock Date.now() timestamps, so a single
        // chronological sort actually interleaves them correctly. Messages get their
        // timestamp at append time and preserve it across streaming deltas; cards get
        // theirs when promoted from a freshly-applied annotation.
        const messageItems: SideChatThreadItem[] = activeSideChat.messages.map((message, index) => ({
          kind: 'message' as const,
          id: `m-${index}`,
          message,
          timestamp: activeSideChat.messageTimestamps[index] ?? 0,
        }));
        const cardItems: SideChatThreadItem[] = activeCards.map((card, idx) => {
          const indexFromEnd = activeCards.length - 1 - idx;
          const inContext = indexFromEnd < MAX_ACTIVE_ANNOTATIONS;
          return {
            kind: 'card' as const,
            id: `c-${card.id}`,
            annotationId: card.id,
            summary: card.summary,
            body: card.body,
            itemKind: activeSideChat.itemKind,
            referenceCode: activeSideChat.pinnedItem.referenceCode,
            inContext,
            timestamp: card.timestamp,
          };
        });
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
