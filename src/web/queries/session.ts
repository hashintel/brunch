import type { QueryObserverOptions } from '@tanstack/react-query';

import type { TranscriptDisplayProjection } from '../../session/elicitation-exchange.js';
import type { RuntimeStateProjection } from '../../session/runtime-state.js';
import { queryKeys } from '../query-keys.js';
import type { WebSocketRpcClient } from '../rpc-client.js';

export type SessionProjectionTarget = {
  sessionId: string;
  specId: number;
};

export function sessionTranscriptDisplayQueryOptions(
  rpcClient: WebSocketRpcClient,
  target: SessionProjectionTarget | null,
): QueryObserverOptions<TranscriptDisplayProjection> {
  return {
    queryKey: queryKeys.session.transcriptDisplay(target),
    queryFn: () =>
      rpcClient.request<TranscriptDisplayProjection>(
        'session.transcriptDisplay',
        target ?? unreachableSessionProjectionTarget(),
      ),
    enabled: target !== null,
    retry: false,
  };
}

export function sessionRuntimeStateQueryOptions(
  rpcClient: WebSocketRpcClient,
  target: SessionProjectionTarget,
): QueryObserverOptions<RuntimeStateProjection> {
  return {
    queryKey: queryKeys.session.runtimeState(target),
    queryFn: () => rpcClient.request<RuntimeStateProjection>('session.runtimeState', target),
  };
}

function unreachableSessionProjectionTarget(): never {
  throw new Error('Session query is disabled without a target');
}
