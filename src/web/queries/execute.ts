import { queryOptions } from '@tanstack/react-query';

import type { RunDetail, RunListEntry, RunTraceIndex, UnreadableRun } from '../../executor/observer-read.js';
import { queryKeys } from '../query-keys.js';
import type { WebSocketRpcClient } from '../rpc-client.js';

export type { RunDetail, RunListEntry, RunSummary, UnreadableRun } from '../../executor/observer-read.js';
export type { RunTraceEntry, RunTraceIndex } from '../../executor/observer-read.js';

export type RunRetryAction =
  | 'retry_current_step'
  | 'regenerate_plan'
  | 'start_new_run'
  | 'inspect_run'
  | 'abandon_run';

export interface ReplanRecommendation {
  readonly runId: string;
  readonly status: string;
  readonly runStatus: string;
  readonly diagnosis: string;
  readonly recommendedAction: RunRetryAction;
  readonly allowedActions: readonly RunRetryAction[];
}

export interface ReplanMutationResult {
  readonly status: string;
  readonly sideEffects: readonly unknown[];
}

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

export function executeReplanRecommendationQueryOptions(
  rpcClient: WebSocketRpcClient,
  params: { readonly runId: string; readonly specId: number },
) {
  return queryOptions({
    queryKey: queryKeys.execute.replanRecommendation(params.runId, params.specId),
    queryFn: () => rpcClient.request<ReplanRecommendation>('execute.replanRecommendation', params),
  });
}

export function executeReplanRegeneratePlan(
  rpcClient: WebSocketRpcClient,
  params: { readonly runId: string; readonly specId: number },
) {
  return rpcClient.request<ReplanMutationResult>('execute.replanRegeneratePlan', params);
}

export function executeReplanStartNewRun(
  rpcClient: WebSocketRpcClient,
  params: { readonly previousRunId: string; readonly specId: number },
) {
  return rpcClient.request<ReplanMutationResult>('execute.replanStartNewRun', params);
}

export function executeReplanAbandonRun(
  rpcClient: WebSocketRpcClient,
  params: { readonly runId: string; readonly reason: string },
) {
  return rpcClient.request<ReplanMutationResult>('execute.replanAbandonRun', params);
}
