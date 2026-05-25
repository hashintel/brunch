// Materialize `<parentSandboxDir>/__epic__/<epicId>/` as the union of epic-scoped
// worktrees at `<parentSandboxDir>/<sourceEpicId>/`. Sources apply in epic
// dependency order (plan declaration order among included epics); later epics
// overwrite earlier ones on the same path and the collision is reported.
// Source worktrees are not mutated. The verify dir is rebuilt fresh on every call.

import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

import type { Plan } from './types.js';

export type MergeConflict = {
  path: string;
  epics: string[];
  winner: string;
};

export type MergeResult = {
  epicSandboxDir: string;
  conflicts: MergeConflict[];
};

export type MergeOptions = {
  /** Parent worktree dir holding epic sandboxes at `<parentSandboxDir>/<sourceEpicId>`. */
  parentSandboxDir: string;
  epicId: string;
  /** Epic ids to merge in plan declaration order (this epic plus transitive deps). */
  epicIds: string[];
};

/** Epic ids to merge before verify-epic: transitive deps then target, plan declaration order. */
export function epicIdsForEpicVerifyMerge(plan: Plan, epicId: string): string[] {
  const epicIds = new Set<string>();
  const visit = (id: string) => {
    if (epicIds.has(id)) return;
    const epic = plan.epics.find((e) => e.id === id);
    if (!epic) return;
    for (const dep of epic.depends_on) visit(dep);
    epicIds.add(id);
  };
  visit(epicId);
  return plan.epics.filter((e) => epicIds.has(e.id)).map((e) => e.id);
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

function resolveEpicWorktreeDir(parentSandboxDir: string, sourceEpicId: string): string {
  assertSafePathSegment(sourceEpicId, 'epic id');
  const parent = resolve(parentSandboxDir);
  const dir = resolve(parent, sourceEpicId);
  if (dir === parent || !dir.startsWith(parent + sep)) {
    throw new Error(`Invalid epic id: ${sourceEpicId}`);
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
  const parent = resolve(opts.parentSandboxDir);
  const epicRoot = resolve(parent, EPIC_MERGE_SEGMENT);

  for (const sourceEpicId of opts.epicIds) {
    const epicWorktreeDir = resolveEpicWorktreeDir(opts.parentSandboxDir, sourceEpicId);
    if (epicWorktreeDir === epicRoot || epicWorktreeDir.startsWith(epicRoot + sep)) continue;
    if (!existsSync(epicWorktreeDir)) continue;

    for (const file of walkFiles(epicWorktreeDir)) {
      const rel = relativePathWithin(epicWorktreeDir, file);
      const list = writers.get(rel) ?? [];
      list.push(sourceEpicId);
      writers.set(rel, list);

      const dest = join(epicSandboxDir, rel);
      copyIntoEpicSandbox(file, dest, epicSandboxDir);
    }
  }

  const conflicts: MergeConflict[] = [];
  for (const [path, epics] of writers) {
    if (epics.length > 1) {
      conflicts.push({ path, epics, winner: epics[epics.length - 1]! });
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
