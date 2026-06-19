import { execFileSync } from 'node:child_process';
import {
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ensureSliceWorktree, seedSliceSandboxFromDeps } from './epic-sandbox-merge.js';
import {
  brunchRef,
  captureFoldedChangeBaseline,
  commitSliceWorktree,
  type CompletedRun,
  dependencyOrder,
  foldSliceBranches,
  harvestCookRun,
  materializeEpicVerifyTree,
  materializeFoldedWorktree,
  type SliceCommit,
  transferFoldedFixToSlice,
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

  it('3-way merges different-hunk edits to the same file (the file-copy union would drop one)', () => {
    // The headline correctness win over the file-copy union: two independent
    // slices edit different lines of the same pre-existing file. A whole-file
    // last-slice-wins copy keeps only one; the merge-tree fold keeps both.
    const a = sliceBranch('a', (d) => writeFileSync(join(d, 'base.txt'), 'A1\nl2\nl3\n'));
    const b = sliceBranch('b', (d) => writeFileSync(join(d, 'base.txt'), 'l1\nl2\nB3\n'));

    const artifact = foldSliceBranches({ sourceDir: repo, runId: 'r1', slices: [a, b] });

    expect(artifact.conflicts).toEqual([]);
    const folded = gitC(repo, 'show', `${brunchRef.run('r1')}:base.txt`); // gitC trims trailing newline
    expect(folded).toBe('A1\nl2\nB3'); // both edits survive
  });

  it('materializes the fold as a worktree on disk (verify against the shipped tree)', () => {
    // 1c: verify-epic runs tests against the same merged tree promotion ships.
    // Different-hunk edits to the same file must both be present on disk in the
    // checked-out verify worktree (the file-copy union would drop one).
    const a = sliceBranch('a', (d) => writeFileSync(join(d, 'base.txt'), 'A1\nl2\nl3\n'));
    const b = sliceBranch('b', (d) => writeFileSync(join(d, 'base.txt'), 'l1\nl2\nB3\n'));
    const dest = join(repo, '__verify__');

    const { conflicts } = materializeFoldedWorktree({ sourceDir: repo, base, slices: [a, b], destDir: dest });

    expect(conflicts).toEqual([]);
    expect(readFileSync(join(dest, 'base.txt'), 'utf8')).toBe('A1\nl2\nB3\n');
    // Re-runnable (rework): a second materialize over the same dest must not throw.
    expect(() =>
      materializeFoldedWorktree({ sourceDir: repo, base, slices: [a, b], destDir: dest }),
    ).not.toThrow();
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

    // Disjoint siblings (the dependency-seeded case has its own test below).
    const plan: Plan = {
      mode: 'greenfield',
      epics: [{ id: 'e', summary: 'E', depends_on: [], verification: [] }],
      slices: [slice('a'), slice('b')],
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

  it('dependency-seeded: a dependent slice that extends a dep file folds clean (no false conflict)', () => {
    // The dep-seed interaction the composer was left unwired for (871ef087). In a
    // real run, slice B (depends on A) has A's completed output copied into its
    // worktree by seedSliceSandboxFromDeps, then B extends it. Both slice branches
    // are rooted at the run base, so neither has the other as an ancestor.
    seedSliceWorktree('a', (d) => writeFileSync(join(d, 'lib.ts'), 'export const a = 1;\n'));
    seedSliceWorktree('b', (d) =>
      // dep-seeded A output, then B's own extension on top of it
      writeFileSync(join(d, 'lib.ts'), 'export const a = 1;\nexport const b = 2;\n'),
    );

    const plan: Plan = {
      mode: 'brownfield',
      epics: [{ id: 'e', summary: 'E', depends_on: [], verification: [] }],
      slices: [slice('a'), slice('b', ['a'])],
    };
    const run: CompletedRun = {
      sourceDir: source,
      parentSandboxDir: parent,
      runId: 'r1',
      plan,
      completedSliceIds: ['a', 'b'],
    };

    const artifact = harvestCookRun(run);

    // Desired: B's evolution of the dep-seeded file wins, no spurious conflict.
    expect(artifact.conflicts).toEqual([]);
    const lib = gitC(source, 'show', `${brunchRef.run('r1')}:lib.ts`);
    expect(lib).toContain('export const b = 2;');
  });

  it('dependency-seeded: a dep edit to a base-existing file survives the fold (I124-K, cook spec-49 repro)', () => {
    // The cook spec-49 halt. The dep slice edits a file present at the run base
    // (package.json there; base.txt here). The dependent is checked out at the
    // run base and seeded the production way — ensureSliceWorktree (base
    // checkout) then seedSliceSandboxFromDeps({preserveExisting:true}). If the
    // seed skips the base-checkout file because it already exists, the
    // dependent's tree lacks the dep's edit while commitSliceWorktree still
    // records the dep as a merge parent — so the fold reads the missing edit as
    // a deletion and phantom-deletes it (the @xyflow/react + d3-force drop).
    const plan: Plan = {
      mode: 'brownfield',
      epics: [{ id: 'e', summary: 'E', depends_on: [], verification: [] }],
      slices: [slice('dep'), slice('app', ['dep'])],
    };

    seedSliceWorktree('dep', (d) => writeFileSync(join(d, 'base.txt'), 'base\nedited-by-dep\n'));

    // Dependent 'app': base checkout, then the real production dependency seed.
    ensureSliceWorktree(parent, 'app', plan, 'r1');
    seedSliceSandboxFromDeps(parent, plan, slice('app', ['dep']), { preserveExisting: true });
    writeFileSync(join(parent, 'app', 'app.txt'), 'app\n');

    const artifact = harvestCookRun({
      sourceDir: source,
      parentSandboxDir: parent,
      runId: 'r1',
      plan,
      completedSliceIds: ['dep', 'app'],
    });

    expect(artifact.conflicts).toEqual([]);
    expect(gitC(source, 'show', `${brunchRef.run('r1')}:base.txt`)).toContain('edited-by-dep');
  });

  it('skips a slice that produced no changes', () => {
    seedSliceWorktree('a', (d) => writeFileSync(join(d, 'a.txt'), 'A\n'));
    seedSliceWorktree('noop', () => {}); // wrote nothing

    expect(commitSliceWorktree({ parentSandboxDir: parent, slice: slice('noop') })).toBeNull();
  });

  it('reuses slices already committed by a prior verify pass (verify → promote)', () => {
    // verify-epic commits the slice worktrees (materializeEpicVerifyTree); the
    // later promotion harvest must reuse those commits, not see a clean worktree
    // and drop the slice as empty.
    seedSliceWorktree('a', (d) => writeFileSync(join(d, 'a.txt'), 'A\n'));
    const plan: Plan = {
      mode: 'brownfield',
      epics: [{ id: 'e', summary: 'E', depends_on: [], verification: [] }],
      slices: [slice('a')],
    };

    materializeEpicVerifyTree({ parentSandboxDir: parent, runId: 'r1', plan, sliceIds: ['a'], epicId: 'e' });
    const artifact = harvestCookRun({
      sourceDir: source,
      parentSandboxDir: parent,
      runId: 'r1',
      plan,
      completedSliceIds: ['a'],
    });

    expect(artifact.commits.map((c) => c.sliceId)).toEqual(['a']);
    expect(gitC(source, 'ls-tree', '-r', '--name-only', brunchRef.run('r1')).split('\n')).toContain('a.txt');
  });

  it('links brownfield verify deps from a slice install when it added dependencies', () => {
    writeFileSync(join(source, '.git/info/exclude'), 'node_modules/\n');
    mkdirSync(join(parent, 'node_modules/base'), { recursive: true });
    writeFileSync(join(parent, 'node_modules/base/index.js'), 'base\n');
    seedSliceWorktree('a', (d) => {
      writeFileSync(join(d, 'a.txt'), 'A\n');
      mkdirSync(join(d, 'node_modules/added'), { recursive: true });
      writeFileSync(join(d, 'node_modules/added/index.js'), 'added\n');
    });
    const plan: Plan = {
      mode: 'brownfield',
      epics: [{ id: 'e', summary: 'E', depends_on: [], verification: [] }],
      slices: [slice('a')],
    };

    const result = materializeEpicVerifyTree({
      parentSandboxDir: parent,
      runId: 'r1',
      plan,
      sliceIds: ['a'],
      epicId: 'e',
    });

    const link = join(result.epicSandboxDir, 'node_modules');
    expect(lstatSync(link).isSymbolicLink()).toBe(true);
    expect(readlinkSync(link)).toBe(join(parent, 'a', 'node_modules'));
    expect(readFileSync(join(link, 'added/index.js'), 'utf8')).toBe('added\n');
  });
});

// FE-884: the remediation round-trip — the riskiest assumption. A fix made in the
// detached folded epic tree must reach a *slice branch* (harvest never folds the
// epic dir), and a fix that edits the epic's integration test must be rejected.
describe('transferFoldedFixToSlice (FE-884 remediation round-trip)', () => {
  let source: string;
  let parent: string;
  let foldedDir: string;
  const plan: Plan = {
    mode: 'brownfield',
    epics: [
      {
        id: 'e',
        summary: 'E',
        depends_on: [],
        verification: [{ kind: 'integration-test', target: 'it.test.ts' }],
      },
    ],
    slices: [slice('a')],
  };

  beforeEach(() => {
    source = mkdtempSync(join(tmpdir(), 'brunch-remediate-'));
    gitC(source, 'init', '-q', '-b', 'main');
    writeFileSync(join(source, 'base.txt'), 'base\n');
    gitC(source, 'add', '-A');
    gitC(source, 'commit', '-q', '-m', 'base');
    parent = join(source, 'sandbox');
    gitC(source, 'worktree', 'add', '-q', '-b', brunchRef.run('r1'), parent, 'HEAD');
    // Slice 'a' worktree carries the (buggy) product file the agent will fix.
    const sliceDir = join(parent, 'a');
    gitC(source, 'worktree', 'add', '-q', '-b', brunchRef.slice('r1', 'a'), sliceDir, brunchRef.run('r1'));
    writeFileSync(join(sliceDir, 'lib.ts'), 'export const view = "broken";\n');
    // verify-epic composed the folded tree (commits slice 'a', folds it detached).
    foldedDir = materializeEpicVerifyTree({
      parentSandboxDir: parent,
      runId: 'r1',
      plan,
      sliceIds: ['a'],
      epicId: 'e',
    }).epicSandboxDir;
  });
  afterEach(() => rmSync(source, { recursive: true, force: true }));

  it('round-trips a product-code fix onto the slice branch so harvest folds it', () => {
    // The remediation agent fixes the bug in the folded tree (where the epic test runs).
    writeFileSync(join(foldedDir, 'lib.ts'), 'export const view = "fixed";\n');

    const outcome = transferFoldedFixToSlice({
      parentSandboxDir: parent,
      foldedDir,
      slice: slice('a'),
      epicTestTargets: ['it.test.ts'],
    });
    expect(outcome.accepted).toBe(true);

    // The fix is on the slice branch...
    expect(gitC(source, 'show', `${brunchRef.slice('r1', 'a')}:lib.ts`)).toContain('fixed');
    // ...and therefore survives promotion (harvest folds slice branches, not the epic dir).
    const artifact = harvestCookRun({
      sourceDir: source,
      parentSandboxDir: parent,
      runId: 'r1',
      plan,
      completedSliceIds: ['a'],
    });
    expect(artifact.conflicts).toEqual([]);
    expect(gitC(source, 'show', `${brunchRef.run('r1')}:lib.ts`)).toContain('fixed');
  });

  it('rejects (detect-and-reject) an attempt that edits the epic integration test', () => {
    // An agent tries to green the epic by gutting its own oracle.
    writeFileSync(join(foldedDir, 'it.test.ts'), 'it("passes", () => {});\n');
    writeFileSync(join(foldedDir, 'lib.ts'), 'export const view = "sneaky";\n');

    const outcome = transferFoldedFixToSlice({
      parentSandboxDir: parent,
      foldedDir,
      slice: slice('a'),
      epicTestTargets: ['it.test.ts'],
    });

    expect(outcome.accepted).toBe(false);
    expect(outcome.reason).toBe('touched-test');
    // The whole attempt is discarded — nothing reaches the slice branch.
    expect(gitC(source, 'show', `${brunchRef.slice('r1', 'a')}:lib.ts`)).toContain('broken');
  });

  it('ignores unchanged verify-test files that were dirty before remediation', () => {
    // verify-epic writes the failing integration test before the remediation
    // agent runs. That baseline oracle must not be mistaken for an agent edit.
    writeFileSync(join(foldedDir, 'it.test.ts'), 'it("fails until product is fixed", () => {});\n');
    const baseline = captureFoldedChangeBaseline(foldedDir);
    writeFileSync(join(foldedDir, 'lib.ts'), 'export const view = "fixed";\n');

    const outcome = transferFoldedFixToSlice({
      parentSandboxDir: parent,
      foldedDir,
      slice: slice('a'),
      epicTestTargets: ['it.test.ts'],
      baseline,
    });

    expect(outcome).toMatchObject({ accepted: true, touched: ['lib.ts'] });
    expect(gitC(source, 'show', `${brunchRef.slice('r1', 'a')}:lib.ts`)).toContain('fixed');
    expect(gitC(source, 'ls-tree', '-r', '--name-only', brunchRef.slice('r1', 'a'))).not.toContain(
      'it.test.ts',
    );
  });

  it('rejects a no-op attempt (agent changed nothing)', () => {
    const outcome = transferFoldedFixToSlice({
      parentSandboxDir: parent,
      foldedDir,
      slice: slice('a'),
      epicTestTargets: ['it.test.ts'],
    });
    expect(outcome.accepted).toBe(false);
    expect(outcome.reason).toBe('no-op');
  });
});
