import { AsyncLocalStorage } from 'node:async_hooks';
import { realpath } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { RunMetadata } from './run.js';

const executions = new Map<string, Promise<unknown>>();
const ownedExecutions = new AsyncLocalStorage<ReadonlySet<string>>();

export interface RunExecutionActiveResult {
  readonly status: 'run_execution_active';
  readonly runStatus: RunMetadata['status'] | 'not_started';
  readonly runId: string;
  readonly sideEffects: readonly [];
}

export function runExecutionActive(
  runId: string,
  runStatus: RunExecutionActiveResult['runStatus'] = 'not_started',
): RunExecutionActiveResult {
  return { status: 'run_execution_active', runStatus, runId, sideEffects: [] };
}

export const PRODUCTION_RUN_MUTATION_ENTRIES = [
  'drive',
  'worktree_create',
  'populate',
  'source_policy',
  'source_copy',
  'report_init',
  'slice_start',
  'slice_execute',
  'agent_result',
  'test_result',
  'slice_integrate',
  'slice_complete',
  'epic_integrate',
  'epic_verify',
  'epic_complete',
  'run_complete',
  'petri_export',
  'promotion',
  'run_create',
  'run_supersede',
  'run_abandon',
  'replan_retry_current_step',
  'replan_regenerate_plan_tool',
  'replan_regenerate_plan_rpc',
  'landing_apply',
] as const;

export type ProductionRunMutationEntry = (typeof PRODUCTION_RUN_MUTATION_ENTRIES)[number];

type RunMutationAuthorityBoundary = { readonly coreFile: string; readonly standalone: boolean };

/** Canonical inventory: every independently typed production run mutation declares its authority boundary. */
export const RUN_MUTATION_ENTRY_INVENTORY = {
  drive: { coreFile: 'orchestrate.ts', standalone: true },
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
  run_create: { coreFile: 'run.ts', standalone: true },
  run_supersede: { coreFile: 'run-supersession.ts', standalone: true },
  run_abandon: { coreFile: 'run-abandon.ts', standalone: true },
  replan_retry_current_step: {
    coreFile: '../.pi/extensions/executor/execute-replan-retry-current-step/index.ts',
    standalone: true,
  },
  replan_regenerate_plan_tool: {
    coreFile: '../.pi/extensions/executor/execute-replan-regenerate-plan/index.ts',
    standalone: true,
  },
  replan_regenerate_plan_rpc: { coreFile: '../rpc/methods/execute.ts', standalone: true },
  landing_apply: { coreFile: 'landing.ts', standalone: true },
} as const satisfies Record<ProductionRunMutationEntry, RunMutationAuthorityBoundary>;

export type RunMutationEntry = ProductionRunMutationEntry;

const NOT_A_RUN_MUTATION = null;

/** Exact classification of the registered production execute-tool surface. */
export const PRODUCTION_EXECUTE_TOOL_MUTATIONS = {
  execute_agent_result: 'agent_result',
  execute_land_preflight: NOT_A_RUN_MUTATION,
  execute_launch: NOT_A_RUN_MUTATION,
  execute_orchestrate: 'drive',
  execute_petri_export: 'petri_export',
  execute_plan_check: NOT_A_RUN_MUTATION,
  execute_plan_draft: NOT_A_RUN_MUTATION,
  execute_plan_draft_artifact: NOT_A_RUN_MUTATION,
  execute_plan_file: NOT_A_RUN_MUTATION,
  execute_plan_outline: NOT_A_RUN_MUTATION,
  execute_plan_outline_artifact: NOT_A_RUN_MUTATION,
  execute_plan_preview: NOT_A_RUN_MUTATION,
  execute_populate: 'populate',
  execute_promotion_prepare: 'promotion',
  execute_replan_abandon_run: 'run_abandon',
  execute_replan_recommendation: NOT_A_RUN_MUTATION,
  execute_replan_regenerate_plan: 'replan_regenerate_plan_tool',
  execute_replan_retry_current_step: 'replan_retry_current_step',
  execute_replan_start_new_run: 'run_supersede',
  execute_report_init: 'report_init',
  execute_run_complete: 'run_complete',
  execute_run_create: 'run_create',
  execute_slice_complete: 'slice_complete',
  execute_slice_execute: 'slice_execute',
  execute_slice_start: 'slice_start',
  execute_snapshot: NOT_A_RUN_MUTATION,
  execute_source_copy: 'source_copy',
  execute_source_policy: 'source_policy',
  execute_status: NOT_A_RUN_MUTATION,
  execute_test_result: 'test_result',
  execute_worktree_create: 'worktree_create',
} as const satisfies Record<string, ProductionRunMutationEntry | null>;

/** Exact classification of the registered production execute-RPC surface. */
export const PRODUCTION_EXECUTE_RPC_MUTATIONS: Readonly<Record<string, ProductionRunMutationEntry | null>> = {
  'execute.replanAbandonRun': 'run_abandon',
  'execute.replanRecommendation': NOT_A_RUN_MUTATION,
  'execute.replanRegeneratePlan': 'replan_regenerate_plan_rpc',
  'execute.replanStartNewRun': 'run_supersede',
  'execute.run': NOT_A_RUN_MUTATION,
  'execute.runTraceIndex': NOT_A_RUN_MUTATION,
  'execute.runs': NOT_A_RUN_MUTATION,
};

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
