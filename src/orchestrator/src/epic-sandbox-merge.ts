// Materialize `<parentSandboxDir>/__epic__/<epicId>/` as the union of the
// epic's completed slice worktrees. Slices apply in declaration order; later
// slices overwrite earlier ones on the same path and the collision is
// reported. Per-slice worktrees are not mutated. The epic dir is rebuilt
// fresh on every call.

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

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

export function mergeSlicesIntoEpicSandbox(opts: MergeOptions): MergeResult {
  const epicSandboxDir = join(opts.parentSandboxDir, '__epic__', opts.epicId);

  if (existsSync(epicSandboxDir)) {
    rmSync(epicSandboxDir, { recursive: true, force: true });
  }
  mkdirSync(epicSandboxDir, { recursive: true });

  const writers = new Map<string, string[]>();

  for (const sliceId of opts.sliceIds) {
    const sliceDir = join(opts.parentSandboxDir, sliceId);
    if (!existsSync(sliceDir)) continue;

    for (const file of walkFiles(sliceDir)) {
      const rel = relative(sliceDir, file);
      const list = writers.get(rel) ?? [];
      list.push(sliceId);
      writers.set(rel, list);

      const dest = join(epicSandboxDir, rel);
      mkdirSync(join(dest, '..'), { recursive: true });
      cpSync(file, dest, { dereference: false });
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

function* walkFiles(dir: string): Iterable<string> {
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    const st = statSync(abs);
    if (st.isDirectory()) {
      yield* walkFiles(abs);
    } else {
      yield abs;
    }
  }
}
