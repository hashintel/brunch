// Materialize `<parentSandboxDir>/__epic__/<epicId>/` as the union of completed
// slice worktrees at `<parentSandboxDir>/<sliceId>/`. Sources apply in plan
// declaration order among included slices; later slices overwrite earlier ones
// on the same path and the collision is reported. Source worktrees are not
// mutated. The verify dir is rebuilt fresh on every call.
//
// Parallel-safety contract:
// - slice sandboxes are the only mutable roots during action/test/assess fires;
// - dependency seeding copies from already-completed dependency slice roots and
//   never mutates those source roots;
// - post-action validation uses preserveExisting, so dependency overlays add
//   missing inputs without deleting the current slice's own in-flight work;
// - rework/reset paths prune only the current slice sandbox outside the copied
//   dependency baseline.
//
// Merge breadth is bounded by plan topology: verify-epic includes the target
// epic, its transitive epic dependencies, and any transitive slice dependencies
// owned by other epics. It never walks filesystem state to discover more scope.

import { execFileSync, spawnSync } from 'node:child_process';
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

function assertSliceWorktreePathAvailable(parentSandboxDir: string, sliceId: string): void {
  const sliceDir = resolveSliceWorktreeDir(parentSandboxDir, sliceId);
  if (existsSync(sliceDir)) {
    throw new Error(`Slice id "${sliceId}" collides with an existing entry in the parent worktree`);
  }
}

/**
 * back to a regular recursive `cpSync` otherwise. Lazy at the block level
 * on APFS (macOS) and reflink-capable filesystems (Linux btrfs/xfs/etc.),
 * so large gitignored content like `node_modules/` costs ~zero disk on the
 * first copy.
 */
function cowCopy(src: string, dest: string): void {
  const flag = process.platform === 'darwin' ? '-c' : process.platform === 'linux' ? '--reflink=auto' : null;
  if (flag) {
    const result = spawnSync('cp', [flag, '-R', src, dest], { stdio: ['ignore', 'pipe', 'pipe'] });
    if (result.status === 0) return;
    // Fall through to cpSync on any failure (unsupported filesystem, missing
    // flag in the host cp, etc.) — correctness is preserved at the cost of disk.
  }
  cpSync(src, dest, { dereference: false, recursive: true });
}

/**
 * Codebase-mode seed: prepare the per-slice worktree as a real `git worktree`
 * checked out on a slice-level branch (`cook-slice/<runId>/<sliceId>`) off
 * the run-level cook branch, then CoW-copy any untracked/gitignored content
 * from the parent worktree (e.g. `node_modules/`, `dist/`) so pi-actions can
 * run `npm test` / `bun test` / build steps that depend on runtime deps.
 *
 * The slice branches live in a sibling namespace `cook-slice/` rather than
 * nested under `cook/<runId>/` because git refs are leaf-or-directory: with
 * `cook/<runId>` already a leaf branch, `cook/<runId>/<sliceId>` would fail
 * with "cannot lock ref ... 'refs/heads/cook/<runId>' exists."
 *
 * Excluded from the untracked CoW step:
 *   - sibling slice subdirs (other entries in `plan.slices`)
 *   - the `__epic__/` reserved merge dir
 *   - `.git` (the parent's worktree pointer; the new worktree gets its own)
 *   - any entry already created by `git worktree add` (tracked content)
 *
 * Returns the slice sandbox path. NOT safe to re-invoke against an existing
 * slice worktree — `git worktree add` would fail with "already exists." The
 * caller must remove the prior worktree first if re-seeding.
 *
 * TODO(cook-artifact-lifecycle follow-on, separate frontier): the slice branch
 * exists but is never committed to. After this lands, a future frontier should
 * add slice-completion commits, replace `mergeSlicesIntoEpicSandbox`'s file-copy
 * with a git merge of slice branches into an epic branch, and surface real
 * merge conflicts (today's file-copy is silent last-slice-wins). That work
 * earns the "discoverable cook artifact" criterion via `git merge cook/<runId>`
 * promotion semantics.
 */
export function seedSliceFromParentWorktree(
  parentSandboxDir: string,
  sliceId: string,
  plan: Plan,
  runId: string,
): string {
  assertSliceWorktreePathAvailable(parentSandboxDir, sliceId);
  const sliceDir = resolveSliceWorktreeDir(parentSandboxDir, sliceId);

  // 1. Real git worktree: tracked content arrives via git checkout, slice
  //    branch is `cook/<runId>/<sliceId>` off the parent worktree's HEAD
  //    (which is the run-level `cook/<runId>` branch). Shares the source
  //    repo's `.git/` object database via hardlinks — no full git copy.
  execFileSync(
    'git',
    ['worktree', 'add', '--quiet', '-b', `cook-slice/${runId}/${sliceId}`, sliceDir, 'HEAD'],
    {
      cwd: parentSandboxDir,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );

  // 2. CoW-copy whatever's in the parent worktree but NOT in the slice
  //    worktree yet — i.e. untracked / gitignored content (`node_modules/`,
  //    `dist/`, etc.) that pi-actions might need at runtime.
  const excludedNames = new Set<string>(['.git', EPIC_MERGE_SEGMENT]);
  for (const s of plan.slices) excludedNames.add(s.id);

  const parent = resolve(parentSandboxDir);
  for (const entry of readdirSync(parent)) {
    if (excludedNames.has(entry)) continue;
    const dest = join(sliceDir, entry);
    if (existsSync(dest)) continue; // already present from git worktree (tracked)
    const src = join(parent, entry);
    cowCopy(src, dest);
  }

  return sliceDir;
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
