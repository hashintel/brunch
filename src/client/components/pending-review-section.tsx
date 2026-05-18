import {
  Check,
  CheckCheck,
  Forward,
  Loader2,
  MessageSquare,
  PencilLine,
  Play,
  Replace,
  RotateCw,
  Wand2,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import {
  editKnowledgeItemRequest,
  resetReconciliationNeedAgentRequest,
  resolveReconciliationNeedRequest,
  runReconciliationAgentRequest,
} from '@/client/lib/edit-api.js';
import {
  invalidateOpenReconciliationNeeds,
  refetchOpenReconciliationNeedsData,
  useSpecificationOpenReconciliationNeeds,
} from '@/client/routes/specification/$id/-specification-data.js';
import type { ReconciliationNeedRecord } from '@/shared/reconciliation-need.js';

import { ClassificationChip } from './classification-chip.js';
import { DiffPopover } from './diff-popover.js';
import { useSecondaryChatTrigger } from './secondary-chat-trigger.js';

// Per-row inline edit state. Keyed by need id so expanding one row's edit
// form doesn't perturb other rows. Absence from the map means the row is not
// in edit mode. Saving runs editKnowledgeItemRequest then the existing
// resolve endpoint, so re-entrant cascades (a hard apply opening new needs)
// surface in the same Pending review section after the next refetch.
type EditDraftMap = ReadonlyMap<number, string>;

// FE-716 C30 follow-up: monochrome vocabulary matching <ChatShellPatchPanel>.
// One dark primary-action shape (composer-send pedigree) + neutral hint/ink
// icon affordances. ClassificationChip (its own component) still carries its
// per-variant chrome — those tints encode semantic state, not decoration.
const PRIMARY_BUTTON_CLASS =
  'inline-flex items-center gap-1 rounded-md bg-[#202020] px-2 py-0.5 text-[10px] font-medium text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),0_0_0_1px_#101010] hover:enabled:bg-[#000] disabled:bg-[#e3e3e3] disabled:text-[#a6a6a6] disabled:shadow-none';
const ICON_BUTTON_CLASS =
  'inline-flex size-6 items-center justify-center rounded text-hint opacity-60 transition-opacity group-hover/need-row:opacity-100 hover:bg-tint hover:text-ink hover:opacity-100 focus-visible:opacity-100 disabled:opacity-30';
const PRIMARY_ICON_BUTTON_CLASS =
  'inline-flex size-6 items-center justify-center rounded-md bg-[#202020] text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),0_0_0_1px_#101010] hover:enabled:bg-[#000] disabled:bg-[#e3e3e3] disabled:text-[#a6a6a6] disabled:shadow-none';

const TARGET_EXCERPT_LIMIT = 80;

/** Avoids an infinite loop if the open-needs list never converges during bulk work. */
const MAX_BULK_OPEN_NEED_STEPS = 500;

function truncate(text: string, limit: number): string {
  if (text.length <= limit) return text;
  return `${text.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
}

function isAutoConfirmNeed(need: ReconciliationNeedRecord): boolean {
  return need.agent_status === 'classified' && need.agent_classification === 'auto-confirm';
}

function isAutoEditNeed(
  need: ReconciliationNeedRecord,
): need is ReconciliationNeedRecord & { agent_proposal: string; target_current_content: string } {
  return (
    need.agent_status === 'classified' &&
    need.agent_classification === 'auto-edit' &&
    need.agent_proposal !== null &&
    need.target_current_content !== null
  );
}

export function PendingReviewSection(): React.ReactElement | null {
  const openNeeds = useSpecificationOpenReconciliationNeeds();
  const [resolvingNeedIds, setResolvingNeedIds] = useState<ReadonlySet<number>>(() => new Set());
  const [editDrafts, setEditDrafts] = useState<EditDraftMap>(() => new Map());
  const [savingNeedIds, setSavingNeedIds] = useState<ReadonlySet<number>>(() => new Set());
  const [resettingNeedIds, setResettingNeedIds] = useState<ReadonlySet<number>>(() => new Set());
  const [applyingNeedIds, setApplyingNeedIds] = useState<ReadonlySet<number>>(() => new Set());
  const [isRunningAgent, setIsRunningAgent] = useState(false);
  const [bulkOperation, setBulkOperation] = useState<null | 'confirm' | 'apply'>(null);
  const [diffPopoverNeedId, setDiffPopoverNeedId] = useState<{
    needId: number;
    mode: 'source-diff' | 'agent-proposal';
  } | null>(null);
  const diffAnchorRef = useRef<HTMLButtonElement | null>(null);
  const secondaryChatTrigger = useSecondaryChatTrigger();

  useEffect(() => {
    if (diffPopoverNeedId === null) return;
    if (!openNeeds.some((need) => need.id === diffPopoverNeedId.needId)) {
      setDiffPopoverNeedId(null);
      diffAnchorRef.current = null;
    }
  }, [openNeeds, diffPopoverNeedId]);

  if (openNeeds.length === 0) {
    return null;
  }

  const inflightAgentCount = openNeeds.filter(
    (need) => need.agent_status === 'queued' || need.agent_status === 'classifying',
  ).length;
  const agentClassifiedSuccessCount = openNeeds.filter((need) => need.agent_status === 'classified').length;
  const agentFailedCount = openNeeds.filter((need) => need.agent_status === 'failed').length;
  const unclassifiedAgentCount = openNeeds.filter((need) => need.agent_status === null).length;
  const agentInFlight = inflightAgentCount > 0;
  const specificationId = openNeeds[0]?.specification_id ?? null;
  const autoConfirmRows = openNeeds.filter(isAutoConfirmNeed);
  const autoEditRows = openNeeds.filter(isAutoEditNeed);

  // Idempotent resolve. The button is disabled while the request is in flight
  // so a double-click can't double-fire. Errors propagate; we don't optimistically
  // remove the row before the server confirms.
  const handleResolve = (needId: number, specificationId: number): void => {
    setResolvingNeedIds((prev) => {
      const next = new Set(prev);
      next.add(needId);
      return next;
    });
    void (async () => {
      try {
        await resolveReconciliationNeedRequest(specificationId, needId);
        await invalidateOpenReconciliationNeeds(specificationId);
      } catch (error) {
        console.error('Resolve reconciliation_need %s failed', needId, error);
      } finally {
        setResolvingNeedIds((prev) => {
          const next = new Set(prev);
          next.delete(needId);
          return next;
        });
      }
    })();
  };

  const startEditing = (needId: number, currentContent: string): void => {
    setEditDrafts((prev) => {
      const next = new Map(prev);
      next.set(needId, currentContent);
      return next;
    });
  };

  const cancelEditing = (needId: number): void => {
    setEditDrafts((prev) => {
      const next = new Map(prev);
      next.delete(needId);
      return next;
    });
  };

  const updateDraft = (needId: number, value: string): void => {
    setEditDrafts((prev) => {
      const next = new Map(prev);
      next.set(needId, value);
      return next;
    });
  };

  // Save sequences edit → resolve → invalidate so the row leaves the
  // Pending review section atomically from the user's POV. If the edit
  // itself triggers a hard cascade (impact === 'hard'), the new needs
  // appear in the same section after invalidation; the resolve still
  // closes THIS need.
  const handleSave = (needId: number, specificationId: number, targetItemId: number): void => {
    const draft = editDrafts.get(needId);
    if (draft === undefined) return;
    setSavingNeedIds((prev) => {
      const next = new Set(prev);
      next.add(needId);
      return next;
    });
    void (async () => {
      try {
        await editKnowledgeItemRequest(specificationId, targetItemId, { content: draft });
        await resolveReconciliationNeedRequest(specificationId, needId);
        await invalidateOpenReconciliationNeeds(specificationId);
        cancelEditing(needId);
      } finally {
        setSavingNeedIds((prev) => {
          const next = new Set(prev);
          next.delete(needId);
          return next;
        });
      }
    })();
  };

  const handleRunAgent = (): void => {
    if (specificationId === null || isRunningAgent || agentInFlight) return;
    setIsRunningAgent(true);
    void (async () => {
      try {
        await runReconciliationAgentRequest(specificationId);
        await invalidateOpenReconciliationNeeds(specificationId);
      } catch (error) {
        console.error('runReconciliationAgent failed', error);
      } finally {
        setIsRunningAgent(false);
      }
    })();
  };

  const handleApplyProposal = (need: ReconciliationNeedRecord): void => {
    if (need.agent_proposal === null || need.target_current_content === null) return;
    setApplyingNeedIds((prev) => {
      const next = new Set(prev);
      next.add(need.id);
      return next;
    });
    void (async () => {
      try {
        await editKnowledgeItemRequest(need.specification_id, need.target_item_id, {
          content: need.agent_proposal ?? '',
        });
        await resolveReconciliationNeedRequest(need.specification_id, need.id);
        await invalidateOpenReconciliationNeeds(need.specification_id);
      } catch (error) {
        console.error('apply proposal for need %s failed', need.id, error);
      } finally {
        setApplyingNeedIds((prev) => {
          const next = new Set(prev);
          next.delete(need.id);
          return next;
        });
      }
    })();
  };

  const handleOpenSideChat = (need: ReconciliationNeedRecord): void => {
    if (
      secondaryChatTrigger === null ||
      !secondaryChatTrigger.canCreate ||
      secondaryChatTrigger.isPending ||
      need.target_item_kind === null
    ) {
      return;
    }
    void secondaryChatTrigger.create({
      kind: need.target_item_kind,
      id: need.target_item_id,
      reconciliationNeedId: need.id,
    });
  };

  const handleConfirmAll = (): void => {
    if (specificationId === null || bulkOperation !== null || autoConfirmRows.length === 0) return;
    setBulkOperation('confirm');
    const specId = specificationId;
    void (async () => {
      const failedNeedIds = new Set<number>();
      try {
        for (let step = 0; step < MAX_BULK_OPEN_NEED_STEPS; step++) {
          const fresh = await refetchOpenReconciliationNeedsData(specId);
          const next = fresh.filter(isAutoConfirmNeed).find((need) => !failedNeedIds.has(need.id));
          if (next === undefined) break;
          try {
            await resolveReconciliationNeedRequest(next.specification_id, next.id);
          } catch (error) {
            failedNeedIds.add(next.id);
            console.error('bulk confirm need %s failed', next.id, error);
          }
        }
      } finally {
        setBulkOperation(null);
      }
    })();
  };

  const handleApplyAllSuggested = (): void => {
    if (specificationId === null || bulkOperation !== null || autoEditRows.length === 0) return;
    setBulkOperation('apply');
    const specId = specificationId;
    void (async () => {
      const failedNeedIds = new Set<number>();
      try {
        for (let step = 0; step < MAX_BULK_OPEN_NEED_STEPS; step++) {
          const fresh = await refetchOpenReconciliationNeedsData(specId);
          const next = fresh.filter(isAutoEditNeed).find((need) => !failedNeedIds.has(need.id));
          if (next === undefined) break;
          try {
            await editKnowledgeItemRequest(next.specification_id, next.target_item_id, {
              content: next.agent_proposal,
            });
            await resolveReconciliationNeedRequest(next.specification_id, next.id);
          } catch (error) {
            failedNeedIds.add(next.id);
            console.error('bulk apply need %s failed', next.id, error);
          }
        }
      } finally {
        setBulkOperation(null);
      }
    })();
  };

  const handleResetAgent = (needId: number, needSpecId: number): void => {
    setResettingNeedIds((prev) => {
      const next = new Set(prev);
      next.add(needId);
      return next;
    });
    void (async () => {
      try {
        await resetReconciliationNeedAgentRequest(needSpecId, needId);
        await invalidateOpenReconciliationNeeds(needSpecId);
      } catch (error) {
        console.error('resetReconciliationNeedAgent %s failed', needId, error);
      } finally {
        setResettingNeedIds((prev) => {
          const next = new Set(prev);
          next.delete(needId);
          return next;
        });
      }
    })();
  };

  const activePopoverNeed = diffPopoverNeedId
    ? (openNeeds.find((n) => n.id === diffPopoverNeedId.needId) ?? null)
    : null;
  const activePopoverMode = diffPopoverNeedId?.mode ?? null;

  return (
    <div
      role="region"
      aria-label="Pending review"
      data-open-needs-count={openNeeds.length}
      className="flex flex-col gap-1 rounded-lg border border-rule bg-tint/40 px-2 py-1.5 text-xs"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 font-medium text-ink">
          <Replace className="size-3.5 text-hint" aria-hidden />
          {openNeeds.length} pending review{openNeeds.length === 1 ? '' : 's'}
        </span>
        <div className="flex items-center gap-1.5">
          {agentInFlight ? (
            <span data-agent-progress-strip className="inline-flex items-center gap-1 text-[10px] text-hint">
              <Loader2 className="size-3 animate-spin" aria-hidden />
              {agentFailedCount === 0 ? (
                <>
                  Agent: {agentClassifiedSuccessCount} of {openNeeds.length} classified
                </>
              ) : (
                <>
                  Agent: {agentClassifiedSuccessCount} classified · {agentFailedCount} failed (
                  {agentClassifiedSuccessCount + agentFailedCount}/{openNeeds.length})
                </>
              )}
            </span>
          ) : null}
          {autoConfirmRows.length > 0 ? (
            <button
              type="button"
              aria-label={`Confirm all ${autoConfirmRows.length} auto-confirm rows`}
              title="Resolve every auto-confirm row in one pass"
              data-bulk-confirm-button
              disabled={bulkOperation !== null || agentInFlight}
              onClick={handleConfirmAll}
              className={PRIMARY_BUTTON_CLASS}
            >
              {bulkOperation === 'confirm' ? (
                <Loader2 className="size-3 animate-spin" aria-hidden />
              ) : (
                <CheckCheck className="size-3" aria-hidden />
              )}
              Confirm all ({autoConfirmRows.length})
            </button>
          ) : null}
          {autoEditRows.length > 0 ? (
            <button
              type="button"
              aria-label={`Apply all ${autoEditRows.length} suggested edits`}
              title="Apply every auto-edit row's proposal and resolve it"
              data-bulk-apply-button
              disabled={bulkOperation !== null || agentInFlight}
              onClick={handleApplyAllSuggested}
              className={PRIMARY_BUTTON_CLASS}
            >
              {bulkOperation === 'apply' ? (
                <Loader2 className="size-3 animate-spin" aria-hidden />
              ) : (
                <Wand2 className="size-3" aria-hidden />
              )}
              Apply all suggested ({autoEditRows.length})
            </button>
          ) : null}
          {unclassifiedAgentCount > 0 ? (
            <button
              type="button"
              aria-label={isRunningAgent ? 'Running agent' : 'Run agent'}
              title={
                agentInFlight ? 'Agent classification in progress' : 'Classify pending reviews with the agent'
              }
              data-run-agent-button
              disabled={isRunningAgent || agentInFlight || specificationId === null}
              onClick={handleRunAgent}
              className={PRIMARY_BUTTON_CLASS}
            >
              {isRunningAgent ? (
                <Loader2 className="size-3 animate-spin" aria-hidden />
              ) : (
                <Play className="size-3" aria-hidden />
              )}
              {isRunningAgent ? 'Running' : 'Run agent'}
            </button>
          ) : null}
        </div>
      </div>
      <ul className="flex flex-col gap-0.5 text-sub">
        {openNeeds.map((need) => {
          const isResolving = resolvingNeedIds.has(need.id);
          const isSaving = savingNeedIds.has(need.id);
          const isResetting = resettingNeedIds.has(need.id);
          const isApplying = applyingNeedIds.has(need.id);
          const draft = editDrafts.get(need.id);
          const isEditing = draft !== undefined;
          const canRerunAgent = need.agent_status === 'classified' || need.agent_status === 'failed';
          const showAutoConfirmButton =
            need.agent_status === 'classified' && need.agent_classification === 'auto-confirm';
          const showAutoEditChrome =
            need.agent_status === 'classified' &&
            need.agent_classification === 'auto-edit' &&
            need.agent_proposal !== null;
          const canViewOrApplyAutoEditProposal = need.target_current_content !== null;
          const showOpenSideChatButton =
            need.agent_status === 'classified' &&
            need.agent_classification === 'substantive' &&
            secondaryChatTrigger !== null &&
            secondaryChatTrigger.canCreate &&
            need.target_item_kind !== null;
          const rowDisabled = isResolving || isSaving || isResetting || isApplying || bulkOperation !== null;
          const showSourceDiff =
            need.source_previous_content !== null &&
            need.source_current_content !== null &&
            need.source_previous_content !== need.source_current_content;
          const canEditTarget = need.target_current_content !== null;
          const KindIcon = need.kind === 'supersedes' ? Replace : Check;
          const kindLabel = need.kind === 'supersedes' ? 'supersedes' : 'confirm';
          const targetExcerpt =
            need.target_current_content !== null
              ? truncate(need.target_current_content, TARGET_EXCERPT_LIMIT)
              : null;
          return (
            <li
              key={need.id}
              data-need-id={need.id}
              data-need-kind={need.kind}
              className="group/need-row flex flex-col gap-0.5 rounded px-1.5 py-1 hover:bg-tint/40"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-1.5">
                  <span
                    className="inline-flex size-4 shrink-0 items-center justify-center text-hint"
                    title={kindLabel}
                    aria-label={kindLabel}
                    data-kind-chip={need.kind}
                  >
                    <KindIcon className="size-3" aria-hidden />
                  </span>
                  <ClassificationChip
                    agentStatus={need.agent_status}
                    agentClassification={need.agent_classification}
                    agentProposal={need.agent_proposal}
                  />
                  <span className="min-w-0 truncate text-ink" title={targetExcerpt ?? undefined}>
                    <span className="font-mono text-hint">#{need.target_item_id}</span>
                    {targetExcerpt !== null ? (
                      <>
                        <span className="mx-1 text-hint">·</span>
                        {targetExcerpt}
                      </>
                    ) : null}
                  </span>
                </div>
                <div className="flex items-center gap-0.5">
                  {showAutoConfirmButton ? (
                    <button
                      type="button"
                      aria-label={`Confirm need ${need.id}`}
                      title="Confirm — resolve this auto-confirm row"
                      data-confirm-button={need.id}
                      disabled={rowDisabled}
                      onClick={() => handleResolve(need.id, need.specification_id)}
                      className={PRIMARY_ICON_BUTTON_CLASS}
                    >
                      {isResolving ? (
                        <Loader2 className="size-3.5 animate-spin" aria-hidden />
                      ) : (
                        <CheckCheck className="size-3.5" aria-hidden />
                      )}
                      <span className="sr-only">{isResolving ? 'Resolving' : 'Confirm'}</span>
                    </button>
                  ) : null}
                  {showAutoEditChrome ? (
                    <>
                      {canViewOrApplyAutoEditProposal ? (
                        <>
                          <button
                            type="button"
                            aria-label={`View proposal for need ${need.id}`}
                            title="View proposed edit"
                            data-view-proposal-button={need.id}
                            onClick={(event) => {
                              diffAnchorRef.current = event.currentTarget;
                              setDiffPopoverNeedId({ needId: need.id, mode: 'agent-proposal' });
                            }}
                            className={ICON_BUTTON_CLASS}
                          >
                            <PencilLine className="size-3.5" aria-hidden />
                            <span className="sr-only">View</span>
                          </button>
                          <button
                            type="button"
                            aria-label={isApplying ? 'Applying' : `Apply proposal for need ${need.id}`}
                            title="Apply suggested edit and resolve this row"
                            data-apply-button={need.id}
                            disabled={rowDisabled}
                            onClick={() => handleApplyProposal(need)}
                            className={PRIMARY_ICON_BUTTON_CLASS}
                          >
                            {isApplying ? (
                              <Loader2 className="size-3.5 animate-spin" aria-hidden />
                            ) : (
                              <Wand2 className="size-3.5" aria-hidden />
                            )}
                            <span className="sr-only">{isApplying ? 'Applying' : 'Apply'}</span>
                          </button>
                        </>
                      ) : null}
                      <button
                        type="button"
                        aria-label={`Skip proposal for need ${need.id}`}
                        title="Resolve without applying the proposal"
                        data-skip-button={need.id}
                        disabled={rowDisabled}
                        onClick={() => handleResolve(need.id, need.specification_id)}
                        className={ICON_BUTTON_CLASS}
                      >
                        <Forward className="size-3.5" aria-hidden />
                        <span className="sr-only">Skip</span>
                      </button>
                    </>
                  ) : null}
                  {showOpenSideChatButton ? (
                    <button
                      type="button"
                      aria-label={`Open side-chat for need ${need.id}`}
                      title="Open side-chat anchored to this row's target"
                      data-open-side-chat-button={need.id}
                      disabled={rowDisabled}
                      onClick={() => handleOpenSideChat(need)}
                      className={ICON_BUTTON_CLASS}
                    >
                      <MessageSquare className="size-3.5" aria-hidden />
                      <span className="sr-only">Open side-chat</span>
                    </button>
                  ) : null}
                  {canRerunAgent ? (
                    <button
                      type="button"
                      aria-label={isResetting ? 'Re-running' : `Re-run agent for need ${need.id}`}
                      title="Re-run agent"
                      data-rerun-agent-button={need.id}
                      disabled={rowDisabled}
                      onClick={() => handleResetAgent(need.id, need.specification_id)}
                      className={ICON_BUTTON_CLASS}
                    >
                      {isResetting ? (
                        <Loader2 className="size-3.5 animate-spin" aria-hidden />
                      ) : (
                        <RotateCw className="size-3.5" aria-hidden />
                      )}
                      <span className="sr-only">{isResetting ? 'Re-running' : 'Re-run agent'}</span>
                    </button>
                  ) : null}
                  {canEditTarget && !isEditing ? (
                    <button
                      type="button"
                      aria-label={`Edit target for need ${need.id}`}
                      title="Edit target"
                      disabled={rowDisabled}
                      onClick={() => startEditing(need.id, need.target_current_content ?? '')}
                      className={ICON_BUTTON_CLASS}
                    >
                      <PencilLine className="size-3.5" aria-hidden />
                      <span className="sr-only">Edit target</span>
                    </button>
                  ) : null}
                  <button
                    type="button"
                    aria-label={isResolving ? 'Resolving' : 'Resolve'}
                    title="Resolve"
                    disabled={rowDisabled}
                    onClick={() => handleResolve(need.id, need.specification_id)}
                    className={PRIMARY_ICON_BUTTON_CLASS}
                  >
                    {isResolving ? (
                      <Loader2 className="size-3.5 animate-spin" aria-hidden />
                    ) : (
                      <Check className="size-3.5" aria-hidden strokeWidth={2.5} />
                    )}
                    <span className="sr-only">{isResolving ? 'Resolving' : 'Resolve'}</span>
                  </button>
                </div>
              </div>
              {showSourceDiff ? (
                <div className="flex items-center gap-1 text-[10px] text-hint">
                  <span>from #{need.source_item_id} was edited</span>
                  <button
                    type="button"
                    aria-label={`View source diff for need ${need.id}`}
                    data-view-source-diff-chip
                    onClick={(event) => {
                      diffAnchorRef.current = event.currentTarget;
                      setDiffPopoverNeedId({ needId: need.id, mode: 'source-diff' });
                    }}
                    className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 font-medium text-hint hover:bg-tint hover:text-ink"
                  >
                    ↗ view source diff
                  </button>
                </div>
              ) : null}
              {isEditing ? (
                <div
                  data-edit-target-form
                  className="mt-1 flex flex-col gap-1.5 rounded-md border border-rule bg-background p-2"
                >
                  <textarea
                    aria-label={`Edit target for need ${need.id}`}
                    value={draft}
                    disabled={isSaving || isResolving}
                    onChange={(event) => updateDraft(need.id, event.target.value)}
                    className="min-h-[3.5rem] w-full resize-y rounded border border-rule bg-background px-2 py-1 text-[12px] leading-relaxed text-ink outline-none focus:border-foreground/30 disabled:opacity-50"
                  />
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      aria-label="Cancel"
                      title="Cancel"
                      disabled={isSaving || isResolving}
                      onClick={() => cancelEditing(need.id)}
                      className="inline-flex size-6 items-center justify-center rounded text-hint hover:bg-tint hover:text-ink disabled:opacity-50"
                    >
                      <X className="size-3.5" aria-hidden />
                      <span className="sr-only">Cancel</span>
                    </button>
                    <button
                      type="button"
                      aria-label={isSaving ? 'Saving' : 'Save'}
                      title="Save"
                      disabled={isSaving || isResolving}
                      onClick={() => handleSave(need.id, need.specification_id, need.target_item_id)}
                      className={PRIMARY_BUTTON_CLASS}
                    >
                      {isSaving ? (
                        <Loader2 className="size-3 animate-spin" aria-hidden />
                      ) : (
                        <Check className="size-3" aria-hidden strokeWidth={2.5} />
                      )}
                      {isSaving ? 'Saving' : 'Save'}
                    </button>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {activePopoverNeed &&
      activePopoverMode === 'source-diff' &&
      activePopoverNeed.source_previous_content !== null &&
      activePopoverNeed.source_current_content !== null ? (
        <DiffPopover
          open
          onClose={() => {
            setDiffPopoverNeedId(null);
            diffAnchorRef.current = null;
          }}
          anchor={diffAnchorRef.current}
          before={activePopoverNeed.source_previous_content}
          after={activePopoverNeed.source_current_content}
          title={`Source change · #${activePopoverNeed.source_item_id}`}
        />
      ) : null}
      {activePopoverNeed &&
      activePopoverMode === 'agent-proposal' &&
      activePopoverNeed.target_current_content !== null &&
      activePopoverNeed.agent_proposal !== null ? (
        <DiffPopover
          open
          onClose={() => {
            setDiffPopoverNeedId(null);
            diffAnchorRef.current = null;
          }}
          anchor={diffAnchorRef.current}
          before={activePopoverNeed.target_current_content}
          after={activePopoverNeed.agent_proposal}
          title={`Proposed edit · #${activePopoverNeed.target_item_id}`}
        />
      ) : null}
    </div>
  );
}
