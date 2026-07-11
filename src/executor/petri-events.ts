import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import type { ExecutorNetEvent, ReadyStep } from './orchestrate-topology.js';
import { runDirPath, type RunMetadata } from './run.js';

export function petriDirPath(cwd: string, runId: string): string {
  return join(runDirPath(cwd, runId), 'petrinaut');
}

export function petriEventsPath(cwd: string, runId: string): string {
  return join(petriDirPath(cwd, runId), 'events.jsonl');
}

export async function appendPetriEvent(args: {
  readonly cwd: string;
  readonly runId: string;
  readonly event: ExecutorNetEvent;
}): Promise<void> {
  await mkdir(petriDirPath(args.cwd, args.runId), { recursive: true });
  await appendFile(petriEventsPath(args.cwd, args.runId), `${JSON.stringify(args.event)}\n`, 'utf8');
}

export function parsePetriEvent(value: unknown): ExecutorNetEvent | undefined {
  if (!isRecord(value) || typeof value.runId !== 'string' || !isRunStatus(value.runStatus)) return undefined;
  if (value.kind === 'net_completed' || value.kind === 'net_deadlocked') {
    return value as unknown as ExecutorNetEvent;
  }
  if (value.kind === 'net_halted') {
    if (value.step !== undefined && !isStepKind(value.step)) return undefined;
    if (value.reason !== undefined && typeof value.reason !== 'string') return undefined;
    return value as unknown as ExecutorNetEvent;
  }
  if (value.kind !== 'transition_fired') return undefined;
  if (
    typeof value.transitionId !== 'string' ||
    typeof value.subnetId !== 'string' ||
    !isStepKind(value.step) ||
    !isTransitionContract(value.contract) ||
    !isStringArray(value.consumed) ||
    !isStringArray(value.produced) ||
    !isRunStatus(value.fromStatus) ||
    !isRunStatus(value.toStatus) ||
    (value.epicId !== undefined && typeof value.epicId !== 'string') ||
    (value.derivedFrom !== undefined && !isStringArray(value.derivedFrom))
  ) {
    return undefined;
  }
  return value as unknown as ExecutorNetEvent;
}

const RUN_STATUSES = {
  created: true,
  worktree_created: true,
  worktree_populated: true,
  source_policy_selected: true,
  source_copied: true,
  reports_initialized: true,
  slice_started: true,
  slice_execution_requested: true,
  agent_result_ingested: true,
  test_result_ingested: true,
  slice_completed: true,
  run_completed: true,
  petri_exported: true,
  promotion_prepared: true,
  abandoned: true,
} satisfies Record<RunMetadata['status'], true>;

const STEP_KINDS = {
  worktree_create: true,
  populate: true,
  source_policy: true,
  source_copy: true,
  report_init: true,
  slice_start: true,
  slice_execute: true,
  agent_result: true,
  test_result: true,
  slice_complete: true,
  run_complete: true,
  petri_export: true,
  promotion: true,
} satisfies Record<ReadyStep['kind'], true>;

function isRunStatus(value: unknown): value is RunMetadata['status'] {
  return typeof value === 'string' && value in RUN_STATUSES;
}

function isStepKind(value: unknown): value is ReadyStep['kind'] {
  return typeof value === 'string' && value in STEP_KINDS;
}

function isTransitionContract(value: unknown): boolean {
  return (
    isRecord(value) &&
    (value.kind === 'mechanical' || value.kind === 'structural') &&
    (value.lane === 'run' || value.lane === 'slice')
  );
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
