export const BRUNCH_UPDATED_METHOD = 'brunch.updated';

export type ProductUpdateTopic =
  | 'workspace.snapshot'
  | 'workspace.selectionState'
  | 'session.pendingExchange'
  | 'session.elicitationExchanges'
  | 'session.transcriptDisplay'
  | 'session.runtimeState'
  | 'graph.overview'
  | 'graph.nodeNeighborhood';

export interface ProductUpdate {
  readonly topic: ProductUpdateTopic;
  readonly specId?: number;
  readonly sessionId?: string;
  readonly nodeId?: number;
  readonly lsn?: number;
}

export interface ProductUpdateNotification {
  readonly jsonrpc: '2.0';
  readonly method: typeof BRUNCH_UPDATED_METHOD;
  readonly params: {
    readonly topics: readonly ProductUpdateTopic[];
    readonly updates: readonly ProductUpdate[];
  };
}

export type ProductUpdateListener = (updates: readonly ProductUpdate[]) => void;

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
    productUpdate('workspace.snapshot', target),
    productUpdate('session.pendingExchange', target),
    productUpdate('session.elicitationExchanges', target),
    productUpdate('session.transcriptDisplay', target),
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
