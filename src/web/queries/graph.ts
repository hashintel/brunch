import { queryOptions } from '@tanstack/react-query';

import type { GraphOverview, NeighborhoodResult } from '../../graph/snapshot.js';
import { queryKeys } from '../query-keys.js';
import type { WebSocketRpcClient } from '../rpc-client.js';

export function graphOverviewQueryOptions(rpcClient: WebSocketRpcClient, specId: number) {
  return queryOptions({
    queryKey: queryKeys.graph.overview(specId),
    queryFn: () => rpcClient.request<GraphOverview>('graph.overview', { specId }),
  });
}

export function graphNodeNeighborhoodQueryOptions(
  rpcClient: WebSocketRpcClient,
  specId: number,
  nodeId: number,
  hops?: number,
) {
  return queryOptions({
    queryKey: queryKeys.graph.nodeNeighborhood(specId, nodeId, hops ?? null),
    queryFn: () =>
      rpcClient.request<NeighborhoodResult>('graph.nodeNeighborhood', {
        specId,
        nodeId,
        ...(hops === undefined ? {} : { hops }),
      }),
  });
}
