import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import type { SessionTarget } from './live-session-host.js';

export interface SessionWriterAuthority {
  readonly target: SessionTarget;
  readonly lockPath: string;
  release(): Promise<void>;
}

export class SessionWriterConflictError extends Error {
  constructor(readonly target: SessionTarget) {
    super(`Session ${target.specId}/${target.sessionId} already has a writer`);
    this.name = 'SessionWriterConflictError';
  }
}

function safeSegment(value: string): string {
  return Buffer.from(value).toString('base64url');
}

export function sessionWriterLockPath(cwd: string, target: SessionTarget): string {
  return join(
    resolve(cwd),
    '.brunch',
    'writer-locks',
    `${target.specId}-${safeSegment(target.sessionId)}.lock`,
  );
}

/**
 * Acquires durable-target writer authority using atomic directory creation.
 *
 * Crash policy is deliberately fail-closed: an ownerless/stale-looking lock is
 * never stolen automatically. Recovery requires an operator to establish that
 * no writer remains and remove the exact lock directory out of band.
 */
export async function acquireSessionWriter(input: {
  readonly cwd: string;
  readonly target: SessionTarget;
}): Promise<SessionWriterAuthority> {
  const lockPath = sessionWriterLockPath(input.cwd, input.target);
  await mkdir(join(resolve(input.cwd), '.brunch', 'writer-locks'), { recursive: true });
  try {
    await mkdir(lockPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      throw new SessionWriterConflictError(input.target);
    }
    throw error;
  }

  let released = false;
  try {
    await writeFile(
      join(lockPath, 'owner.json'),
      `${JSON.stringify({ pid: process.pid, acquiredAt: new Date().toISOString(), target: input.target })}\n`,
      { flag: 'wx' },
    );
  } catch (error) {
    await rm(lockPath, { recursive: true, force: true });
    throw error;
  }

  return {
    target: input.target,
    lockPath,
    async release() {
      if (released) return;
      released = true;
      await rm(lockPath, { recursive: true });
    },
  };
}
