import { queryOptions } from '@tanstack/react-query';

import type { SessionPresentationResult } from '../../projections/session/session-presentation.js';
import type { SessionTarget } from '../../session/live-session-host.js';
import { queryKeys } from '../query-keys.js';
import type { WebSocketRpcClient } from '../rpc-client.js';

export function sessionPresentationQueryOptions(client: WebSocketRpcClient, target: SessionTarget) {
  return queryOptions({
    queryKey: queryKeys.session.presentation(target),
    queryFn: () => client.request<SessionPresentationResult>('session.presentation', target),
  });
}
