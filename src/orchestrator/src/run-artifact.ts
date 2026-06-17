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
import { resolve } from 'node:path';

import { resolveSliceWorktreeDir } from './epic-sandbox-merge.js';
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
 */
export function commitSliceWorktree(opts: { parentSandboxDir: string; slice: Slice }): SliceCommit | null {
  const sliceDir = resolveSliceWorktreeDir(opts.parentSandboxDir, opts.slice.id);
  git(['add', '-A'], sliceDir);
  if (git(['diff', '--cached', '--name-only'], sliceDir) === '') return null;
  const title = sliceTitle(opts.slice);
  git([...COMMIT_IDENTITY, 'commit', '-q', '-m', `brunch(${opts.slice.id}): ${title}`], sliceDir);
  return { sliceId: opts.slice.id, commit: git(['rev-parse', 'HEAD'], sliceDir), title };
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

  let head = base;
  const commits: SliceCommit[] = [];
  const conflicts: SliceConflict[] = [];

  for (const slice of opts.slices) {
    const merged = mergeTree(sourceDir, head, slice.commit);
    if (!merged.ok) {
      conflicts.push({ sliceId: slice.sliceId, paths: merged.paths });
      break; // fail-closed: stop, leave the run branch at the last clean tip
    }
    const node = git(
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
    head = node;
    commits.push(slice);
  }

  // per-slice-then-merge: publish the folded chain of merge nodes.
  // squash: collapse the final tree into a single commit off the base instead.
  if (granularity === 'squash' && commits.length > 0) {
    const tree = git(['rev-parse', `${head}^{tree}`], sourceDir);
    head = git([...COMMIT_IDENTITY, 'commit-tree', tree, '-p', base, '-m', `cook: ${opts.runId}`], sourceDir);
  }
  if (head !== base) git(['update-ref', ref, head, base], sourceDir);

  return { branch, head, commits: granularity === 'squash' ? [] : commits, conflicts };
}

/**
 * Harvest a completed run into its `brunch/run/<runId>` artifact: commit each
 * slice's worktree to its branch, then fold the branches in dependency order.
 * The 90% brownfield path. Fail-closed on real conflicts; the partial run branch
 * stays inspectable and the `conflicts` report names what to resolve by hand.
 */
export function harvestCookRun(run: CompletedRun, opts?: { granularity?: CommitGranularity }): RunArtifact {
  const ordered = dependencyOrder(run.plan, run.completedSliceIds);
  const slices = ordered
    .map((slice) => commitSliceWorktree({ parentSandboxDir: run.parentSandboxDir, slice }))
    .filter((c): c is SliceCommit => c !== null);
  return foldSliceBranches({
    sourceDir: run.sourceDir,
    runId: run.runId,
    slices,
    ...(opts?.granularity ? { granularity: opts.granularity } : {}),
  });
}
