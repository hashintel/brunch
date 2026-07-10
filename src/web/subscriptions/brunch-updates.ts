import type { QueryClient, QueryKey } from '@tanstack/react-query';
import { useEffect } from 'react';

import { queryKeys } from '../query-keys.js';
import type { WebSocketRpcClient, WebSocketRpcNotification } from '../rpc-client.js';

type ProductUpdate = {
  readonly topic?: unknown;
  readonly specId?: unknown;
  readonly sessionId?: unknown;
  readonly nodeId?: unknown;
  readonly runId?: unknown;
  readonly petriProjection?: unknown;
  readonly petriProjectionSource?: unknown;
  readonly petriProjectionReplayReason?: unknown;
  readonly petriReadySteps?: unknown;
  readonly petriBlockedSteps?: unknown;
};

export function useBrunchUpdateSubscription(queryClient: QueryClient, rpcClient: WebSocketRpcClient): void {
  useEffect(
    () =>
      rpcClient.subscribe((notification) => {
        if (notification.method !== 'brunch.updated') {
          return;
        }
        invalidateBrunchUpdate(queryClient, notification);
      }),
    [queryClient, rpcClient],
  );
}

export function invalidateBrunchUpdate(
  queryClient: QueryClient,
  notification: WebSocketRpcNotification,
): void {
  const params = notification.params;
  if (!isRecord(params)) {
    return;
  }

  const updates = Array.isArray(params.updates) ? params.updates : [];
  if (updates.length > 0) {
    for (const update of updates) {
      if (isProductUpdate(update)) {
        invalidateProductUpdate(queryClient, update);
      }
    }
    return;
  }

  if (Array.isArray(params.topics)) {
    for (const topic of params.topics) {
      if (typeof topic === 'string') {
        invalidateTopic(queryClient, topic);
      }
    }
  }
}

function invalidateProductUpdate(queryClient: QueryClient, update: ProductUpdate): void {
  if (update.topic === 'workspace.state') {
    invalidateExact(queryClient, queryKeys.workspace.state());
    return;
  }
  if (update.topic === 'workspace.selectionState') {
    invalidateExact(queryClient, queryKeys.workspace.selectionState());
    return;
  }
  if (update.topic === 'graph.overview' && typeof update.specId === 'number') {
    invalidateExact(queryClient, queryKeys.graph.overview(update.specId));
    return;
  }
  if (
    update.topic === 'graph.nodeNeighborhood' &&
    typeof update.specId === 'number' &&
    typeof update.nodeId === 'number'
  ) {
    void queryClient.invalidateQueries({
      queryKey: ['graph.nodeNeighborhood', update.specId, update.nodeId],
    });
    return;
  }
  if (update.topic === 'execute.runs') {
    invalidateExact(queryClient, queryKeys.execute.runs());
    void queryClient.invalidateQueries({ queryKey: ['execute.runTraceIndex'] });
    return;
  }
  if (update.topic === 'execute.run' && typeof update.runId === 'string') {
    patchExecuteRunDetail(queryClient, update);
    invalidateExact(queryClient, queryKeys.execute.run(update.runId));
    void queryClient.invalidateQueries({ queryKey: ['execute.runTraceIndex'] });
    return;
  }
  if (typeof update.topic === 'string') {
    invalidateTopic(queryClient, update.topic);
  }
}

function invalidateTopic(queryClient: QueryClient, topic: string): void {
  if (topic === 'workspace.state') {
    invalidateExact(queryClient, queryKeys.workspace.state());
    return;
  }
  if (topic === 'workspace.selectionState') {
    invalidateExact(queryClient, queryKeys.workspace.selectionState());
    return;
  }
  if (topic === 'session.runtimeState') {
    void queryClient.invalidateQueries({ queryKey: ['session.runtimeState'] });
    return;
  }
  if (topic === 'graph.overview') {
    void queryClient.invalidateQueries({ queryKey: ['graph.overview'] });
    return;
  }
  if (topic === 'graph.nodeNeighborhood') {
    void queryClient.invalidateQueries({ queryKey: ['graph.nodeNeighborhood'] });
    return;
  }
  if (topic === 'execute.runs') {
    invalidateExact(queryClient, queryKeys.execute.runs());
    void queryClient.invalidateQueries({ queryKey: ['execute.runTraceIndex'] });
    return;
  }
  if (topic === 'execute.run') {
    void queryClient.invalidateQueries({ queryKey: ['execute.run'] });
    void queryClient.invalidateQueries({ queryKey: ['execute.runTraceIndex'] });
  }
}

function invalidateExact(queryClient: QueryClient, queryKey: QueryKey): void {
  void queryClient.invalidateQueries({ queryKey, exact: true });
}

function patchExecuteRunDetail(queryClient: QueryClient, update: ProductUpdate): void {
  if (typeof update.runId !== 'string') return;
  if (
    !('petriProjection' in update) &&
    !('petriProjectionSource' in update) &&
    !('petriProjectionReplayReason' in update) &&
    !('petriReadySteps' in update) &&
    !('petriBlockedSteps' in update)
  ) {
    return;
  }
  queryClient.setQueryData(queryKeys.execute.run(update.runId), (current: unknown) => {
    if (!isRecord(current) || 'unreadable' in current) return current;
    const next = { ...current };
    if ('petriProjectionSource' in update) {
      if (update.petriProjectionSource === null) delete next.petriProjectionSource;
      else if (update.petriProjectionSource === 'snapshot' || update.petriProjectionSource === 'replay') {
        next.petriProjectionSource = update.petriProjectionSource;
      }
    }
    if ('petriProjection' in update) {
      if (update.petriProjection === null) delete next.petriProjection;
      else if (isPetriProjection(update.petriProjection)) next.petriProjection = update.petriProjection;
    }
    if ('petriProjectionReplayReason' in update) {
      if (update.petriProjectionReplayReason === null) delete next.petriProjectionReplayReason;
      else if (
        update.petriProjectionReplayReason === 'snapshot_missing_or_unreadable' ||
        update.petriProjectionReplayReason === 'snapshot_stale'
      ) {
        next.petriProjectionReplayReason = update.petriProjectionReplayReason;
      }
    }
    if ('petriReadySteps' in update) {
      if (update.petriReadySteps === null) delete next.petriReadySteps;
      else if (isReadyStepArray(update.petriReadySteps)) next.petriReadySteps = update.petriReadySteps;
    }
    if ('petriBlockedSteps' in update) {
      if (update.petriBlockedSteps === null) delete next.petriBlockedSteps;
      else if (isBlockedStepArray(update.petriBlockedSteps))
        next.petriBlockedSteps = update.petriBlockedSteps;
    }
    return next;
  });
}

function isReadyStepArray(value: unknown): value is readonly Record<string, unknown>[] {
  return Array.isArray(value) && value.every(isReadyStep);
}

function isPetriProjection(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value) || !isRecord(value.currentMarking)) return false;
  for (const count of Object.values(value.currentMarking)) {
    if (typeof count !== 'number' || !Number.isInteger(count) || count < 0) return false;
  }
  if (
    ('claimedTransitionIds' in value &&
      value.claimedTransitionIds !== undefined &&
      (!Array.isArray(value.claimedTransitionIds) ||
        value.claimedTransitionIds.some((transitionId) => typeof transitionId !== 'string'))) ||
    typeof value.firedTransitionCount !== 'number' ||
    !Number.isInteger(value.firedTransitionCount) ||
    value.firedTransitionCount < 0
  ) {
    return false;
  }
  if (
    value.terminalEventKind !== undefined &&
    value.terminalEventKind !== 'net_completed' &&
    value.terminalEventKind !== 'net_halted' &&
    value.terminalEventKind !== 'net_deadlocked'
  ) {
    return false;
  }
  return value.haltedReason === undefined || typeof value.haltedReason === 'string';
}

function isReadyStep(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value) || typeof value.kind !== 'string') return false;
  if (
    value.kind === 'slice_start' ||
    value.kind === 'slice_execute' ||
    value.kind === 'agent_result' ||
    value.kind === 'test_result' ||
    value.kind === 'slice_complete'
  ) {
    return (
      typeof value.sliceId === 'string' &&
      (value.epicId === undefined || typeof value.epicId === 'string') &&
      (value.derivedFrom === undefined ||
        (Array.isArray(value.derivedFrom) && value.derivedFrom.every((item) => typeof item === 'string')))
    );
  }
  return [
    'worktree_create',
    'populate',
    'source_policy',
    'source_copy',
    'report_init',
    'slice_execute',
    'agent_result',
    'test_result',
    'slice_complete',
    'run_complete',
    'petri_export',
    'promotion',
  ].includes(value.kind);
}

function isBlockedStepArray(value: unknown): value is readonly Record<string, unknown>[] {
  return Array.isArray(value) && value.every(isBlockedStep);
}

function isBlockedStep(value: unknown): value is Record<string, unknown> {
  return (
    isRecord(value) &&
    value.kind === 'slice_start' &&
    typeof value.sliceId === 'string' &&
    (value.epicId === undefined || typeof value.epicId === 'string') &&
    (value.derivedFrom === undefined ||
      (Array.isArray(value.derivedFrom) && value.derivedFrom.every((item) => typeof item === 'string'))) &&
    Array.isArray(value.blockers) &&
    value.blockers.every(isBlockedStepReason)
  );
}

function isBlockedStepReason(value: unknown): value is Record<string, unknown> {
  return (
    isRecord(value) &&
    (value.kind === 'dependency' || value.kind === 'active_slice') &&
    typeof value.sliceId === 'string'
  );
}

function isProductUpdate(value: unknown): value is ProductUpdate {
  if (!isRecord(value)) return false;
  if (value.topic === 'workspace.state') return true;
  if (value.topic === 'workspace.selectionState') return true;
  if (value.topic === 'graph.overview') return typeof value.specId === 'number';
  if (value.topic === 'graph.nodeNeighborhood') {
    return typeof value.specId === 'number' && typeof value.nodeId === 'number';
  }
  return typeof value.topic === 'string';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
