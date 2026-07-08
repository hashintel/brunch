import { queryOptions } from '@tanstack/react-query';

import type { RunDetail, RunListEntry, RunTraceIndex, UnreadableRun } from '../../executor/observer-read.js';
import { queryKeys } from '../query-keys.js';
import type { WebSocketRpcClient } from '../rpc-client.js';

export type { RunDetail, RunListEntry, RunSummary, UnreadableRun } from '../../executor/observer-read.js';
export type { RunTraceEntry, RunTraceIndex } from '../../executor/observer-read.js';

export function executeRunsQueryOptions(rpcClient: WebSocketRpcClient) {
  return queryOptions({
    queryKey: queryKeys.execute.runs(),
    queryFn: () => rpcClient.request<{ runs: readonly RunListEntry[] }>('execute.runs'),
  });
}

export function executeRunQueryOptions(rpcClient: WebSocketRpcClient, runId: string) {
  return queryOptions({
    queryKey: queryKeys.execute.run(runId),
    queryFn: () => rpcClient.request<RunDetail | UnreadableRun>('execute.run', { runId }),
  });
}

export function executeRunTraceIndexQueryOptions(rpcClient: WebSocketRpcClient, specId: number) {
  return queryOptions({
    queryKey: queryKeys.execute.runTraceIndex(specId),
    queryFn: () => rpcClient.request<RunTraceIndex>('execute.runTraceIndex', { specId }),
  });
}
