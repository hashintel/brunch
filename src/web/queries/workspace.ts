import { queryOptions } from '@tanstack/react-query';

import type { WorkspaceState } from '../../projections/workspace/workspace-state.js';
import { queryKeys } from '../query-keys.js';
import type { WebSocketRpcClient } from '../rpc-client.js';

export function workspaceStateQueryOptions(rpcClient: WebSocketRpcClient) {
  return queryOptions({
    queryKey: queryKeys.workspace.state(),
    queryFn: () => rpcClient.request<WorkspaceState>('workspace.state'),
  });
}
