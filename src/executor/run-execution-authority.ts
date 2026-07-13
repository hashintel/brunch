import { AsyncLocalStorage } from 'node:async_hooks';
import { realpath } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { ReadyStep } from './orchestrate-topology.js';

const executions = new Map<string, Promise<unknown>>();
const ownedExecutions = new AsyncLocalStorage<ReadonlySet<string>>();

export interface RunExecutionActiveResult {
  readonly status: 'run_execution_active';
  readonly runStatus: 'not_started';
  readonly runId: string;
  readonly sideEffects: readonly [];
}

export function runExecutionActive(runId: string): RunExecutionActiveResult {
  return { status: 'run_execution_active', runStatus: 'not_started', runId, sideEffects: [] };
}

/** Exhaustive inventory: adding a lifecycle effect requires an explicit authority classification. */
export const RUN_EFFECT_ENTRY_INVENTORY = {
  worktree_create: { coreFile: 'worktree.ts', standalone: true },
  populate: { coreFile: 'populate.ts', standalone: true },
  source_policy: { coreFile: 'source-policy.ts', standalone: true },
  source_copy: { coreFile: 'source-copy.ts', standalone: true },
  report_init: { coreFile: 'report.ts', standalone: true },
  slice_start: { coreFile: 'slice-start.ts', standalone: true },
  slice_execute: { coreFile: 'slice-execute.ts', standalone: true },
  agent_result: { coreFile: 'agent-result.ts', standalone: true },
  test_result: { coreFile: 'test-result.ts', standalone: true },
  slice_integrate: { coreFile: 'slice-integration.ts', standalone: true },
  slice_complete: { coreFile: 'slice-complete.ts', standalone: true },
  epic_integrate: { coreFile: 'epic-lifecycle.ts', standalone: false },
  epic_verify: { coreFile: 'epic-lifecycle.ts', standalone: false },
  epic_complete: { coreFile: 'epic-lifecycle.ts', standalone: false },
  run_complete: { coreFile: 'run-complete.ts', standalone: true },
  petri_export: { coreFile: 'petri.ts', standalone: true },
  promotion: { coreFile: 'promotion.ts', standalone: true },
} as const satisfies Record<ReadyStep['kind'], { readonly coreFile: string; readonly standalone: boolean }>;

export async function withRunExecutionAuthority<Result, Contended = Result>(args: {
  readonly cwd: string;
  readonly runId: string;
  readonly execute: () => Promise<Result>;
  readonly onContended?: () => Promise<Contended> | Contended;
}): Promise<Result | Contended> {
  const key = JSON.stringify([await canonicalPath(args.cwd), args.runId]);
  if (ownedExecutions.getStore()?.has(key)) return args.execute();
  const active = executions.get(key);
  if (active) return args.onContended ? args.onContended() : (active as Promise<Result>);

  const owned = ownedExecutions.run(new Set([...(ownedExecutions.getStore() ?? []), key]), () =>
    Promise.resolve().then(args.execute),
  );
  executions.set(key, owned);
  try {
    return await owned;
  } finally {
    if (executions.get(key) === owned) executions.delete(key);
  }
}

async function canonicalPath(path: string): Promise<string> {
  try {
    return await realpath(path);
  } catch {
    return resolve(path);
  }
}
