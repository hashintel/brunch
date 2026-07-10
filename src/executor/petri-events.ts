import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import type { ExecutorNetEvent } from './orchestrate-topology.js';
import { runDirPath } from './run.js';

export type PetriEventListener = (event: ExecutorNetEvent) => void;

const listenersByRun = new Map<string, Set<PetriEventListener>>();

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
  for (const listener of listenersByRun.get(listenerKey(args.cwd, args.runId)) ?? []) {
    try {
      listener(args.event);
    } catch {
      // Live observers must never change the durable append result.
    }
  }
}

export function subscribePetriEvents(args: {
  readonly cwd: string;
  readonly runId: string;
  readonly listener: PetriEventListener;
}): () => void {
  const key = listenerKey(args.cwd, args.runId);
  const listeners = listenersByRun.get(key) ?? new Set<PetriEventListener>();
  listeners.add(args.listener);
  listenersByRun.set(key, listeners);
  return () => {
    listeners.delete(args.listener);
    if (listeners.size === 0) listenersByRun.delete(key);
  };
}

function listenerKey(cwd: string, runId: string): string {
  return `${cwd}\0${runId}`;
}
