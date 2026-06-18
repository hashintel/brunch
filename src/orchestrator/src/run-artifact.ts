// The cook → brunch promotion seam: turn a completed run's per-slice work into
// a durable, reviewable git artifact on the run branch (`brunch/run/<runId>`).
//
// Composition is a real `git merge-tree` fold of the per-slice branches in
// dependency order — not a file-copy union. So genuine cross-slice conflicts
// surface (fail-closed) instead of the old silent last-slice-wins, and the
// output is per-slice history (a merge node per slice) rather than one squash.
// All git work is plumbing (`merge-tree` / `commit-tree` / `update-ref`): no
// working tree, index, or active branch is ever touched — the slice worktrees
// are nested under the run worktree, so an in-worktree merge would be a footgun.

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

import { linkSharedTopLevelEntries } from './cow-copy.js';
import {
  resolveEpicSandboxDir,
  resolveSliceWorktreeDir,
  SHAREABLE_TOP_LEVEL_ENTRIES,
} from './epic-sandbox-merge.js';
import { brunchRef } from './run-refs.js';
import type { Plan, Slice } from './types.js';

export { brunchRef } from './run-refs.js';

/**
 * How a harvested run branch records its slices.
 * - `per-slice-then-merge` (default): one merge node per slice, folded in
 *   dependency order — reviewable per-slice history with an integration node.
 * - `squash`: the same fold collapsed to a single commit off the base — kept for
 *   cheap/throwaway runs and A-B comparison (closed enum, not a policy zoo).
 */
export type CommitGranularity = 'per-slice-then-merge' | 'squash';

/** A real cross-slice merge conflict — the fold stops at the first one (fail-closed). */
export type SliceConflict = { sliceId: string; paths: string[] };

/** One slice's commit on its `brunch/slice/<runId>/<sliceId>` branch, folded into the run. */
export type SliceCommit = { sliceId: string; commit: string; title: string };

export type RunArtifact = {
  /** brunch/run/<runId> */
  branch: string;
  /** Tip of the run branch after the fold (the last clean tip if a conflict halted it). */
  head: string;
  /** Per-slice commits folded in, in order (empty for a squashed or conflict-halted-at-start run). */
  commits: SliceCommit[];
  /** Real conflicts that halted the fold; empty on the happy path. */
  conflicts: SliceConflict[];
};

export type CompletedRun = {
  /** The user's repo root (object store + where the run/slice branch refs live). */
  sourceDir: string;
  /** Parent worktree holding slice worktrees at `<parentSandboxDir>/<sliceId>`. */
  parentSandboxDir: string;
  runId: string;
  plan: Plan;
  /** Slice ids that completed; harvest re-sorts into dependency order. */
  completedSliceIds: string[];
};

// Deterministic committer so promotion never depends on (or mutates) global git config.
const COMMIT_IDENTITY = ['-c', 'user.name=brunch', '-c', 'user.email=cook@brunch'];

function git(args: string[], cwd: string): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

/**
 * A 3-way merge of two commits via plumbing — writes the merged tree to the
 * object store and reports conflicts without a working tree. `git merge-tree
 * --write-tree --name-only` prints the tree OID on line 1; on conflict it exits
 * non-zero and lists the conflicted paths until a blank line (then human
 * messages we ignore).
 */
function mergeTree(
  sourceDir: string,
  base: string,
  incoming: string,
): { ok: true; tree: string } | { ok: false; paths: string[] } {
  const res = spawnSync('git', ['merge-tree', '--write-tree', '--name-only', base, incoming], {
    cwd: sourceDir,
    encoding: 'utf8',
  });
  const lines = (res.stdout ?? '').split('\n');
  if (res.status === 0) return { ok: true, tree: lines[0]!.trim() };
  const paths: string[] = [];
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '') break; // blank line separates the path list from messages
    paths.push(lines[i]!);
  }
  return { ok: false, paths };
}

/** A one-line, length-capped commit title from a slice's definition. */
function sliceTitle(slice: Slice): string {
  const firstLine = slice.definition.split('\n')[0]?.trim() ?? slice.id;
  return firstLine.length > 72 ? `${firstLine.slice(0, 69)}...` : firstLine || slice.id;
}

/** Completed slices in dependency order (deps before dependents), declaration-order tiebreak. */
export function dependencyOrder(plan: Plan, completedSliceIds: readonly string[]): Slice[] {
  const wanted = new Set(completedSliceIds);
  const byId = new Map(plan.slices.map((s) => [s.id, s]));
  const decl = new Map(plan.slices.map((s, i) => [s.id, i]));
  const byDecl = (a: string, b: string) => (decl.get(a) ?? 0) - (decl.get(b) ?? 0);
  const done = new Set<string>();
  const out: Slice[] = [];
  const visit = (id: string) => {
    if (done.has(id) || !wanted.has(id)) return;
    const slice = byId.get(id);
    if (!slice) return;
    for (const dep of [...slice.depends_on].sort(byDecl)) visit(dep);
    if (done.has(id)) return;
    done.add(id);
    out.push(slice);
  };
  for (const id of [...completedSliceIds].sort(byDecl)) visit(id);
  return out;
}

/**
 * Commit a slice's worktree to its `brunch/slice/<runId>/<sliceId>` branch.
 * Returns the commit handle, or null when the slice produced no changes (nothing
 * to fold). Runs only in the slice's own throwaway worktree.
 *
 * `parents` carries the commits of this slice's completed dependencies. The slice
 * worktree was seeded with its deps' output (`seedSliceSandboxFromDeps`), so
 * recording that ancestry makes the run fold compute the right merge base: a
 * dep-seeded file then reads as an edit the dependent slice evolved, not an
 * add/add conflict against the run base. Without it the fold false-conflicts on
 * every dep-modified file — the dependency-seed interaction this composer was
 * left unwired for (871ef087).
 */
export function commitSliceWorktree(opts: {
  parentSandboxDir: string;
  slice: Slice;
  parents?: readonly string[];
}): SliceCommit | null {
  const sliceDir = resolveSliceWorktreeDir(opts.parentSandboxDir, opts.slice.id);
  const title = sliceTitle(opts.slice);
  git(['add', '-A'], sliceDir);
  if (git(['diff', '--cached', '--name-only'], sliceDir) === '') {
    // Nothing new to stage. If a prior verify-epic already committed this slice
    // (its tip is our `brunch(<id>):` commit), reuse it — verify and promotion
    // both harvest the same worktrees, and the second pass must not lose the
    // first's commit. Otherwise the slice genuinely produced no changes.
    const headMsg = git(['log', '-1', '--format=%s'], sliceDir);
    if (headMsg.startsWith(`brunch(${opts.slice.id}):`)) {
      return { sliceId: opts.slice.id, commit: git(['rev-parse', 'HEAD'], sliceDir), title };
    }
    return null;
  }
  // commit-tree (not `git commit`) so the slice commit can carry its dependency
  // commits as additional parents alongside the run base.
  const base = git(['rev-parse', 'HEAD'], sliceDir);
  const tree = git(['write-tree'], sliceDir);
  const parentArgs = ['-p', base, ...(opts.parents ?? []).flatMap((p) => ['-p', p])];
  const commit = git(
    [...COMMIT_IDENTITY, 'commit-tree', tree, ...parentArgs, '-m', `brunch(${opts.slice.id}): ${title}`],
    sliceDir,
  );
  git(['update-ref', 'HEAD', commit], sliceDir);
  return { sliceId: opts.slice.id, commit, title };
}

/**
 * Fold the given slice commits into the run branch in order via `merge-tree`,
 * producing one merge node per slice. Stops at the first real conflict and
 * leaves the run branch at the last clean tip (fail-closed). With
 * `granularity: 'squash'` the same fold is collapsed into a single commit off
 * the base — the per-slice trees are still merged (so conflicts still surface),
 * only the recorded history differs.
 */
export function foldSliceBranches(opts: {
  sourceDir: string;
  runId: string;
  slices: readonly SliceCommit[];
  granularity?: CommitGranularity;
}): RunArtifact {
  const sourceDir = resolve(opts.sourceDir);
  const granularity = opts.granularity ?? 'per-slice-then-merge';
  const branch = brunchRef.run(opts.runId);
  const ref = `refs/heads/${branch}`;
  const base = git(['rev-parse', '--verify', ref], sourceDir);

  const folded = foldToCommit({ sourceDir, base, slices: opts.slices });
  let head = folded.head;

  // per-slice-then-merge: publish the folded chain of merge nodes.
  // squash: collapse the final tree into a single commit off the base instead.
  if (granularity === 'squash' && folded.commits.length > 0) {
    const tree = git(['rev-parse', `${head}^{tree}`], sourceDir);
    head = git([...COMMIT_IDENTITY, 'commit-tree', tree, '-p', base, '-m', `cook: ${opts.runId}`], sourceDir);
  }
  if (head !== base) git(['update-ref', ref, head, base], sourceDir);

  return {
    branch,
    head,
    commits: granularity === 'squash' ? [] : folded.commits,
    conflicts: folded.conflicts,
  };
}

/**
 * Core fold: `merge-tree`-fold the slice commits onto `base` in dependency order,
 * one merge node per slice, fail-closed at the first real conflict (leaving the
 * last clean tip). Writes no refs — callers decide whether to publish the result
 * (promotion → run branch) or check it out (verify-epic → a worktree).
 */
function foldToCommit(opts: { sourceDir: string; base: string; slices: readonly SliceCommit[] }): {
  head: string;
  commits: SliceCommit[];
  conflicts: SliceConflict[];
} {
  const { sourceDir, base } = opts;
  let head = base;
  const commits: SliceCommit[] = [];
  const conflicts: SliceConflict[] = [];

  for (const slice of opts.slices) {
    const merged = mergeTree(sourceDir, head, slice.commit);
    if (!merged.ok) {
      conflicts.push({ sliceId: slice.sliceId, paths: merged.paths });
      break; // fail-closed: stop at the last clean tip
    }
    head = git(
      [
        ...COMMIT_IDENTITY,
        'commit-tree',
        merged.tree,
        '-p',
        head,
        '-p',
        slice.commit,
        '-m',
        `brunch(${slice.sliceId}): ${slice.title}`,
      ],
      sourceDir,
    );
    commits.push(slice);
  }

  return { head, commits, conflicts };
}

/**
 * Materialize the fold of `slices` onto `base` as a detached git worktree at
 * `destDir`, so verify-epic runs tests against the *same* merged tree promotion
 * will ship — not a file-copy union that can diverge on same-file edits. The fold
 * is fail-closed: on a real conflict the worktree is the last clean tip and the
 * conflicts are returned. Re-creatable across reworks (a prior worktree at destDir
 * is removed first). Caller relinks shareable gitignored entries (node_modules)
 * since the fold tree carries only tracked content.
 */
export function materializeFoldedWorktree(opts: {
  sourceDir: string;
  base: string;
  slices: readonly SliceCommit[];
  destDir: string;
}): { conflicts: SliceConflict[] } {
  const sourceDir = resolve(opts.sourceDir);
  const folded = foldToCommit({ sourceDir, base: opts.base, slices: opts.slices });
  if (existsSync(opts.destDir)) {
    try {
      git(['worktree', 'remove', '--force', opts.destDir], sourceDir);
    } catch {
      rmSync(opts.destDir, { recursive: true, force: true });
    }
  }
  git(['worktree', 'prune'], sourceDir);
  git(['worktree', 'add', '--quiet', '--detach', opts.destDir, folded.head], sourceDir);
  return { conflicts: folded.conflicts };
}

/**
 * Harvest a completed run into its `brunch/run/<runId>` artifact: commit each
 * slice's worktree to its branch, then fold the branches in dependency order.
 * The 90% brownfield path. Fail-closed on real conflicts; the partial run branch
 * stays inspectable and the `conflicts` report names what to resolve by hand.
 */
/**
 * Commit the given slices' worktrees in dependency order, recording each slice's
 * already-committed dependency commits as parents (so the fold's merge-base is the
 * dependency, not the run base). Shared by run promotion and epic verification.
 */
function commitSlicesInDependencyOrder(opts: {
  parentSandboxDir: string;
  plan: Plan;
  sliceIds: readonly string[];
}): SliceCommit[] {
  const ordered = dependencyOrder(opts.plan, opts.sliceIds);
  const commitBySlice = new Map<string, string>();
  const slices: SliceCommit[] = [];
  for (const slice of ordered) {
    const parents = slice.depends_on
      .map((depId) => commitBySlice.get(depId))
      .filter((c): c is string => c !== undefined);
    const sc = commitSliceWorktree({ parentSandboxDir: opts.parentSandboxDir, slice, parents });
    if (sc) {
      commitBySlice.set(slice.id, sc.commit);
      slices.push(sc);
    }
  }
  return slices;
}

export function harvestCookRun(run: CompletedRun, opts?: { granularity?: CommitGranularity }): RunArtifact {
  const slices = commitSlicesInDependencyOrder({
    parentSandboxDir: run.parentSandboxDir,
    plan: run.plan,
    sliceIds: run.completedSliceIds,
  });
  return foldSliceBranches({
    sourceDir: run.sourceDir,
    runId: run.runId,
    slices,
    ...(opts?.granularity ? { granularity: opts.granularity } : {}),
  });
}

/**
 * Verify-epic composition (brownfield): commit the epic's completed slices and
 * materialize their fold as a detached worktree at `__epic__/<epicId>/`, so
 * verify-epic runs tests against the *same* merged tree promotion will ship —
 * replacing the file-copy union that silently last-slice-wins on same-file edits.
 * The fold is fail-closed; a non-empty `conflicts` means the materialized tree is
 * the last clean tip and the epic should fail rather than verify a partial tree.
 * Relinks shareable gitignored entries (node_modules) so tests can run.
 */
export function materializeEpicVerifyTree(opts: {
  /** The run worktree: shares the object store, holds slice worktrees, owns brunch/run/<runId>. */
  parentSandboxDir: string;
  runId: string;
  plan: Plan;
  /** The epic's completed slices (+ cross-epic deps), any order. */
  sliceIds: readonly string[];
  epicId: string;
}): { epicSandboxDir: string; conflicts: SliceConflict[] } {
  const parentSandboxDir = resolve(opts.parentSandboxDir);
  const epicSandboxDir = resolveEpicSandboxDir(parentSandboxDir, opts.epicId);
  const slices = commitSlicesInDependencyOrder({
    parentSandboxDir,
    plan: opts.plan,
    sliceIds: opts.sliceIds,
  });
  const base = git(['rev-parse', '--verify', `refs/heads/${brunchRef.run(opts.runId)}`], parentSandboxDir);
  const { conflicts } = materializeFoldedWorktree({
    sourceDir: parentSandboxDir,
    base,
    slices,
    destDir: epicSandboxDir,
  });
  // The fold tree carries only tracked content; relink shared deps for the test run.
  linkSharedTopLevelEntries(parentSandboxDir, epicSandboxDir, SHAREABLE_TOP_LEVEL_ENTRIES);
  return { epicSandboxDir, conflicts };
}
