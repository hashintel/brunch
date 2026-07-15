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
  const write = previous
    .catch(() => undefined)
    .then(async () => {
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
    const raw = await readFile(indexPath, 'utf8');
    if (raw.length === 0) return 0;
    if (!raw.endsWith('\n')) throw new Error(`stream event journal is torn: ${indexPath}`);
    const lines = raw.slice(0, -1).split('\n');
    let expectedSequence = 0;
    for (const line of lines) {
      if (!line) throw new Error(`stream event journal contains a blank record: ${indexPath}`);
      const value = JSON.parse(line) as { readonly runSequence?: unknown };
      if (value.runSequence !== expectedSequence) {
        throw new Error(`stream event journal has an invalid run sequence: ${indexPath}`);
      }
      expectedSequence += 1;
    }
    return expectedSequence;
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') return 0;
    throw error;
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
