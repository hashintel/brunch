import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const writes = new Map<string, Promise<void>>();

export function runStreamEventsPath(streamPath: string): string {
  return join(dirname(dirname(streamPath)), 'events.jsonl');
}

export async function appendRunOrderedStreamEvent<Event extends object>(args: {
  readonly streamPath: string;
  readonly event: Event;
}): Promise<Event & { readonly runSequence: number }> {
  const indexPath = runStreamEventsPath(args.streamPath);
  const previous = writes.get(indexPath) ?? Promise.resolve();
  let persisted!: Event & { readonly runSequence: number };
  const write = previous.then(async () => {
    const runSequence = await nextRunSequence(indexPath);
    persisted = { ...args.event, runSequence };
    await mkdir(dirname(args.streamPath), { recursive: true });
    await appendFile(indexPath, `${JSON.stringify(persisted)}\n`, 'utf8');
    await appendFile(args.streamPath, `${JSON.stringify(persisted)}\n`, 'utf8');
  });
  writes.set(indexPath, write);
  try {
    await write;
    return persisted;
  } finally {
    if (writes.get(indexPath) === write) writes.delete(indexPath);
  }
}

async function nextRunSequence(indexPath: string): Promise<number> {
  try {
    // ceiling: whole-journal scan per append; persist a separate atomic counter if
    // worker streams grow beyond the current bounded execution-run scale.
    const lines = (await readFile(indexPath, 'utf8')).split('\n').filter(Boolean);
    const last = lines.at(-1);
    if (!last) return 0;
    const value = JSON.parse(last) as { readonly runSequence?: unknown };
    return typeof value.runSequence === 'number' && Number.isInteger(value.runSequence)
      ? value.runSequence + 1
      : 0;
  } catch {
    return 0;
  }
}
