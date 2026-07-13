import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { ExecutorNetEvent, ExecutorNetStepKind } from './orchestrate-topology.js';
import { runDirPath, type RunMetadata } from './run.js';

export type PetriEventListener = (event: ExecutorNetEvent) => void;
export type PetriJournalFailureListener = () => void;

// ceiling: both buses are process-local hints; replace with file watching or a
// durable broker when executor and web host no longer share one process.
const listenersByRun = new Map<string, Set<PetriEventListener>>();
const failureListenersByRun = new Map<string, Set<PetriJournalFailureListener>>();

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
  const key = listenerKey(args.cwd, args.runId);
  try {
    await mkdir(petriDirPath(args.cwd, args.runId), { recursive: true });
    await appendFile(petriEventsPath(args.cwd, args.runId), `${JSON.stringify(args.event)}\n`, 'utf8');
  } catch (error) {
    // Observers must learn the journal broke or they wait on a wake-up that cannot come.
    for (const listener of failureListenersByRun.get(key) ?? []) {
      try {
        listener();
      } catch {
        // Observer callbacks never change the durable append result.
      }
    }
    throw error;
  }
  for (const listener of listenersByRun.get(key) ?? []) {
    try {
      listener(args.event);
    } catch {
      // Observer callbacks never change the durable append result.
    }
  }
}

export async function readDurableEpicTransitionHistory(args: {
  readonly cwd: string;
  readonly runId: string;
}): Promise<
  | { readonly status: 'missing' | 'unavailable' | 'unreadable' }
  | { readonly status: 'readable'; readonly history: readonly string[] }
> {
  try {
    const history: string[] = [];
    for (const line of (await readFile(petriEventsPath(args.cwd, args.runId), 'utf8'))
      .split('\n')
      .filter(Boolean)) {
      let event: ExecutorNetEvent | undefined;
      try {
        event = parsePetriEvent(JSON.parse(line));
      } catch {
        return { status: 'unreadable' };
      }
      if (!event) return { status: 'unreadable' };
      if (event.kind === 'transition_fired' && event.contract.lane === 'epic') {
        history.push(event.transitionId);
      }
    }
    return { status: 'readable', history };
  } catch (error) {
    return isNodeError(error) && error.code === 'ENOENT' ? { status: 'missing' } : { status: 'unavailable' };
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

export function subscribePetriEvents(args: {
  readonly cwd: string;
  readonly runId: string;
  readonly listener: PetriEventListener;
}): () => void {
  return subscribeListener(listenersByRun, listenerKey(args.cwd, args.runId), args.listener);
}

export function subscribePetriJournalFailures(args: {
  readonly cwd: string;
  readonly runId: string;
  readonly listener: PetriJournalFailureListener;
}): () => void {
  return subscribeListener(failureListenersByRun, listenerKey(args.cwd, args.runId), args.listener);
}

function subscribeListener<Listener>(
  listenersByKey: Map<string, Set<Listener>>,
  key: string,
  listener: Listener,
): () => void {
  const listeners = listenersByKey.get(key) ?? new Set<Listener>();
  listeners.add(listener);
  listenersByKey.set(key, listeners);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) listenersByKey.delete(key);
  };
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
  if (value.kind === 'attempt_failed') {
    if (
      typeof value.sliceId !== 'string' ||
      !isStepKind(value.step) ||
      !isAttemptNumber(value.attempt) ||
      typeof value.reason !== 'string' ||
      (value.epicId !== undefined && typeof value.epicId !== 'string')
    ) {
      return undefined;
    }
    return value as unknown as ExecutorNetEvent;
  }
  if (value.kind === 'epic_verification_claimed') {
    if (typeof value.epicId !== 'string' || value.step !== 'epic_verify') return undefined;
    return value as unknown as ExecutorNetEvent;
  }
  if (value.kind !== 'transition_fired') return undefined;
  if (value.attempt !== undefined && !isAttemptNumber(value.attempt)) return undefined;
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
  slice_integrated: true,
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
  slice_integrate: true,
  slice_complete: true,
  run_complete: true,
  petri_export: true,
  promotion: true,
  epic_integrate: true,
  epic_verify: true,
  epic_complete: true,
} satisfies Record<ExecutorNetStepKind, true>;

function isRunStatus(value: unknown): value is RunMetadata['status'] {
  return typeof value === 'string' && value in RUN_STATUSES;
}

function isStepKind(value: unknown): value is ExecutorNetStepKind {
  return typeof value === 'string' && value in STEP_KINDS;
}

function isTransitionContract(value: unknown): boolean {
  return (
    isRecord(value) &&
    (value.kind === 'mechanical' || value.kind === 'structural') &&
    (value.lane === 'run' || value.lane === 'slice' || value.lane === 'attempt' || value.lane === 'epic')
  );
}

function isAttemptNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1;
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function listenerKey(cwd: string, runId: string): string {
  return `${cwd}\0${runId}`;
}
