import {
  Check,
  ChevronRight,
  HelpCircle,
  Loader2,
  PencilLine,
  RefreshCw,
  SendHorizonal,
  Sparkles,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type SVGProps } from 'react';

import { useSideChat } from '@/client/components/side-chat-host.js';
import {
  streamSideChatResponse,
  type SideChatPriorTurn,
  type SideChatStreamEvent,
} from '@/client/lib/side-chat-stream.js';
import { cn } from '@/client/lib/utils';
import { queryClient } from '@/client/query-client.js';
import { specificationQueryKeys } from '@/client/routes/specification/$id/-specification-data.js';
import type { EntitiesData, ThreadTurn } from '@/shared/api-types.js';
import type { KnowledgeKind } from '@/shared/knowledge.js';

import { usePatchList, usePatchListState, useStagedPatches } from './patch-list-host.js';

type NonInterviewThreadKind = 'side' | 'reconciliation' | 'qa' | 'agent_run';

// Mode-aligned labels (Ask/Edit/Reconcile per UNIFIED_CHAT_UX.md §2).
// `agent_run` has no user mode and falls back to a short substrate label.
const THREAD_KIND_LABEL: Record<NonInterviewThreadKind, string> = {
  side: 'Edit',
  reconciliation: 'Reconcile',
  qa: 'Ask',
  agent_run: 'Agent',
};

// Per-kind accent hex (parallel to `kindAccentHex` in knowledge-card.tsx).
// Used as a subtle chip tint + matching text color; the surrounding card
// stays neutral chrome per UNIFIED_CHAT_UX.md §7 decision 3.
const THREAD_KIND_ACCENT_HEX: Record<NonInterviewThreadKind, string> = {
  side: '#2563eb',
  reconciliation: '#d97706',
  qa: '#16a34a',
  agent_run: '#9333ea',
};

const THREAD_KIND_ICON: Record<NonInterviewThreadKind, ComponentType<SVGProps<SVGSVGElement>>> = {
  side: PencilLine,
  reconciliation: RefreshCw,
  qa: HelpCircle,
  agent_run: Sparkles,
};

function isKnownThreadKind(kind: string): kind is NonInterviewThreadKind {
  return kind === 'side' || kind === 'reconciliation' || kind === 'qa' || kind === 'agent_run';
}

// ---------------------------------------------------------------------------
// Target-item resolution from entities cache
// ---------------------------------------------------------------------------

interface ResolvedTargetItem {
  kind: KnowledgeKind;
  referenceCode: string;
  content: string;
}

function resolveTargetItemFromCache(specificationId: number, itemId: number): ResolvedTargetItem | null {
  const data = queryClient.getQueryData(
    specificationQueryKeys.entitiesProjectWide(String(specificationId)),
  ) as EntitiesData | undefined;
  if (!data) return null;

  const groups: ReadonlyArray<
    readonly [KnowledgeKind, ReadonlyArray<{ id: number; referenceCode?: string | null; content: string }>]
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
      if (item.id === itemId && item.referenceCode) {
        return { kind, referenceCode: item.referenceCode, content: item.content };
      }
    }
  }
  return null;
}

// Edge-target resolution (for propose_edge) — same as side-chat-host.tsx.
function resolveEdgeTargetFromCache(
  specificationId: number,
  referenceCode: string,
): { kind: KnowledgeKind; itemId: number; referenceCode: string } | null {
  const data = queryClient.getQueryData(
    specificationQueryKeys.entitiesProjectWide(String(specificationId)),
  ) as EntitiesData | undefined;
  if (!data) return null;

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

// ---------------------------------------------------------------------------
// Local message type for optimistic streaming state
// ---------------------------------------------------------------------------

interface LocalMessage {
  readonly localId: string;
  readonly role: 'user' | 'assistant';
  readonly text: string;
  readonly pending?: boolean;
  readonly error?: boolean;
}

// ---------------------------------------------------------------------------
// History builder — mirrors buildHistory in side-chat-host.tsx
// ---------------------------------------------------------------------------

function buildHistoryFromTurns(
  persistedTurns: readonly ThreadTurn[],
  localMessages: readonly LocalMessage[],
): SideChatPriorTurn[] {
  const history: SideChatPriorTurn[] = [];

  for (const turn of persistedTurns) {
    if (turn.text.length === 0) continue;
    history.push({ role: turn.role, text: turn.text });
  }

  for (const msg of localMessages) {
    if (msg.pending || msg.error || msg.text.length === 0) {
      // Drop trailing unpaired user message
      if (msg.role === 'assistant' && history.at(-1)?.role === 'user') {
        history.pop();
      }
      continue;
    }
    history.push({ role: msg.role, text: msg.text });
  }

  // Always end on assistant (full pair)
  if (history.at(-1)?.role === 'user') {
    history.pop();
  }
  return history;
}

// ---------------------------------------------------------------------------
// Mode persistence — shares key with side-chat-host for consistency
// ---------------------------------------------------------------------------

const SIDE_CHAT_MODE_STORAGE_KEY = 'brunch.side-chat.mode';

type SideChatMode = 'explore' | 'edit';

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

// ---------------------------------------------------------------------------
// Edit-content summary — mirrors summarizeEditContent in side-chat-host.tsx
// ---------------------------------------------------------------------------

const EDIT_SUMMARY_PREVIEW_LIMIT = 60;

function summarizeEditContent(newContent: string): string {
  const trimmed = newContent.trim();
  if (trimmed.length <= EDIT_SUMMARY_PREVIEW_LIMIT) {
    return `Edit: ${trimmed}`;
  }
  return `Edit: ${trimmed.slice(0, EDIT_SUMMARY_PREVIEW_LIMIT - 1)}…`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface ThreadCollapsibleProps {
  readonly kind: string;
  readonly turnCount: number;
  readonly status: string;
  readonly threadId: number;
  readonly turns?: readonly ThreadTurn[];
  /** Required for inline streaming in side-chat threads. */
  readonly specificationId?: number;
  /** The target knowledge-item ID for the thread. */
  readonly targetItemId?: number | null;
}

export function ThreadCollapsible({
  kind,
  turnCount,
  status,
  threadId,
  turns,
  specificationId,
  targetItemId,
}: ThreadCollapsibleProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const known = isKnownThreadKind(kind);
  const label = known ? THREAD_KIND_LABEL[kind] : kind;
  const accent = known ? THREAD_KIND_ACCENT_HEX[kind] : '#5b5b5b';
  const KindIcon = known ? THREAD_KIND_ICON[kind] : null;

  // --- Inline streaming state (side-chat only) ---
  const canStream = kind === 'side' && specificationId != null && targetItemId != null;
  const [localMessages, setLocalMessages] = useState<LocalMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [mode, setMode] = useState<SideChatMode>(readStoredMode);
  const streamControllerRef = useRef<AbortController | null>(null);
  const isStreaming = localMessages.some((m) => m.pending);

  // --- Patch list integration ---
  const patchList = usePatchList();
  const patchListState = usePatchListState();
  const resolvedItem = canStream ? resolveTargetItemFromCache(specificationId!, targetItemId!) : null;
  const activeStagedPatches = useStagedPatches(
    resolvedItem ? { anchor: { kind: resolvedItem.kind, itemId: targetItemId! } } : undefined,
  );
  const stagedPatchIds = useMemo(() => activeStagedPatches.map((p) => p.id), [activeStagedPatches]);

  // --- Focus routing from SideChatContext ---
  const sideChat = useSideChat();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!sideChat || sideChat.focusedThreadItemId == null || targetItemId == null) return;
    if (sideChat.focusedThreadItemId !== targetItemId) return;

    // This ThreadCollapsible is the target — expand, scroll, and focus.
    setIsExpanded(true);
    sideChat.clearFocusedThread();

    // Defer scroll + focus to next frame so the expanded content is rendered.
    requestAnimationFrame(() => {
      containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      inputRef.current?.focus();
    });
  }, [sideChat, targetItemId]);

  // Reconciliation: when persisted turns grow (server confirmed our messages),
  // clear local messages since they're now in props.turns.
  const prevPersistedCountRef = useRef(turns?.length ?? 0);
  useEffect(() => {
    const count = turns?.length ?? 0;
    if (count > prevPersistedCountRef.current && localMessages.length > 0) {
      setLocalMessages([]);
    }
    prevPersistedCountRef.current = count;
  }, [turns?.length, localMessages.length]);

  // Abort stream on unmount
  useEffect(() => {
    return () => {
      streamControllerRef.current?.abort();
    };
  }, []);

  const toggleMode = useCallback(() => {
    const next: SideChatMode = mode === 'explore' ? 'edit' : 'explore';
    setMode(next);
    writeStoredMode(next);
  }, [mode]);

  const handleApply = useCallback(() => {
    if (!patchList || stagedPatchIds.length === 0) return;
    void patchList.apply(stagedPatchIds);
  }, [patchList, stagedPatchIds]);

  const handleSubmit = useCallback(() => {
    const trimmed = inputText.trim();
    if (!trimmed || isStreaming || !canStream) return;

    const resolved = resolveTargetItemFromCache(specificationId!, targetItemId!);
    if (!resolved) return;

    const message = trimmed;
    setInputText('');

    const now = Date.now();
    const userMsg: LocalMessage = { localId: `u-${now}`, role: 'user', text: message };
    const assistantMsg: LocalMessage = { localId: `a-${now}`, role: 'assistant', text: '', pending: true };

    // Capture history before appending — the new user message is sent as
    // `message`, not as part of `history`.
    const persistedTurns = turns ?? [];
    const history = buildHistoryFromTurns(persistedTurns, localMessages);

    setLocalMessages((prev) => [...prev, userMsg, assistantMsg]);

    const controller = new AbortController();
    streamControllerRef.current = controller;

    let buffered = '';
    let failed = false;

    void (async () => {
      try {
        await streamSideChatResponse(
          {
            specificationId: specificationId!,
            itemKind: resolved.kind,
            itemId: targetItemId!,
            message,
            history: history.length > 0 ? history : undefined,
            signal: controller.signal,
            ...(mode !== 'explore' ? { mode } : {}),
          },
          (event: SideChatStreamEvent) => {
            if (controller.signal.aborted) return;
            if (event.type === 'text-delta') {
              buffered += event.delta;
              const snapshot = buffered;
              setLocalMessages((prev) => prev.map((m) => (m.pending ? { ...m, text: snapshot } : m)));
            } else if (event.type === 'patch-proposal' && patchList) {
              if (event.toolName === 'propose_edit') {
                patchList.stage({
                  kind: 'edit',
                  anchor: { kind: resolved.kind, itemId: targetItemId! },
                  anchorReferenceCode: resolved.referenceCode,
                  summary: summarizeEditContent(event.input.newContent),
                  currentContent: resolved.content,
                  newContent: event.input.newContent,
                  ...(event.input.newRationale ? { newRationale: event.input.newRationale } : {}),
                  ...(event.impact !== undefined ? { impact: event.impact } : {}),
                });
              } else if (event.toolName === 'propose_edge') {
                const target = resolveEdgeTargetFromCache(specificationId!, event.input.targetReferenceCode);
                if (target) {
                  patchList.stage({
                    kind: 'edge',
                    anchor: { kind: resolved.kind, itemId: targetItemId! },
                    anchorReferenceCode: resolved.referenceCode,
                    targetAnchor: { kind: target.kind, itemId: target.itemId },
                    relation: event.input.relation,
                    summary: `Edge: ${resolved.referenceCode} ${event.input.relation.replaceAll('_', ' ')} ${target.referenceCode}`,
                  });
                }
              } else if (event.toolName === 'propose_drill_down') {
                patchList.stage({
                  kind: 'drill-down',
                  anchor: { kind: resolved.kind, itemId: targetItemId! },
                  anchorReferenceCode: resolved.referenceCode,
                  summary: `Drill-down: ${event.input.focusArea}`,
                  focusArea: event.input.focusArea,
                });
              }
            }
          },
        );
      } catch {
        failed = !controller.signal.aborted;
      }

      if (controller.signal.aborted) return;
      if (streamControllerRef.current === controller) {
        streamControllerRef.current = null;
      }

      setLocalMessages((prev) => {
        if (failed) {
          return prev.map((m) =>
            m.pending ? { ...m, text: 'Something went wrong — try again.', pending: false, error: true } : m,
          );
        }
        return prev.flatMap((m) => {
          if (!m.pending) return [m];
          return m.text ? [{ ...m, pending: false }] : [];
        });
      });
    })();
  }, [
    inputText,
    isStreaming,
    canStream,
    specificationId,
    targetItemId,
    turns,
    localMessages,
    mode,
    patchList,
  ]);

  // Combined display: persisted turns + optimistic local messages
  const displayedTurnCount = (turns?.length ?? 0) + localMessages.filter((m) => !m.pending || m.text).length;

  return (
    <div
      ref={containerRef}
      data-testid={`thread-collapsible-${threadId}`}
      className="my-1 rounded-lg border border-rule bg-white shadow-[0_4px_4px_-2px_rgba(0,0,0,0.02),0_2px_2px_-1px_rgba(0,0,0,0.02),0_0_0_1px_rgba(0,0,0,0.08)]"
    >
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        aria-expanded={isExpanded}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
      >
        <ChevronRight
          aria-hidden="true"
          className={cn('size-4 shrink-0 text-hint transition-transform', isExpanded && 'rotate-90')}
        />
        <span
          className="inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[12px] leading-none font-medium"
          style={{ backgroundColor: `${accent}1a`, color: accent }}
        >
          {KindIcon ? <KindIcon aria-hidden="true" className="size-3" /> : null}
          <span>{label}</span>
        </span>
        <span className="text-sub">
          {displayedTurnCount > 0 ? displayedTurnCount : turnCount}{' '}
          {(displayedTurnCount > 0 ? displayedTurnCount : turnCount) === 1 ? 'turn' : 'turns'}
        </span>
        {status === 'closed' && <span className="ml-auto text-[11px] text-hint">closed</span>}
      </button>
      {isExpanded ? (
        <div className="border-t border-rule px-3 py-3 text-sm">
          <div className="flex flex-col gap-2">
            {/* Persisted turns */}
            {turns?.map((turn) => (
              <div
                key={`persisted-${turn.id}`}
                data-testid={`thread-turn-${turn.id}`}
                className={cn(
                  'rounded-md px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap',
                  turn.role === 'user'
                    ? 'ml-4 self-end bg-blue-50 text-foreground'
                    : 'mr-4 self-start bg-muted text-foreground',
                )}
              >
                {turn.text}
              </div>
            ))}

            {/* Optimistic local messages (streaming or awaiting reconciliation) */}
            {localMessages.map((msg) => {
              if (msg.pending && !msg.text) return null;
              return (
                <div
                  key={msg.localId}
                  data-testid={msg.pending ? 'thread-turn-streaming' : `thread-turn-local-${msg.localId}`}
                  className={cn(
                    'rounded-md px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap',
                    msg.role === 'user'
                      ? 'ml-4 self-end bg-blue-50 text-foreground'
                      : 'mr-4 self-start bg-muted text-foreground',
                    msg.error && 'text-destructive',
                  )}
                >
                  {msg.text}
                  {msg.pending && (
                    <Loader2 aria-hidden="true" className="mt-1 size-3 animate-spin text-hint" />
                  )}
                </div>
              );
            })}

            {/* Empty state when nothing to show */}
            {(turns == null || turns.length === 0) && localMessages.length === 0 && (
              <span className="text-sub">No messages yet.</span>
            )}
          </div>

          {/* Staged patches indicator */}
          {canStream && activeStagedPatches.length > 0 && (
            <div
              data-testid={`thread-staged-patches-${threadId}`}
              className="mt-2 flex items-center justify-between rounded-md border border-rule px-2.5 py-1.5 text-[12px]"
            >
              <span className="text-sub">
                {activeStagedPatches.length} {activeStagedPatches.length === 1 ? 'edit' : 'edits'} staged
              </span>
              <button
                type="button"
                disabled={patchListState.isApplying}
                onClick={handleApply}
                className="inline-flex items-center gap-1 rounded bg-blue-600 px-2 py-0.5 text-[11px] font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-40"
              >
                <Check aria-hidden="true" className="size-3" />
                Apply
              </button>
            </div>
          )}

          {/* Inline input — side-chat threads only, when not closed */}
          {canStream && status !== 'closed' && (
            <>
              <form
                data-testid={`thread-input-${threadId}`}
                className="mt-3 flex items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSubmit();
                }}
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={mode === 'edit' ? 'Propose an edit…' : 'Reply…'}
                  disabled={isStreaming}
                  className="min-w-0 flex-1 rounded-md border border-rule bg-transparent px-2.5 py-1.5 text-[13px] text-foreground placeholder:text-hint focus:border-blue-400 focus:outline-none disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={isStreaming || !inputText.trim()}
                  aria-label="Send message"
                  className="inline-flex shrink-0 items-center justify-center rounded-md bg-blue-600 p-1.5 text-white transition-colors hover:bg-blue-700 disabled:opacity-40 disabled:hover:bg-blue-600"
                >
                  {isStreaming ? (
                    <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
                  ) : (
                    <SendHorizonal aria-hidden="true" className="size-3.5" />
                  )}
                </button>
              </form>

              {/* Edit-mode toggle */}
              {patchList && (
                <div className="mt-1.5 flex h-6 items-center justify-between px-0.5 text-[11px]">
                  <span
                    className="inline-flex items-center gap-1"
                    style={{ color: mode === 'edit' ? accent : 'var(--text-hint, #6b6b6b)' }}
                  >
                    <PencilLine className="size-3" aria-hidden />
                    <span className="font-medium">Edit mode</span>
                  </span>
                  <button
                    type="button"
                    aria-label="Edit mode"
                    aria-pressed={mode === 'edit'}
                    title="Toggle edit mode — your messages propose changes for review"
                    onClick={toggleMode}
                    className={cn(
                      'inline-flex h-[18px] items-center rounded-full px-2 text-[10px] font-medium transition-colors',
                      mode === 'edit' ? 'text-white' : 'text-ink',
                    )}
                    style={
                      mode === 'edit' ? { backgroundColor: accent } : { backgroundColor: 'rgba(0,0,0,0.05)' }
                    }
                  >
                    {mode === 'edit' ? 'Edit on' : 'Off'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
