import type { QueryClient, QueryKey } from '@tanstack/react-query';
import { useEffect } from 'react';

import { queryKeys } from '../query-keys.js';
import type { WebSocketRpcClient, WebSocketRpcNotification } from '../rpc-client.js';

type ProductUpdate = {
  readonly topic?: unknown;
  readonly specId?: unknown;
  readonly sessionId?: unknown;
  readonly nodeId?: unknown;
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
  if (typeof update.topic === 'string') {
    invalidateTopic(queryClient, update.topic);
  }
}

function invalidateTopic(queryClient: QueryClient, topic: string): void {
  if (topic === 'workspace.state') {
    invalidateExact(queryClient, queryKeys.workspace.state());
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
  }
}

function invalidateExact(queryClient: QueryClient, queryKey: QueryKey): void {
  void queryClient.invalidateQueries({ queryKey, exact: true });
}

function isProductUpdate(value: unknown): value is ProductUpdate {
  if (!isRecord(value)) return false;
  if (value.topic === 'workspace.state') return true;
  if (value.topic === 'graph.overview') return typeof value.specId === 'number';
  if (value.topic === 'graph.nodeNeighborhood') {
    return typeof value.specId === 'number' && typeof value.nodeId === 'number';
  }
  return typeof value.topic === 'string';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
