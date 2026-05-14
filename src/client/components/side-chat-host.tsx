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
import {
  streamSideChatResponse,
  type SideChatMode,
  type SideChatPriorTurn,
} from '@/client/lib/side-chat-stream.js';
import { queryClient } from '@/client/query-client.js';
import { specificationQueryKeys } from '@/client/routes/specification/$id/-specification-data.js';
import type { EntitiesData, SpecificationState } from '@/shared/api-types.js';
import type { KnowledgeKind } from '@/shared/knowledge.js';

import {
  useLastBatchAppliedMeta,
  usePatchList,
  usePatchListState,
  useStagedPatches,
} from './patch-list-host.js';
import { PatchListOverlayBridgeProvider } from './patch-list-overlay-bridge.js';
import { PatchListUndoProvider } from './patch-list-undo-context.js';
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
  clearSpanHint: () => void;
  promoteAnnotation: (annotationId: number) => void;
  setMode: (mode: SideChatMode) => void;
  /** When set, the ThreadCollapsible for this item should expand, scroll into view, and focus its input. */
  focusedThreadItemId: number | null;
  clearFocusedThread: () => void;
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
  // V2 chat-driven mode: 'explore' (default) keeps free-form chat; 'edit' tells the
  // server to register the propose_edit tool so the LLM can stage edit patches.
  mode: SideChatMode;
}

interface LoadedAnnotations {
  itemKind: KnowledgeKind;
  itemId: number;
  batchId: string | null;
  items: readonly CreatedAnnotation[];
}

// Cap on how many characters of an edit's newContent we put into the
// patch-list summary string. Tunes the at-a-glance label visible in the
// top-bar `N Edits` overlay before the user clicks through.
const EDIT_SUMMARY_PREVIEW_LIMIT = 60;

function summarizeEditContent(newContent: string): string {
  const trimmed = newContent.trim();
  if (trimmed.length <= EDIT_SUMMARY_PREVIEW_LIMIT) {
    return `Edit: ${trimmed}`;
  }
  return `Edit: ${trimmed.slice(0, EDIT_SUMMARY_PREVIEW_LIMIT - 1)}…`;
}

interface ResolvedEdgeTarget {
  kind: KnowledgeKind;
  itemId: number;
  referenceCode: string;
}

// Resolve a referenceCode (e.g. "G3", "D7") to the corresponding
// (kind, itemId) by reading the project-wide entities cache. Returns null if
// no entity matches — propose_edge events with unresolvable references are
// silently dropped client-side; the LLM occasionally hallucinates codes.
function resolveEdgeTarget(specificationId: number, referenceCode: string): ResolvedEdgeTarget | null {
  const data = queryClient.getQueryData(
    specificationQueryKeys.entitiesProjectWide(String(specificationId)),
  ) as EntitiesData | undefined;
  if (!data) {
    return null;
  }
  const groups: ReadonlyArray<
    readonly [KnowledgeKind, ReadonlyArray<{ id: number; referenceCode?: string | null }>]
  > = [
    ['goal', data.goals],
    ['term', data.terms],
    ['context', data.contexts],
    ['constraint', data.constraints],
    ['decision', data.decisions],
    ['assumption', data.assumptions],
    ['requirement', data.requirements],
    ['criterion', data.criteria],
  ];
  for (const [kind, items] of groups) {
    for (const item of items) {
      if (item.referenceCode === referenceCode) {
        return { kind, itemId: item.id, referenceCode };
      }
    }
  }
  return null;
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

function appliedPreviousContent(applied: unknown): string | null {
  if (!applied || typeof applied !== 'object' || !('previousContent' in applied)) {
    return null;
  }
  const previousContent = (applied as { previousContent?: unknown }).previousContent;
  return typeof previousContent === 'string' ? previousContent : null;
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
const SIDE_CHAT_MODE_STORAGE_KEY = 'brunch.side-chat.mode';

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

// Card 4 follow-up: Edit-mode toggle persists across sessions and pinned items
// so the user's last preference survives reload. A new pinned item adopts the
// stored mode rather than always falling back to 'explore'.
function readStoredMode(): SideChatMode {
  if (typeof window === 'undefined') return 'explore';
  try {
    return window.localStorage.getItem(SIDE_CHAT_MODE_STORAGE_KEY) === 'edit' ? 'edit' : 'explore';
  } catch {
    return 'explore';
  }
}

function writeStoredMode(mode: SideChatMode): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SIDE_CHAT_MODE_STORAGE_KEY, mode);
  } catch {
    // Storage may be unavailable; ignore.
  }
}

interface ActiveCard {
  id: number;
  itemKind: KnowledgeKind;
  referenceCode: string;
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
  const [focusedThreadItemId, setFocusedThreadItemId] = useState<number | null>(null);
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

  const clearFocusedThread = useCallback(() => {
    setFocusedThreadItemId(null);
  }, []);

  const openFor = useCallback(
    (item: SideChatPinnableItem) => {
      // Check if an inline side-chat thread already exists for this item in the
      // spec state cache. If so, route to the inline ThreadCollapsible instead
      // of opening the popover (progressive popover retirement).
      const specState = queryClient.getQueryData(specificationQueryKeys.bundle(String(specificationId))) as
        | SpecificationState
        | undefined;
      const existingThread = specState?.threads?.find(
        (t) => t.kind === 'side' && t.target_item_id === item.id && t.status === 'open',
      );
      if (existingThread) {
        // Dismiss any open popover — the inline thread is primary.
        if (activeRef.current) {
          abortActiveStream();
          activeRef.current = null;
          setActiveSideChat(null);
          setActiveCards([]);
          setPendingSpanHint(null);
        }
        setFocusedThreadItemId(item.id);
        return;
      }

      // No thread yet — fall back to the popover, which still owns edit mode,
      // patch staging, and annotation features the inline thread doesn't have.
      // The popover's first message will create the thread server-side; next
      // time the user clicks "Chat" on this item, the thread exists and we
      // route inline above.
      const current = activeRef.current;
      if (current && current.itemKind === item.kind && current.itemId === item.id) {
        const nextActiveSideChat = {
          ...current,
          pinnedItem: { referenceCode: item.referenceCode, content: item.content, kind: item.kind },
        };
        activeRef.current = nextActiveSideChat;
        setActiveSideChat((active) =>
          active && active.itemKind === item.kind && active.itemId === item.id ? nextActiveSideChat : active,
        );
        return;
      }

      abortActiveStream();
      sessionCounterRef.current += 1;
      setActiveCards([]);
      setPendingSpanHint(null);
      const nextActiveSideChat: ActiveSideChat = {
        sessionId: sessionCounterRef.current,
        pinnedItem: { referenceCode: item.referenceCode, content: item.content, kind: item.kind },
        itemKind: item.kind,
        itemId: item.id,
        messages: [],
        messageTimestamps: [],
        annotateMode: false,
        mode: readStoredMode(),
      };
      activeRef.current = nextActiveSideChat;
      setActiveSideChat(nextActiveSideChat);
    },
    [abortActiveStream, specificationId],
  );

  const openWithSpanHint = useCallback(
    (item: SideChatPinnableItem, hint: string) => {
      openFor(item);
      setPendingSpanHint(hint);
    },
    [openFor],
  );

  const clearSpanHint = useCallback(() => {
    setPendingSpanHint(null);
  }, []);

  const dismiss = useCallback(() => {
    abortActiveStream();
    activeRef.current = null;
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

  const setMode = useCallback((mode: SideChatMode) => {
    // Persist before mutating in-memory state so a later reload (or a fresh
    // pin via openFor) sees the latest preference even if the active session
    // is dismissed before the next render commits.
    writeStoredMode(mode);
    const current = activeRef.current;
    if (!current) {
      return;
    }
    const nextActiveSideChat = { ...current, mode };
    activeRef.current = nextActiveSideChat;
    setActiveSideChat((active) =>
      active && active.sessionId === current.sessionId ? nextActiveSideChat : active,
    );
  }, []);

  // Ref to patchList so submitMessage's onChunk handler can stage patch-proposal
  // events without taking patchList as a useCallback dep (which would re-create
  // submitMessage and remount the popover composer on patch-list changes).
  const patchListRef = useRef<ReturnType<typeof usePatchList>>(null);

  const pushActiveCard = useCallback((card: Omit<ActiveCard, 'timestamp'>) => {
    setActiveCards((prev) =>
      prev.some((existing) => existing.id === card.id) ? prev : [...prev, { ...card, timestamp: Date.now() }],
    );
  }, []);
  const dismissCard = useCallback((annotationId: number) => {
    setActiveCards((prev) => prev.filter((card) => card.id !== annotationId));
  }, []);
  const activeCardIds: readonly number[] = useMemo(() => activeCards.map((card) => card.id), [activeCards]);

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
        referenceCode: card.referenceCode,
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
              ...(session.mode !== 'explore' ? { mode: session.mode } : {}),
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
              } else if (event.type === 'patch-proposal' && event.toolName === 'propose_edit') {
                const patchList = patchListRef.current;
                if (!patchList) {
                  return;
                }
                patchList.stage({
                  kind: 'edit',
                  anchor: { kind: session.itemKind, itemId: session.itemId },
                  anchorReferenceCode: session.pinnedItem.referenceCode,
                  summary: summarizeEditContent(event.input.newContent),
                  // Capture the live current content at stage time so the
                  // canonical PatchListOverlay can render a word-level
                  // <ContentDiff> without re-querying the entity store.
                  // session.pinnedItem.content tracks live saved content via
                  // the apply-time refresh effect (FE-665 follow-up).
                  currentContent: session.pinnedItem.content,
                  newContent: event.input.newContent,
                  ...(event.input.newRationale ? { newRationale: event.input.newRationale } : {}),
                  ...(event.impact !== undefined ? { impact: event.impact } : {}),
                });
              } else if (event.type === 'patch-proposal' && event.toolName === 'propose_edge') {
                const patchList = patchListRef.current;
                if (!patchList) {
                  return;
                }
                const target = resolveEdgeTarget(specificationId, event.input.targetReferenceCode);
                if (!target) {
                  return;
                }
                patchList.stage({
                  kind: 'edge',
                  anchor: { kind: session.itemKind, itemId: session.itemId },
                  anchorReferenceCode: session.pinnedItem.referenceCode,
                  targetAnchor: { kind: target.kind, itemId: target.itemId },
                  relation: event.input.relation,
                  summary: `Edge: ${session.pinnedItem.referenceCode} ${event.input.relation.replaceAll('_', ' ')} ${target.referenceCode}`,
                });
              } else if (event.type === 'patch-proposal' && event.toolName === 'propose_drill_down') {
                const patchList = patchListRef.current;
                if (!patchList) {
                  return;
                }
                patchList.stage({
                  kind: 'drill-down',
                  anchor: { kind: session.itemKind, itemId: session.itemId },
                  anchorReferenceCode: session.pinnedItem.referenceCode,
                  summary: `Drill-down: ${event.input.focusArea}`,
                  focusArea: event.input.focusArea,
                });
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
  patchListRef.current = patchList;
  const patchListState = usePatchListState();
  const stagedForActive = useStagedPatches(
    activeSideChat ? { anchor: { kind: activeSideChat.itemKind, itemId: activeSideChat.itemId } } : undefined,
  );

  const submitAnnotate = useCallback(
    (summary: string, body: string) => {
      if (!activeSideChat || !patchList) {
        return;
      }
      patchList.stage({
        kind: 'annotate',
        anchor: { kind: activeSideChat.itemKind, itemId: activeSideChat.itemId },
        anchorReferenceCode: activeSideChat.pinnedItem.referenceCode,
        summary,
        body,
      });
      setActiveSideChat((current) => (current ? { ...current, annotateMode: false } : current));
    },
    [activeSideChat, patchList],
  );

  const stagedSummaries: readonly SideChatStagedPatchSummary[] = stagedForActive.map((patch) => ({
    id: patch.id,
    kind: patch.kind,
    summary: patch.summary,
    ...(patch.kind === 'edit' && patch.impact !== undefined ? { impact: patch.impact } : {}),
    // FE-665: when an edit patch targets the currently-pinned item, surface
    // the before/after pair so the staged-patch row can render a word-level
    // <ContentDiff> in its expander. pinnedItem.content tracks the live
    // saved content via the apply-time refresh effect below, so this stays
    // an honest "current vs proposed" view.
    ...(patch.kind === 'edit' &&
    activeSideChat &&
    patch.anchor.kind === activeSideChat.itemKind &&
    patch.anchor.itemId === activeSideChat.itemId
      ? { currentContent: activeSideChat.pinnedItem.content, newContent: patch.newContent }
      : {}),
  }));
  const stagedForActiveIds = useMemo(() => stagedForActive.map((patch) => patch.id), [stagedForActive]);
  const canUndoForActive =
    patchListState.canUndo &&
    activeSideChat !== null &&
    patchListState.lastBatchPatches.some(
      (patch) =>
        patch.anchor.kind === activeSideChat.itemKind && patch.anchor.itemId === activeSideChat.itemId,
    );
  const lastBatchAppliedMeta = useLastBatchAppliedMeta();

  const triggeredAutoApplyIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!patchList || patchListState.isApplying) return;
    const triggered = triggeredAutoApplyIdsRef.current;
    const stagedIds = new Set(patchListState.staged.map((patch) => patch.id));
    for (const id of triggered) {
      if (!stagedIds.has(id)) triggered.delete(id);
    }
    const allAutoApplyable = stagedForActive.every((patch) => patch.kind === 'annotate');
    if (stagedForActive.length === 0 || !allAutoApplyable) return;
    const hasUntriggered = stagedForActive.some((patch) => !triggered.has(patch.id));
    if (!hasUntriggered) return;
    for (const patch of stagedForActive) {
      triggered.add(patch.id);
    }
    void patchList.apply(stagedForActiveIds);
  }, [patchList, patchListState.staged, patchListState.isApplying, stagedForActive, stagedForActiveIds]);

  const applyStagedForActive = useCallback(() => {
    if (!patchList || stagedForActiveIds.length === 0) {
      return;
    }
    void patchList.apply(stagedForActiveIds);
  }, [patchList, stagedForActiveIds]);

  const patchListOverlayBridge = useMemo(
    () => ({
      applyScoped: applyStagedForActive,
      scopedPatchIds: stagedForActiveIds,
    }),
    [applyStagedForActive, stagedForActiveIds],
  );

  const undoForActive = useCallback(() => {
    if (!patchList) {
      return;
    }
    if (!activeSideChat) {
      void patchList.undo();
      return;
    }
    const activeItemKind = activeSideChat.itemKind;
    const activeItemId = activeSideChat.itemId;
    const appliedByPatchId = new Map(lastBatchAppliedMeta.map((meta) => [meta.patchId, meta.applied]));
    const revertedContent = patchListState.lastBatchPatches
      .filter(
        (patch) =>
          patch.kind === 'edit' &&
          patch.anchor.kind === activeItemKind &&
          patch.anchor.itemId === activeItemId,
      )
      .map((patch) => appliedPreviousContent(appliedByPatchId.get(patch.id)))
      .find((content): content is string => content !== null);

    void (async () => {
      const undone = await patchList.undo();
      if (!undone || revertedContent === undefined) {
        return;
      }
      setActiveSideChat((current) =>
        current && current.itemKind === activeItemKind && current.itemId === activeItemId
          ? { ...current, pinnedItem: { ...current.pinnedItem, content: revertedContent } }
          : current,
      );
      if (
        activeRef.current &&
        activeRef.current.itemKind === activeItemKind &&
        activeRef.current.itemId === activeItemId
      ) {
        activeRef.current = {
          ...activeRef.current,
          pinnedItem: { ...activeRef.current.pinnedItem, content: revertedContent },
        };
      }
    })();
  }, [patchList, activeSideChat, lastBatchAppliedMeta, patchListState.lastBatchPatches]);

  const lastSeenBatchIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (patchListState.lastBatchId === lastSeenBatchIdRef.current) return;
    lastSeenBatchIdRef.current = patchListState.lastBatchId;
    if (!activeSideChat) return;
    const patchesById = new Map(patchListState.lastBatchPatches.map((patch) => [patch.id, patch]));
    for (const meta of lastBatchAppliedMeta) {
      if (meta.applied && typeof meta.applied === 'object' && 'id' in meta.applied) {
        const sourcePatch = patchesById.get(meta.patchId);
        if (
          !sourcePatch ||
          sourcePatch.anchor.kind !== activeSideChat.itemKind ||
          sourcePatch.anchor.itemId !== activeSideChat.itemId
        ) {
          continue;
        }
        const applied = meta.applied as { id: unknown; summary?: unknown; body?: unknown };
        const summary = typeof applied.summary === 'string' ? applied.summary.trim() : '';
        if (typeof applied.id === 'number' && summary.length > 0) {
          pushActiveCard({
            id: applied.id,
            itemKind: activeSideChat.itemKind,
            referenceCode: activeSideChat.pinnedItem.referenceCode,
            summary,
            body: typeof applied.body === 'string' ? applied.body : '',
          });
        }
      }
    }
    // V2 chat-driven edits: when an edit patch applied to the active pinned
    // item, refresh the popover's pinned-item snapshot so the chat header
    // reflects the new content. Without this, the structured-list / graph
    // view re-fetches and updates (per makeEditApplier's cache invalidation),
    // but the side-chat popover keeps showing the pre-edit content because
    // pinnedItem was captured at openFor() time.
    const appliedByPatchIdForRefresh = new Map(
      lastBatchAppliedMeta.map((meta) => [meta.patchId, meta.applied]),
    );
    for (const patch of patchListState.lastBatchPatches) {
      if (
        patch.kind === 'edit' &&
        patch.anchor.kind === activeSideChat.itemKind &&
        patch.anchor.itemId === activeSideChat.itemId
      ) {
        const applied = appliedByPatchIdForRefresh.get(patch.id);
        const isDeferred =
          !!applied && typeof applied === 'object' && (applied as { deferred?: unknown }).deferred === true;
        if (isDeferred) continue;
        const nextContent = patch.newContent;
        setActiveSideChat((current) =>
          current && current.itemKind === patch.anchor.kind && current.itemId === patch.anchor.itemId
            ? { ...current, pinnedItem: { ...current.pinnedItem, content: nextContent } }
            : current,
        );
        if (
          activeRef.current &&
          activeRef.current.itemKind === patch.anchor.kind &&
          activeRef.current.itemId === patch.anchor.itemId
        ) {
          activeRef.current = {
            ...activeRef.current,
            pinnedItem: { ...activeRef.current.pinnedItem, content: nextContent },
          };
        }
      }
    }
  }, [
    activeSideChat,
    patchListState.lastBatchId,
    patchListState.lastBatchPatches,
    lastBatchAppliedMeta,
    pushActiveCard,
  ]);

  const activeItemId = activeSideChat?.itemId;
  const activeItemKind = activeSideChat?.itemKind;
  const [annotations, setAnnotations] = useState<LoadedAnnotations | null>(null);
  const annotationsRef = useRef<LoadedAnnotations | null>(null);
  useEffect(() => {
    annotationsRef.current = annotations;
  }, [annotations]);
  useEffect(() => {
    if (activeItemId === undefined || activeItemKind === undefined) {
      setAnnotations(null);
      return;
    }
    let cancelled = false;
    const batchId = patchListState.lastBatchId;
    annotationsRef.current = null;
    setAnnotations(null);
    void listAnnotationsForSpecificationRequest(specificationId)
      .then((list) => {
        if (!cancelled) {
          const loaded = { itemKind: activeItemKind, itemId: activeItemId, batchId, items: list };
          annotationsRef.current = loaded;
          setAnnotations(loaded);
        }
      })
      .catch(() => {
        if (!cancelled) {
          annotationsRef.current = null;
          setAnnotations(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeItemId, activeItemKind, specificationId, patchListState.lastBatchId]);

  useEffect(() => {
    if (activeItemId === undefined || annotations === null) return;
    if (
      annotations.itemId !== activeItemId ||
      annotations.itemKind !== activeItemKind ||
      annotations.batchId !== patchListState.lastBatchId
    ) {
      return;
    }
    const annotationIdsForActiveItem = new Set(
      annotations.items
        .filter((annotation) => annotation.knowledge_item_id === activeItemId)
        .map((annotation) => annotation.id),
    );
    setActiveCards((prev) => prev.filter((card) => annotationIdsForActiveItem.has(card.id)));
  }, [activeItemId, activeItemKind, annotations, patchListState.lastBatchId]);

  const existingAnnotations: readonly SideChatExistingAnnotation[] = activeSideChat
    ? (annotations?.items ?? [])
        .filter((annotation) => annotation.knowledge_item_id === activeSideChat.itemId)
        .map((annotation) => ({
          id: annotation.id,
          summary: annotation.summary,
          body: annotation.body,
        }))
    : [];

  const promoteAnnotation = useCallback((annotationId: number) => {
    const annotation = (annotationsRef.current?.items ?? []).find((a) => a.id === annotationId);
    const active = activeRef.current;
    if (!annotation || !active) return;
    setActiveCards((prev) => {
      if (prev.some((card) => card.id === annotationId)) return prev;
      return [
        ...prev,
        {
          id: annotation.id,
          itemKind: active.itemKind,
          referenceCode: active.pinnedItem.referenceCode,
          summary: annotation.summary,
          body: annotation.body,
          timestamp: Date.now(),
        },
      ];
    });
  }, []);
  const sideChatContextValue = useMemo(
    () => ({
      openFor,
      openWithSpanHint,
      activeCardIds,
      dismissCard,
      clearSpanHint,
      promoteAnnotation,
      setMode,
      focusedThreadItemId,
      clearFocusedThread,
    }),
    [
      openFor,
      openWithSpanHint,
      activeCardIds,
      dismissCard,
      clearSpanHint,
      promoteAnnotation,
      setMode,
      focusedThreadItemId,
      clearFocusedThread,
    ],
  );

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
            itemKind: card.itemKind,
            referenceCode: card.referenceCode,
            inContext,
            timestamp: card.timestamp,
          };
        });
        return [...messageItems, ...cardItems].sort((a, b) => a.timestamp - b.timestamp);
      })()
    : [];

  const docksContent = activeSideChat !== null && layout === 'docked';

  return (
    <PatchListUndoProvider undo={undoForActive}>
      <PatchListOverlayBridgeProvider value={patchListOverlayBridge}>
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
              mode={activeSideChat.mode}
              onModeChange={patchList ? setMode : undefined}
              stagedPatches={stagedSummaries}
              canUndo={canUndoForActive}
              isApplying={patchListState.isApplying}
              onApply={patchList && stagedForActiveIds.length > 0 ? applyStagedForActive : undefined}
              onUndo={patchList ? undoForActive : undefined}
              onDiscardPatch={patchList?.discard}
              existingAnnotations={existingAnnotations}
              onPromoteAnnotation={promoteAnnotation}
              activeAnnotationIds={activeCardIds}
              layout={layout}
              onLayoutChange={setLayout}
              spanHint={pendingSpanHint}
              onClearSpanHint={clearSpanHint}
            />
          )}
        </SideChatContext.Provider>
      </PatchListOverlayBridgeProvider>
    </PatchListUndoProvider>
  );
}
