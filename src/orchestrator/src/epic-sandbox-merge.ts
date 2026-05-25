// Materialize `<parentSandboxDir>/__epic__/<epicId>/` as the union of the
// epic's completed slice worktrees. Slices apply in declaration order; later
// slices overwrite earlier ones on the same path and the collision is
// reported. Per-slice worktrees are not mutated. The epic dir is rebuilt
// fresh on every call.

import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

export type MergeConflict = {
  path: string;
  slices: string[];
  winner: string;
};

export type MergeResult = {
  epicSandboxDir: string;
  conflicts: MergeConflict[];
};

export type MergeOptions = {
  /** Parent worktree dir holding per-slice sandboxes at `<parentSandboxDir>/<sliceId>`. */
  parentSandboxDir: string;
  epicId: string;
  /** Completed slices in epic declaration order. */
  sliceIds: string[];
};

function assertSafePathSegment(id: string, label: string): void {
  if (!id || id.includes('..') || id.includes('/') || id.includes('\\')) {
    throw new Error(`Invalid ${label}: ${id}`);
  }
}

function resolveEpicSandboxDir(parentSandboxDir: string, epicId: string): string {
  assertSafePathSegment(epicId, 'epic id');
  const parent = resolve(parentSandboxDir);
  const epicRoot = resolve(parent, '__epic__');
  const dir = resolve(epicRoot, epicId);
  if (dir === parent || !dir.startsWith(epicRoot + sep)) {
    throw new Error(`Invalid epic id: ${epicId}`);
  }
  return dir;
}

function resolveSliceDir(parentSandboxDir: string, sliceId: string): string {
  assertSafePathSegment(sliceId, 'slice id');
  const parent = resolve(parentSandboxDir);
  const dir = resolve(parent, sliceId);
  if (dir === parent || !dir.startsWith(parent + sep)) {
    throw new Error(`Invalid slice id: ${sliceId}`);
  }
  return dir;
}

function relativePathWithin(rootDir: string, file: string): string {
  const rel = relative(rootDir, file);
  if (!rel || rel.startsWith('..') || rel.split(sep).includes('..')) {
    throw new Error(`Path escapes slice sandbox: ${file}`);
  }
  return rel;
}

function prepareDestForFile(epicRoot: string, dest: string): void {
  const root = resolve(epicRoot);
  const dir = dirname(resolve(dest));
  if (dir !== root && !dir.startsWith(root + sep)) {
    throw new Error(`Path escapes epic sandbox: ${dest}`);
  }

  const relDir = relative(root, dir);
  if (relDir && relDir !== '.') {
    let current = root;
    for (const part of relDir.split(sep)) {
      current = join(current, part);
      if (existsSync(current) && !lstatSync(current).isDirectory()) {
        rmSync(current, { force: true });
        mkdirSync(current);
      }
    }
  }

  mkdirSync(dir, { recursive: true });
}

function copyIntoEpicSandbox(src: string, dest: string, epicRoot: string): void {
  prepareDestForFile(epicRoot, dest);
  if (existsSync(dest) && lstatSync(dest).isDirectory()) {
    rmSync(dest, { recursive: true, force: true });
  }
  cpSync(src, dest, { dereference: false });
}

export function mergeSlicesIntoEpicSandbox(opts: MergeOptions): MergeResult {
  const epicSandboxDir = resolveEpicSandboxDir(opts.parentSandboxDir, opts.epicId);

  if (existsSync(epicSandboxDir)) {
    rmSync(epicSandboxDir, { recursive: true, force: true });
  }
  mkdirSync(epicSandboxDir, { recursive: true });

  const writers = new Map<string, string[]>();

  for (const sliceId of opts.sliceIds) {
    const sliceDir = resolveSliceDir(opts.parentSandboxDir, sliceId);
    if (!existsSync(sliceDir)) continue;

    for (const file of walkFiles(sliceDir)) {
      const rel = relativePathWithin(sliceDir, file);
      const list = writers.get(rel) ?? [];
      list.push(sliceId);
      writers.set(rel, list);

      const dest = join(epicSandboxDir, rel);
      copyIntoEpicSandbox(file, dest, epicSandboxDir);
    }
  }

  const conflicts: MergeConflict[] = [];
  for (const [path, slices] of writers) {
    if (slices.length > 1) {
      conflicts.push({ path, slices, winner: slices[slices.length - 1]! });
    }
  }
  conflicts.sort((a, b) => a.path.localeCompare(b.path));

  return { epicSandboxDir, conflicts };
}

function* walkFiles(rootDir: string, dir: string = rootDir): Iterable<string> {
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    const st = lstatSync(abs);
    if (st.isSymbolicLink()) continue;
    if (st.isDirectory()) {
      yield* walkFiles(rootDir, abs);
    } else if (st.isFile()) {
      yield abs;
    }
  }
}
