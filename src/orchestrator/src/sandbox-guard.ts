import { constants, realpathSync } from 'node:fs';
import {
  access as fsAccess,
  mkdir as fsMkdir,
  readFile as fsReadFile,
  realpath,
  writeFile as fsWriteFile,
} from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';

import {
  type BashSpawnHook,
  createBashToolDefinition,
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
// ---------------------------------------------------------------------------
// Seatbelt confinement for spawned commands (macOS)
// ---------------------------------------------------------------------------

/** TCC-protected user folders whose mere read triggers macOS permission prompts. */
function protectedUserSubpaths(home: string): string[] {
  return ['Desktop', 'Documents', 'Downloads', 'Music', 'Pictures'].map((dir) => join(home, dir));
}

/** Toolchain/tmp locations agent commands legitimately write to (caches, scratch). */
function defaultWriteRoots(sandboxRoot: string, home: string): string[] {
  return [
    sandboxRoot,
    realpathSync(tmpdir()),
    '/var/folders',
    '/private/var/folders',
    '/tmp',
    '/private/tmp',
    '/dev',
    join(home, '.npm'),
    join(home, '.bun'),
    join(home, '.cache'),
  ];
}

const escapeProfilePath = (path: string): string => path.replaceAll('\\', '\\\\').replaceAll('"', '\\"');

// Seatbelt matches kernel-resolved paths, so emit the realpath spelling too
// (e.g. /var/folders → /private/var/folders); keep the raw one for robustness.
function subpathFilters(paths: string[]): string {
  const spellings = new Set<string>();
  for (const path of paths) {
    spellings.add(path);
    try {
      spellings.add(realpathSync(path));
    } catch {
      // Path may not exist yet (e.g. ~/.cache) — the raw spelling still applies.
    }
  }
  return [...spellings].map((p) => `(subpath "${escapeProfilePath(p)}")`).join(' ');
}

/**
 * Seatbelt (`sandbox-exec`) profile: everything allowed by default, writes
 * denied except under `writeRoots`, reads denied under `denyReadSubpaths`.
 * Seatbelt is last-match-wins, so the write allow-list must follow the deny.
 */
export function buildSeatbeltProfile(opts: { writeRoots: string[]; denyReadSubpaths: string[] }): string {
  const allowWrites = subpathFilters(opts.writeRoots);
  const denyReads = subpathFilters(opts.denyReadSubpaths);
  return [
    '(version 1)',
    '(allow default)',
    '(deny file-write* (subpath "/"))',
    `(allow file-write* ${allowWrites})`,
    ...(denyReads ? [`(deny file-read* ${denyReads})`] : []),
  ].join('\n');
}

const shellQuote = (s: string): string => `'${s.replaceAll("'", `'\\''`)}'`;

/** Wrap a bash command so it executes under the given seatbelt profile. */
export function wrapCommandInSeatbelt(profile: string, command: string): string {
  return `sandbox-exec -p ${shellQuote(profile)} /bin/bash -c ${shellQuote(command)}`;
}

/**
 * Spawn hook for the pi bash tool: every agent command runs under seatbelt so
 * it cannot write outside the sandbox or read TCC-protected user folders.
 * Returns undefined off macOS — confinement degrades to a documented no-op.
 */
export function createSeatbeltSpawnHook(sandboxDir: string): BashSpawnHook | undefined {
  if (process.platform !== 'darwin') return undefined;
  const sandboxRoot = realpathSync(resolve(sandboxDir));
  const home = homedir();
  const profile = buildSeatbeltProfile({
    writeRoots: defaultWriteRoots(sandboxRoot, home),
    denyReadSubpaths: protectedUserSubpaths(home),
  });
  return (ctx) => ({ ...ctx, command: wrapCommandInSeatbelt(profile, ctx.command) });
}

/**
 * Confined tool definitions for the in-process pi session. Same names as the
 * built-ins, so the SDK tool registry overrides them and the per-action
 * allowlist keeps applying. File tools get path-guarded operations on every
 * platform; bash is seatbelt-wrapped where the host supports it (macOS today).
 */
export function createConfinedTools(sandboxDir: string): ToolDefinition[] {
  const ops = createConfinedFileOperations(sandboxDir);
  const spawnHook = createSeatbeltSpawnHook(sandboxDir);
  // Erase the per-tool TDetails generics: invariant in ToolDefinition, so the
  // concrete factory types don't assign to ToolDefinition[] without it.
  return [
    createReadToolDefinition(sandboxDir, { operations: ops.read }),
    createWriteToolDefinition(sandboxDir, { operations: ops.write }),
    createEditToolDefinition(sandboxDir, { operations: ops.edit }),
    ...(spawnHook ? [createBashToolDefinition(sandboxDir, { spawnHook })] : []),
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
