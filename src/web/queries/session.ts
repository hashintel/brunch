import type { QueryObserverOptions } from '@tanstack/react-query';

import type { RuntimeStateProjection } from '../../session/runtime-state.js';
import { queryKeys } from '../query-keys.js';
import type { WebSocketRpcClient } from '../rpc-client.js';

export type SessionProjectionTarget = {
  sessionId: string;
  specId: number;
};

export function sessionRuntimeStateQueryOptions(
  rpcClient: WebSocketRpcClient,
  target: SessionProjectionTarget,
): QueryObserverOptions<RuntimeStateProjection> {
  return {
    queryKey: queryKeys.session.runtimeState(target),
    queryFn: () => rpcClient.request<RuntimeStateProjection>('session.runtimeState', target),
  };
}
