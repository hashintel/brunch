// Materialize `<parentSandboxDir>/__epic__/<epicId>/` as the union of completed
// slice worktrees at `<parentSandboxDir>/<sliceId>/`. Sources apply in plan
// declaration order among included slices; later slices overwrite earlier ones
// on the same path and the collision is reported. Source worktrees are not
// mutated. The verify dir is rebuilt fresh on every call.

import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

import type { Plan, Slice } from './types.js';

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
  /** Parent worktree dir holding slice sandboxes at `<parentSandboxDir>/<sliceId>`. */
  parentSandboxDir: string;
  epicId: string;
  /** Slice ids to merge in plan declaration order. */
  sliceIds: string[];
};

/** Epic ids whose slice worktrees participate in verify-epic for `epicId`. */
export function epicIdsForEpicVerifyMerge(plan: Plan, epicId: string): string[] {
  const epicIds = new Set<string>();

  const visitEpic = (id: string) => {
    if (epicIds.has(id)) return;
    const epic = plan.epics.find((e) => e.id === id);
    if (!epic) return;
    epicIds.add(id);
    for (const dep of epic.depends_on) visitEpic(dep);
  };

  const visitedSliceDeps = new Set<string>();
  const visitSliceDeps = (sliceId: string) => {
    if (visitedSliceDeps.has(sliceId)) return;
    visitedSliceDeps.add(sliceId);
    const slice = plan.slices.find((s) => s.id === sliceId);
    if (!slice) return;
    visitEpic(slice.epic_id);
    for (const depId of slice.depends_on) visitSliceDeps(depId);
  };

  visitEpic(epicId);
  for (const slice of plan.slices.filter((s) => s.epic_id === epicId)) {
    for (const depId of slice.depends_on) visitSliceDeps(depId);
  }

  return plan.epics.filter((e) => epicIds.has(e.id)).map((e) => e.id);
}

/** Slice ids to merge before verify-epic: deps then target epic, plan declaration order. */
export function sliceIdsForEpicVerifyMerge(plan: Plan, epicId: string): string[] {
  const epicIds = epicIdsForEpicVerifyMerge(plan, epicId);
  const epicOrder = new Map(epicIds.map((id, i) => [id, i]));
  return plan.slices.filter((s) => epicOrder.has(s.epic_id)).map((s) => s.id);
}

/** Reserved under the parent sandbox for merged epic verify trees. */
const EPIC_MERGE_SEGMENT = '__epic__';

function assertSafePathSegment(id: string, label: string): void {
  if (!id || id.includes('..') || id.includes('/') || id.includes('\\')) {
    throw new Error(`Invalid ${label}: ${id}`);
  }
  if (id === EPIC_MERGE_SEGMENT) {
    throw new Error(`Invalid ${label}: ${id}`);
  }
}

function resolveEpicSandboxDir(parentSandboxDir: string, epicId: string): string {
  assertSafePathSegment(epicId, 'epic id');
  const parent = resolve(parentSandboxDir);
  const epicRoot = resolve(parent, EPIC_MERGE_SEGMENT);
  const dir = resolve(epicRoot, epicId);
  if (dir === parent || !dir.startsWith(epicRoot + sep)) {
    throw new Error(`Invalid epic id: ${epicId}`);
  }
  return dir;
}

export function resolveSliceWorktreeDir(parentSandboxDir: string, sliceId: string): string {
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

function prepareDestForFile(treeRoot: string, dest: string): void {
  const root = resolve(treeRoot);
  const dir = dirname(resolve(dest));
  if (dir !== root && !dir.startsWith(root + sep)) {
    throw new Error(`Path escapes sandbox: ${dest}`);
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

function copyIntoTree(src: string, dest: string, treeRoot: string): void {
  prepareDestForFile(treeRoot, dest);
  if (existsSync(dest) && lstatSync(dest).isDirectory()) {
    rmSync(dest, { recursive: true, force: true });
  }
  cpSync(src, dest, { dereference: false });
}

export type SeedSliceSandboxOptions = {
  /** Keep slice-owned paths; only add missing dependency files (post-action test/assess). */
  preserveExisting?: boolean;
};

/** Dependency slice ids in plan declaration order (matches epic verify merge). */
function depSliceIdsInPlanOrder(plan: Plan, slice: Slice): string[] {
  const order = new Map(plan.slices.map((s, i) => [s.id, i]));
  return [...slice.depends_on].sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
}

function collectDepFiles(parentSandboxDir: string, plan: Plan, slice: Slice): Map<string, string> {
  const depFiles = new Map<string, string>();
  for (const depId of depSliceIdsInPlanOrder(plan, slice)) {
    const depDir = resolveSliceWorktreeDir(parentSandboxDir, depId);
    if (!existsSync(depDir)) continue;

    for (const file of walkFiles(depDir)) {
      const rel = relativePathWithin(depDir, file);
      depFiles.set(rel, file);
    }
  }
  return depFiles;
}

function pruneEmptyDirs(rootDir: string, dir: string = rootDir): void {
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    if (lstatSync(abs).isDirectory()) {
      pruneEmptyDirs(rootDir, abs);
    }
  }
  if (dir !== rootDir && readdirSync(dir).length === 0) {
    rmSync(dir);
  }
}

/** Copy completed dependency slice worktrees into `slice`'s sandbox (plan order). */
export function seedSliceSandboxFromDeps(
  parentSandboxDir: string,
  plan: Plan,
  slice: Slice,
  opts?: SeedSliceSandboxOptions,
): string {
  const preserveExisting = opts?.preserveExisting ?? false;
  const sliceDir = resolveSliceWorktreeDir(parentSandboxDir, slice.id);
  mkdirSync(sliceDir, { recursive: true });

  const depFiles = collectDepFiles(parentSandboxDir, plan, slice);

  if (!preserveExisting && depFiles.size > 0 && existsSync(sliceDir)) {
    for (const file of walkFiles(sliceDir)) {
      const rel = relativePathWithin(sliceDir, file);
      if (!depFiles.has(rel)) {
        rmSync(file, { force: true });
      }
    }
    pruneEmptyDirs(sliceDir);
  }

  for (const [rel, src] of depFiles) {
    const dest = join(sliceDir, rel);
    if (preserveExisting && existsSync(dest)) continue;
    copyIntoTree(src, dest, sliceDir);
  }

  return sliceDir;
}

export function mergeSlicesIntoEpicSandbox(opts: MergeOptions): MergeResult {
  const epicSandboxDir = resolveEpicSandboxDir(opts.parentSandboxDir, opts.epicId);

  if (existsSync(epicSandboxDir)) {
    rmSync(epicSandboxDir, { recursive: true, force: true });
  }
  mkdirSync(epicSandboxDir, { recursive: true });

  const writers = new Map<string, string[]>();
  const parent = resolve(opts.parentSandboxDir);
  const epicRoot = resolve(parent, EPIC_MERGE_SEGMENT);

  for (const sliceId of opts.sliceIds) {
    const sliceDir = resolveSliceWorktreeDir(opts.parentSandboxDir, sliceId);
    if (sliceDir === epicRoot || sliceDir.startsWith(epicRoot + sep)) continue;
    if (!existsSync(sliceDir)) continue;

    for (const file of walkFiles(sliceDir)) {
      const rel = relativePathWithin(sliceDir, file);
      const list = writers.get(rel) ?? [];
      list.push(sliceId);
      writers.set(rel, list);

      const dest = join(epicSandboxDir, rel);
      copyIntoTree(file, dest, epicSandboxDir);
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
