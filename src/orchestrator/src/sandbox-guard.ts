import { constants, realpathSync } from 'node:fs';
import {
  access as fsAccess,
  mkdir as fsMkdir,
  readFile as fsReadFile,
  realpath,
  writeFile as fsWriteFile,
} from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';

import {
  createEditToolDefinition,
  createReadToolDefinition,
  createWriteToolDefinition,
  type EditOperations,
  type ReadOperations,
  type ToolDefinition,
  type WriteOperations,
} from '@earendil-works/pi-coding-agent';

export interface ConfinedFileOperations {
  read: ReadOperations;
  write: WriteOperations;
  edit: EditOperations;
}

/** Resolve symlinks on the deepest existing ancestor so a link inside the sandbox cannot tunnel out. */
async function realpathDeepestExisting(absolutePath: string): Promise<string> {
  let dir = absolutePath;
  let suffix = '';
  for (;;) {
    try {
      const real = await realpath(dir);
      return suffix ? join(real, suffix) : real;
    } catch {
      const parent = dirname(dir);
      if (parent === dir) return absolutePath;
      suffix = suffix ? join(dir.slice(parent.length + 1), suffix) : dir.slice(parent.length + 1);
      dir = parent;
    }
  }
}

function outsideSandboxError(absolutePath: string, sandboxRoot: string): Error {
  return new Error(`Path ${absolutePath} is outside the run sandbox ${sandboxRoot}`);
}

async function assertInsideSandbox(sandboxRoot: string, absolutePath: string): Promise<void> {
  const real = await realpathDeepestExisting(resolve(absolutePath));
  const rel = relative(sandboxRoot, real);
  if (rel !== '' && (rel.startsWith('..') || isAbsolute(rel))) {
    throw outsideSandboxError(absolutePath, sandboxRoot);
  }
}

/**
 * File operations for the pi SDK's read/write/edit tools that refuse any path
 * outside `sandboxDir` (absolute escapes, `../` traversal, and symlink escapes
 * alike), then delegate to the local filesystem. Paths arrive already resolved
 * against the session cwd, so containment here is a complete choke point.
 */
/**
 * Confined `read`/`write`/`edit` tool definitions for the in-process pi session.
 * Same names as the built-ins, so the SDK tool registry overrides them and the
 * per-action allowlist keeps applying; only the operations layer is swapped.
 */
export function createConfinedFileTools(sandboxDir: string): ToolDefinition[] {
  const ops = createConfinedFileOperations(sandboxDir);
  // Erase the per-tool TDetails generics: invariant in ToolDefinition, so the
  // concrete factory types don't assign to ToolDefinition[] without it.
  return [
    createReadToolDefinition(sandboxDir, { operations: ops.read }),
    createWriteToolDefinition(sandboxDir, { operations: ops.write }),
    createEditToolDefinition(sandboxDir, { operations: ops.edit }),
  ] as ToolDefinition[];
}

export function createConfinedFileOperations(sandboxDir: string): ConfinedFileOperations {
  const sandboxRoot = realpathSync(resolve(sandboxDir));

  const readFile = async (absolutePath: string): Promise<Buffer> => {
    await assertInsideSandbox(sandboxRoot, absolutePath);
    return fsReadFile(absolutePath);
  };
  const writeFile = async (absolutePath: string, content: string): Promise<void> => {
    await assertInsideSandbox(sandboxRoot, absolutePath);
    await fsWriteFile(absolutePath, content);
  };

  return {
    read: {
      readFile,
      access: async (absolutePath) => {
        await assertInsideSandbox(sandboxRoot, absolutePath);
        await fsAccess(absolutePath, constants.R_OK);
      },
    },
    write: {
      writeFile,
      mkdir: async (dir) => {
        await assertInsideSandbox(sandboxRoot, dir);
        await fsMkdir(dir, { recursive: true });
      },
    },
    edit: {
      readFile,
      writeFile,
      access: async (absolutePath) => {
        await assertInsideSandbox(sandboxRoot, absolutePath);
        await fsAccess(absolutePath, constants.R_OK | constants.W_OK);
      },
    },
  };
}
