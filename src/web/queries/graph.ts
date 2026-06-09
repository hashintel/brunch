import { queryOptions } from '@tanstack/react-query';

import type { GraphSlice, NodeNeighborhood } from '../../graph/queries.js';
import { queryKeys } from '../query-keys.js';
import type { WebSocketRpcClient } from '../rpc-client.js';

export function graphOverviewQueryOptions(rpcClient: WebSocketRpcClient, specId: number) {
  return queryOptions({
    queryKey: queryKeys.graph.overview(specId),
    queryFn: () => rpcClient.request<GraphSlice>('graph.overview', { specId }),
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
      rpcClient.request<NodeNeighborhood>('graph.nodeNeighborhood', {
        specId,
        nodeId,
        ...(hops === undefined ? {} : { hops }),
      }),
  });
}
