import { queryOptions } from '@tanstack/react-query';

import type { WorkspaceSnapshot } from '../../scripts/print-snapshot.js';
import { queryKeys } from '../query-keys.js';
import type { WebSocketRpcClient } from '../rpc-client.js';

export function workspaceSnapshotQueryOptions(rpcClient: WebSocketRpcClient) {
  return queryOptions({
    queryKey: queryKeys.workspace.snapshot(),
    queryFn: () => rpcClient.request<WorkspaceSnapshot>('workspace.snapshot'),
  });
}
