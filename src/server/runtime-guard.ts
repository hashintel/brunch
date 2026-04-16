import { randomUUID } from 'node:crypto';
import { readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const RUNTIME_GUARD_FILENAME = 'runtime-owner.json';

interface RuntimeOwner {
  readonly token: string;
  readonly pid: number;
  readonly cwd: string;
  readonly projectRoot: string;
  readonly startedAt: string;
  readonly port: number | null;
}

export interface RuntimeGuard {
  readonly path: string;
  readonly owner: RuntimeOwner;
  release(): void;
  updatePort(port: number): void;
}

export class DuplicateRuntimeError extends Error {
  constructor(owner: RuntimeOwner) {
    const location =
      owner.port === null ? owner.projectRoot : `${owner.projectRoot} at http://localhost:${owner.port}`;
    super(
      `Brunch is already running for ${location}. Stop the existing runtime before launching another instance from the same project.`,
    );
    this.name = 'DuplicateRuntimeError';
  }
}

function createRuntimeOwner(projectRoot: string, cwd: string): RuntimeOwner {
  return {
    token: randomUUID(),
    pid: process.pid,
    cwd,
    projectRoot,
    startedAt: new Date().toISOString(),
    port: null,
  };
}

function serializeRuntimeOwner(owner: RuntimeOwner): string {
  return JSON.stringify(owner, null, 2);
}

function readRuntimeOwner(path: string): RuntimeOwner | null {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as RuntimeOwner;
  } catch {
    return null;
  }
}

function writeRuntimeOwnerAtomically(path: string, owner: RuntimeOwner): void {
  const tempPath = `${path}.${owner.token}.next`;
  writeFileSync(tempPath, serializeRuntimeOwner(owner));
  renameSync(tempPath, path);
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (!(error instanceof Error)) {
      throw error;
    }

    return (error as NodeJS.ErrnoException).code !== 'ESRCH';
  }
}

function createRuntimeGuard(path: string, initialOwner: RuntimeOwner): RuntimeGuard {
  let active = true;
  let owner = initialOwner;

  return {
    path,
    get owner() {
      return owner;
    },
    release() {
      if (!active) {
        return;
      }

      active = false;
      const existingOwner = readRuntimeOwner(path);
      if (existingOwner?.token === owner.token) {
        rmSync(path, { force: true });
      }
    },
    updatePort(port) {
      if (!active || owner.port === port) {
        return;
      }

      owner = { ...owner, port };
      writeRuntimeOwnerAtomically(path, owner);
    },
  };
}

export function acquireRuntimeGuard(projectRoot: string, cwd: string): RuntimeGuard {
  const path = join(projectRoot, RUNTIME_GUARD_FILENAME);
  const owner = createRuntimeOwner(projectRoot, cwd);

  for (;;) {
    try {
      writeFileSync(path, serializeRuntimeOwner(owner), { flag: 'wx' });
      return createRuntimeGuard(path, owner);
    } catch (error) {
      if (!(error instanceof Error) || (error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error;
      }

      const existingOwner = readRuntimeOwner(path);
      if (existingOwner && isProcessAlive(existingOwner.pid)) {
        throw new DuplicateRuntimeError(existingOwner);
      }

      rmSync(path, { force: true });
    }
  }
}
