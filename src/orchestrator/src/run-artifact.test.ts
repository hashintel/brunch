import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  brunchRef,
  commitSliceWorktree,
  type CompletedRun,
  dependencyOrder,
  foldSliceBranches,
  harvestCookRun,
  type SliceCommit,
} from './run-artifact.js';
import type { Plan, Slice } from './types.js';

function gitC(dir: string, ...args: string[]): string {
  return execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], {
    cwd: dir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function slice(id: string, depends_on: string[] = []): Slice {
  return { id, epic_id: 'e', definition: `do ${id}`, depends_on, verification: [] };
}

describe('dependencyOrder', () => {
  const plan: Plan = {
    mode: 'greenfield',
    epics: [{ id: 'e', summary: 'E', depends_on: [], verification: [] }],
    // declared out of dependency order on purpose
    slices: [slice('c', ['b']), slice('a'), slice('b', ['a'])],
  };

  it('orders deps before dependents', () => {
    expect(dependencyOrder(plan, ['a', 'b', 'c']).map((s) => s.id)).toEqual(['a', 'b', 'c']);
  });

  it('sorts regardless of input order and tolerates a dependency-closed partial set', () => {
    expect(dependencyOrder(plan, ['c', 'b', 'a']).map((s) => s.id)).toEqual(['a', 'b', 'c']);
    expect(dependencyOrder(plan, ['b', 'a']).map((s) => s.id)).toEqual(['a', 'b']);
    expect(dependencyOrder(plan, ['a']).map((s) => s.id)).toEqual(['a']);
  });
});

describe('foldSliceBranches (git merge-tree plumbing)', () => {
  let repo: string;
  let base: string;

  // A repo with a base commit, a brunch/run/r1 branch at base, and two slice
  // branches that each add their own file off the base.
  function sliceBranch(id: string, write: (dir: string) => void): SliceCommit {
    gitC(repo, 'checkout', '-q', '-b', brunchRef.slice('r1', id), base);
    write(repo);
    gitC(repo, 'add', '-A');
    gitC(repo, 'commit', '-q', '-m', `slice ${id}`);
    const commit = gitC(repo, 'rev-parse', 'HEAD');
    gitC(repo, 'checkout', '-q', base);
    return { sliceId: id, commit, title: `do ${id}` };
  }

  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), 'brunch-fold-'));
    gitC(repo, 'init', '-q', '-b', 'main');
    writeFileSync(join(repo, 'base.txt'), 'l1\nl2\nl3\n');
    gitC(repo, 'add', '-A');
    gitC(repo, 'commit', '-q', '-m', 'base');
    base = gitC(repo, 'rev-parse', 'HEAD');
    gitC(repo, 'branch', brunchRef.run('r1'), base);
  });
  afterEach(() => rmSync(repo, { recursive: true, force: true }));

  it('folds disjoint slices into the run branch with a merge node each (happy path)', () => {
    const a = sliceBranch('a', (d) => writeFileSync(join(d, 'a.txt'), 'A\n'));
    const b = sliceBranch('b', (d) => writeFileSync(join(d, 'b.txt'), 'B\n'));

    const artifact = foldSliceBranches({ sourceDir: repo, runId: 'r1', slices: [a, b] });

    expect(artifact.conflicts).toEqual([]);
    expect(artifact.commits.map((c) => c.sliceId)).toEqual(['a', 'b']);
    // Both slice files landed on the run branch, plus the untouched base.
    const files = gitC(repo, 'ls-tree', '-r', '--name-only', brunchRef.run('r1')).split('\n').sort();
    expect(files).toEqual(['a.txt', 'b.txt', 'base.txt']);
    // The tip is a merge node referencing the second slice commit as its 2nd parent.
    const parents = gitC(repo, 'rev-list', '--parents', '-n', '1', artifact.head).split(' ');
    expect(parents).toContain(b.commit);
  });

  it('surfaces a real conflict and fails closed at the last clean tip', () => {
    // Both slices rewrite the same base.txt line → genuine content conflict.
    const a = sliceBranch('a', (d) => writeFileSync(join(d, 'base.txt'), 'A1\nl2\nl3\n'));
    const b = sliceBranch('b', (d) => writeFileSync(join(d, 'base.txt'), 'B1\nl2\nl3\n'));

    const artifact = foldSliceBranches({ sourceDir: repo, runId: 'r1', slices: [a, b] });

    // a folds clean; b conflicts → recorded, fold halts.
    expect(artifact.commits.map((c) => c.sliceId)).toEqual(['a']);
    expect(artifact.conflicts).toEqual([{ sliceId: 'b', paths: ['base.txt'] }]);
    // Run branch advanced only through the clean slice (a), not b.
    const folded = gitC(repo, 'show', `${brunchRef.run('r1')}:base.txt`);
    expect(folded).toContain('A1');
    expect(folded).not.toContain('B1');
  });

  it('squash collapses the fold into a single commit off the base', () => {
    const a = sliceBranch('a', (d) => writeFileSync(join(d, 'a.txt'), 'A\n'));
    const b = sliceBranch('b', (d) => writeFileSync(join(d, 'b.txt'), 'B\n'));

    const artifact = foldSliceBranches({
      sourceDir: repo,
      runId: 'r1',
      slices: [a, b],
      granularity: 'squash',
    });

    expect(artifact.conflicts).toEqual([]);
    expect(artifact.commits).toEqual([]); // squashed — no per-slice history recorded
    // Single parent = the base commit (no merge node).
    const parents = gitC(repo, 'rev-list', '--parents', '-n', '1', artifact.head).split(' ').slice(1);
    expect(parents).toEqual([base]);
    // All slice content still present.
    const files = gitC(repo, 'ls-tree', '-r', '--name-only', brunchRef.run('r1')).split('\n').sort();
    expect(files).toEqual(['a.txt', 'b.txt', 'base.txt']);
  });
});

describe('harvestCookRun (commit slice worktrees + fold)', () => {
  let source: string;
  let parent: string;

  beforeEach(() => {
    source = mkdtempSync(join(tmpdir(), 'brunch-harvest-src-'));
    gitC(source, 'init', '-q', '-b', 'main');
    writeFileSync(join(source, 'base.txt'), 'base\n');
    gitC(source, 'add', '-A');
    gitC(source, 'commit', '-q', '-m', 'base');
    // The run worktree (parent sandbox) on brunch/run/r1, with nested slice worktrees.
    parent = join(source, 'sandbox');
    gitC(source, 'worktree', 'add', '-q', '-b', brunchRef.run('r1'), parent, 'HEAD');
  });
  afterEach(() => rmSync(source, { recursive: true, force: true }));

  function seedSliceWorktree(id: string, write: (dir: string) => void): void {
    const dir = join(parent, id);
    gitC(source, 'worktree', 'add', '-q', '-b', brunchRef.slice('r1', id), dir, brunchRef.run('r1'));
    write(dir);
  }

  it('commits each slice worktree and folds them onto the run branch', () => {
    seedSliceWorktree('a', (d) => writeFileSync(join(d, 'a.txt'), 'A\n'));
    seedSliceWorktree('b', (d) => writeFileSync(join(d, 'b.txt'), 'B\n'));

    const plan: Plan = {
      mode: 'greenfield',
      epics: [{ id: 'e', summary: 'E', depends_on: [], verification: [] }],
      slices: [slice('a'), slice('b', ['a'])],
    };
    const run: CompletedRun = {
      sourceDir: source,
      parentSandboxDir: parent,
      runId: 'r1',
      plan,
      completedSliceIds: ['b', 'a'],
    };

    const artifact = harvestCookRun(run);

    expect(artifact.conflicts).toEqual([]);
    expect(artifact.commits.map((c) => c.sliceId)).toEqual(['a', 'b']);
    const files = gitC(source, 'ls-tree', '-r', '--name-only', brunchRef.run('r1')).split('\n').sort();
    expect(files).toEqual(['a.txt', 'b.txt', 'base.txt']);
  });

  it('skips a slice that produced no changes', () => {
    seedSliceWorktree('a', (d) => writeFileSync(join(d, 'a.txt'), 'A\n'));
    seedSliceWorktree('noop', () => {}); // wrote nothing

    expect(commitSliceWorktree({ parentSandboxDir: parent, slice: slice('noop') })).toBeNull();
  });
});
