import { queryOptions } from '@tanstack/react-query';

import type { WorkspaceState } from '../../projections/workspace/workspace-state.js';
import type { WorkspaceLaunchInventory } from '../../session/workspace-session-coordinator.js';
import { queryKeys } from '../query-keys.js';
import type { WebSocketRpcClient } from '../rpc-client.js';

export function workspaceStateQueryOptions(rpcClient: WebSocketRpcClient) {
  return queryOptions({
    queryKey: queryKeys.workspace.state(),
    queryFn: () => rpcClient.request<WorkspaceState>('workspace.state'),
  });
}

/** Read-only workspace inventory: the spec/session list shown on the root route. */
export type WorkspaceSelectionState = WorkspaceLaunchInventory & {
  status: string;
  requiresSelection: boolean;
};

export function workspaceSelectionStateQueryOptions(rpcClient: WebSocketRpcClient) {
  return queryOptions({
    queryKey: queryKeys.workspace.selectionState(),
    queryFn: () => rpcClient.request<WorkspaceSelectionState>('workspace.selectionState'),
  });
}
