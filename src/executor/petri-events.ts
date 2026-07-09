import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import type { ExecutorNetEvent } from './orchestrate-topology.js';
import { runDirPath } from './run.js';

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
