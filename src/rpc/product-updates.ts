import type { BlockedStep, ReadyStep } from '../executor/orchestrate-topology.js';
import type { PetriProjection } from '../executor/petri-projection.js';

export const BRUNCH_UPDATED_METHOD = 'brunch.updated';

type ProductUpdateTopic =
  | 'workspace.state'
  | 'workspace.selectionState'
  | 'session.pendingExchange'
  | 'session.exchanges'
  | 'session.runtimeState'
  | 'graph.overview'
  | 'graph.nodeNeighborhood'
  | 'execute.runs'
  | 'execute.run';

export interface ProductUpdate {
  readonly topic: ProductUpdateTopic;
  readonly specId?: number;
  readonly sessionId?: string;
  readonly nodeId?: number;
  readonly lsn?: number;
  readonly runId?: string;
  readonly petriProjection?: PetriProjection | null;
  readonly petriProjectionSource?: 'snapshot' | 'replay' | null;
  readonly petriProjectionReplayReason?: 'snapshot_missing_or_unreadable' | 'snapshot_stale' | null;
  readonly petriReadySteps?: readonly ReadyStep[] | null;
  readonly petriBlockedSteps?: readonly BlockedStep[] | null;
}

export interface ProductUpdateNotification {
  readonly jsonrpc: '2.0';
  readonly method: typeof BRUNCH_UPDATED_METHOD;
  readonly params: {
    readonly topics: readonly ProductUpdateTopic[];
    readonly updates: readonly ProductUpdate[];
  };
}

type ProductUpdateListener = (updates: readonly ProductUpdate[]) => void;

export interface ProductUpdatePublisher {
  publish(update: ProductUpdate | readonly ProductUpdate[]): void;
  subscribe(listener: ProductUpdateListener): () => void;
}

export function createProductUpdatePublisher(): ProductUpdatePublisher {
  const listeners = new Set<ProductUpdateListener>();
  return {
    publish(update) {
      const updates = Array.isArray(update) ? update : [update];
      if (updates.length === 0) {
        return;
      }
      for (const listener of listeners) {
        listener(updates);
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export function createProductUpdateNotification(
  updates: readonly ProductUpdate[],
): ProductUpdateNotification {
  return {
    jsonrpc: '2.0',
    method: BRUNCH_UPDATED_METHOD,
    params: {
      topics: uniqueTopics(updates),
      updates,
    },
  };
}

export function selectedSessionProductUpdates(target?: {
  readonly specId?: number;
  readonly sessionId?: string;
}): readonly ProductUpdate[] {
  return [
    productUpdate('workspace.state', target),
    productUpdate('workspace.selectionState', target),
    productUpdate('session.pendingExchange', target),
    productUpdate('session.exchanges', target),
    productUpdate('session.runtimeState', target),
  ];
}

export interface ExecuteRunProductUpdateHints {
  readonly petriProjection?: PetriProjection | null;
  readonly petriProjectionSource?: 'snapshot' | 'replay' | null;
  readonly petriProjectionReplayReason?: 'snapshot_missing_or_unreadable' | 'snapshot_stale' | null;
  readonly petriReadySteps?: readonly ReadyStep[] | null;
  readonly petriBlockedSteps?: readonly BlockedStep[] | null;
}

export function executeRunProductUpdateHintsFromDetail(detail: {
  readonly petriProjection?: PetriProjection;
  readonly petriProjectionSource?: 'snapshot' | 'replay';
  readonly petriProjectionReplayReason?: 'snapshot_missing_or_unreadable' | 'snapshot_stale';
  readonly petriReadySteps?: readonly ReadyStep[];
  readonly petriBlockedSteps?: readonly BlockedStep[];
}): ExecuteRunProductUpdateHints {
  return {
    petriProjection: detail.petriProjection ?? null,
    petriProjectionSource: detail.petriProjectionSource ?? null,
    petriProjectionReplayReason: detail.petriProjectionReplayReason ?? null,
    ...(detail.petriReadySteps === undefined ? {} : { petriReadySteps: detail.petriReadySteps }),
    ...(detail.petriBlockedSteps === undefined ? {} : { petriBlockedSteps: detail.petriBlockedSteps }),
  };
}

export function executeRunProductUpdates(
  runId?: string,
  hints?: ExecuteRunProductUpdateHints,
): readonly ProductUpdate[] {
  return [
    { topic: 'execute.runs' },
    ...(runId === undefined
      ? []
      : [
          {
            topic: 'execute.run',
            runId,
            ...(hints?.petriProjection === undefined ? {} : { petriProjection: hints.petriProjection }),
            ...(hints?.petriProjectionSource === undefined
              ? {}
              : { petriProjectionSource: hints.petriProjectionSource }),
            ...(hints?.petriProjectionReplayReason === undefined
              ? {}
              : { petriProjectionReplayReason: hints.petriProjectionReplayReason }),
            ...(hints?.petriReadySteps === undefined ? {} : { petriReadySteps: hints.petriReadySteps }),
            ...(hints?.petriBlockedSteps === undefined ? {} : { petriBlockedSteps: hints.petriBlockedSteps }),
          } as const,
        ]),
  ];
}

export function graphMutationProductUpdates(target: {
  readonly specId: number;
  readonly lsn: number;
}): readonly ProductUpdate[] {
  return [
    { topic: 'graph.overview', specId: target.specId, lsn: target.lsn },
    { topic: 'graph.nodeNeighborhood', specId: target.specId, lsn: target.lsn },
  ];
}

function productUpdate(
  topic: ProductUpdateTopic,
  target: { readonly specId?: number; readonly sessionId?: string } | undefined,
): ProductUpdate {
  return {
    topic,
    ...(target?.specId === undefined ? {} : { specId: target.specId }),
    ...(target?.sessionId === undefined ? {} : { sessionId: target.sessionId }),
  };
}

function uniqueTopics(updates: readonly ProductUpdate[]): readonly ProductUpdateTopic[] {
  return [...new Set(updates.map((update) => update.topic))];
}
