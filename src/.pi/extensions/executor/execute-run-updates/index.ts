import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

import { executeRunProductUpdates, type ProductUpdatePublisher } from '../../../../rpc/product-updates.js';

export interface ExecuteRunUpdatesDeps {
  readonly productUpdates: ProductUpdatePublisher;
}

/**
 * Passive run-observer choke point: instead of threading the publisher through
 * every execute_* tool module, one tool_result observer publishes run-scoped
 * `brunch.updated` hints after a lifecycle tool reports a successful explicit
 * side effect (I52-L: unadvanced/failed steps report no side effects).
 * Plan-scoped execute tools over-hint the runs list; poll-on-hint refetch is cheap.
 */
export function registerBrunchExecuteRunUpdates(pi: ExtensionAPI, deps: ExecuteRunUpdatesDeps): void {
  pi.on('tool_result', async (event) => {
    if (event.isError || !event.toolName.startsWith('execute_')) return undefined;
    const details = asRecord(event.details);
    if (details === undefined) return undefined;

    if (event.toolName === 'execute_orchestrate') {
      const outcome = asRecord(details['outcome']);
      if (outcome === undefined || outcome['status'] === 'missing_run') return undefined;
      deps.productUpdates.publish(executeRunProductUpdates(stringOrUndefined(event.input['runId'])));
      return undefined;
    }

    const sideEffects = details['sideEffects'];
    if (!Array.isArray(sideEffects) || sideEffects.length === 0) return undefined;
    const result = asRecord(details['result']);
    const runId = stringOrUndefined(result?.['runId']) ?? stringOrUndefined(event.input['runId']);
    deps.productUpdates.publish(executeRunProductUpdates(runId));
    return undefined;
  });
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export default registerBrunchExecuteRunUpdates;
