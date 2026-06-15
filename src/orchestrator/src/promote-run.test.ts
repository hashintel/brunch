import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { landCookBranch, promoteBrownfieldRun, promoteGreenfieldRun } from './promote-run.js';

const dirs: string[] = [];
const GIT_TEST_TIMEOUT_MS = 20_000;
afterEach(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
  dirs.length = 0;
});

function makeSandbox(): string {
  const d = mkdtempSync(join(tmpdir(), 'cook-sandbox-'));
  dirs.push(d);
  writeFileSync(join(d, 'index.ts'), 'export const x = 1;\n');
  mkdirSync(join(d, 'src'));
  writeFileSync(join(d, 'src', 'a.ts'), 'a\n');
  return d;
}

function tmpTarget(): string {
  const d = mkdtempSync(join(tmpdir(), 'cook-target-'));
  dirs.push(d);
  return d;
}

describe('promoteGreenfieldRun', () => {
  it('promotes the run tree into an empty target as an initial git commit', () => {
    const sandbox = makeSandbox();
    const target = tmpTarget();

    const result = promoteGreenfieldRun({ sandboxDir: sandbox, target, runId: 'r1', force: false });

    expect(readFileSync(join(target, 'index.ts'), 'utf8')).toContain('export const x');
    expect(existsSync(join(target, 'src', 'a.ts'))).toBe(true);
    expect(existsSync(join(target, '.git'))).toBe(true);
    const log = execFileSync('git', ['log', '--oneline'], { cwd: target, encoding: 'utf8' });
    expect(log.trim().length).toBeGreaterThan(0);
    expect(result.target).toBe(target);
    expect(result.branch.length).toBeGreaterThan(0);
  });

  it('captures the dependency manifest + lockfile in the promoted commit (reproducible tree)', () => {
    // FE-872 acceptance 2 (greenfield): the cook agent installs deps via bash;
    // promotion must capture the manifest + lockfile it produced so the promoted
    // tree is reproducible — pinned as an invariant, not left incidental to the
    // blanket copy. Asserted via `git ls-files` (tracked, not merely present).
    const sandbox = makeSandbox();
    writeFileSync(join(sandbox, 'package.json'), '{"name":"cooked","devDependencies":{"vitest":"^3"}}\n');
    writeFileSync(join(sandbox, 'bun.lock'), '{ "lockfileVersion": 1 }\n');

    const target = tmpTarget();
    promoteGreenfieldRun({ sandboxDir: sandbox, target, runId: 'r1', force: false });

    const tracked = execFileSync('git', ['ls-files'], { cwd: target, encoding: 'utf8' });
    expect(tracked).toContain('package.json');
    expect(tracked).toContain('bun.lock');
  });

  it('refuses a non-empty target without --force', () => {
    const sandbox = makeSandbox();
    const target = tmpTarget();
    writeFileSync(join(target, 'existing.txt'), 'keep\n');

    expect(() => promoteGreenfieldRun({ sandboxDir: sandbox, target, runId: 'r1', force: false })).toThrow(
      /force|empty/i,
    );
  });

  it('git-inits a fresh repo for an empty target nested inside an enclosing repo (no hijack)', () => {
    const sandbox = makeSandbox();
    const outer = tmpTarget();
    const id = ['-c', 'user.name=t', '-c', 'user.email=t@e'];
    execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: outer });
    writeFileSync(join(outer, 'outer.txt'), 'x\n');
    execFileSync('git', ['add', '.'], { cwd: outer });
    execFileSync('git', [...id, 'commit', '-q', '-m', 'base'], { cwd: outer });
    const headBefore = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: outer, encoding: 'utf8' }).trim();
    const branchesBefore = execFileSync('git', ['branch', '--list'], { cwd: outer, encoding: 'utf8' });

    const target = join(outer, 'sub');
    mkdirSync(target);
    const result = promoteGreenfieldRun({ sandboxDir: sandbox, target, runId: 'r1', force: false });

    // target is its own fresh repo holding the cook commit...
    expect(result.branch).toBe('main');
    expect(existsSync(join(target, '.git'))).toBe(true);
    expect(existsSync(join(target, 'index.ts'))).toBe(true);
    // ...and the enclosing repo is untouched (no cook branch, no commit, no tracked-file change).
    expect(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: outer, encoding: 'utf8' }).trim()).toBe(
      headBefore,
    );
    expect(execFileSync('git', ['branch', '--list'], { cwd: outer, encoding: 'utf8' })).toBe(branchesBefore);
    expect(
      execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], {
        cwd: outer,
        encoding: 'utf8',
      }),
    ).toBe('');
  });

  it('does not copy .git metadata from the promotion source', () => {
    const sandbox = makeSandbox();
    mkdirSync(join(sandbox, '.git'));
    writeFileSync(join(sandbox, '.git', 'evil-marker'), 'stale-worktree\n');

    const target = tmpTarget();
    const result = promoteGreenfieldRun({ sandboxDir: sandbox, target, runId: 'r1', force: false });

    expect(existsSync(join(target, 'index.ts'))).toBe(true);
    expect(existsSync(join(target, '.git', 'evil-marker'))).toBe(false);
    expect(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: target, encoding: 'utf8' }).trim()).toBe(
      result.commit,
    );
  });

  it('refuses when the target is the promotion source tree', () => {
    const sandbox = makeSandbox();

    expect(() =>
      promoteGreenfieldRun({ sandboxDir: sandbox, target: sandbox, runId: 'r1', force: false }),
    ).toThrow(/promotion source/i);
    expect(existsSync(join(sandbox, '.git'))).toBe(false);
  });

  it('allows promoting into an ancestor of the promotion source (e.g. project root)', () => {
    const outer = tmpTarget();
    const sandbox = join(outer, '.brunch', 'cook', 'runs', 'run-1', 'worktree');
    mkdirSync(sandbox, { recursive: true });
    writeFileSync(join(sandbox, 'index.ts'), 'export const x = 1;\n');

    const id = ['-c', 'user.name=t', '-c', 'user.email=t@e'];
    execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: outer });
    writeFileSync(join(outer, 'README.md'), '# proj\n');
    execFileSync('git', ['add', '.'], { cwd: outer });
    execFileSync('git', [...id, 'commit', '-q', '-m', 'base'], { cwd: outer });

    const result = promoteGreenfieldRun({ sandboxDir: sandbox, target: outer, runId: 'r1', force: true });

    expect(result.branch).toBe('cook/r1');
    expect(readFileSync(join(outer, 'index.ts'), 'utf8')).toContain('export const x');
    expect(existsSync(sandbox)).toBe(true);
  });

  it('refuses when the target is nested inside the promotion source', () => {
    const sandbox = makeSandbox();
    const target = join(sandbox, 'nested-out');

    expect(() => promoteGreenfieldRun({ sandboxDir: sandbox, target, runId: 'r1', force: false })).toThrow(
      /inside the promotion source/i,
    );
    expect(existsSync(join(sandbox, 'nested-out', '.git'))).toBe(false);
  });

  it('re-promotes onto an existing cook/<runId> branch', () => {
    const sandbox = makeSandbox();
    const target = tmpTarget();
    execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: target });

    const first = promoteGreenfieldRun({ sandboxDir: sandbox, target, runId: 'r1', force: false });
    writeFileSync(join(sandbox, 'index.ts'), 'export const x = 2;\n');
    const second = promoteGreenfieldRun({ sandboxDir: sandbox, target, runId: 'r1', force: true });

    expect(second.branch).toBe('cook/r1');
    expect(second.commit).not.toBe(first.commit);
    expect(readFileSync(join(target, 'index.ts'), 'utf8')).toContain('export const x = 2');
  });

  it('lands on a cook/<runId> branch in a freshly git-init target without --force', () => {
    const sandbox = makeSandbox();
    const target = tmpTarget();
    execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: target });

    const result = promoteGreenfieldRun({ sandboxDir: sandbox, target, runId: 'r1', force: false });

    expect(result.branch).toBe('cook/r1');
    expect(existsSync(join(target, 'index.ts'))).toBe(true);
    expect(execFileSync('git', ['branch', '--show-current'], { cwd: target, encoding: 'utf8' }).trim()).toBe(
      'cook/r1',
    );
  });

  it(
    'lands on a cook/<runId> branch in an existing repo with --force, leaving the original branch intact',
    () => {
      const sandbox = makeSandbox();
      const target = tmpTarget();
      const id = ['-c', 'user.name=t', '-c', 'user.email=t@e'];
      execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: target });
      writeFileSync(join(target, 'existing.txt'), 'keep\n');
      execFileSync('git', ['add', '.'], { cwd: target });
      execFileSync('git', [...id, 'commit', '-q', '-m', 'existing'], { cwd: target });

      const result = promoteGreenfieldRun({ sandboxDir: sandbox, target, runId: 'r1', force: true });

      expect(result.branch).toBe('cook/r1');
      expect(existsSync(join(target, 'index.ts'))).toBe(true);
      expect(execFileSync('git', ['branch', '--list'], { cwd: target, encoding: 'utf8' })).toContain('main');
    },
    GIT_TEST_TIMEOUT_MS,
  );
});

describe('promoteBrownfieldRun', () => {
  const id = ['-c', 'user.name=t', '-c', 'user.email=t@e'];

  // A user repo on `main` with a base commit, plus a cook/<runId> branch at the
  // same base (as `git worktree add -b cook/<runId> … HEAD` would create).
  function userRepo(): { dir: string; baseHead: string } {
    const dir = mkdtempSync(join(tmpdir(), 'cook-userrepo-'));
    dirs.push(dir);
    execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: dir });
    writeFileSync(join(dir, 'app.ts'), 'export const v = 1;\n');
    writeFileSync(join(dir, '.gitignore'), 'node_modules/\n');
    execFileSync('git', ['add', '.'], { cwd: dir });
    execFileSync('git', [...id, 'commit', '-q', '-m', 'base'], { cwd: dir });
    execFileSync('git', ['branch', 'cook/r1'], { cwd: dir });
    const baseHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' }).trim();
    return { dir, baseHead };
  }

  // The composed cook result: a full tree (base + the cook delta).
  function composedTree(): string {
    const d = mkdtempSync(join(tmpdir(), 'cook-composed-'));
    dirs.push(d);
    writeFileSync(join(d, 'app.ts'), 'export const v = 2;\n'); // modified
    writeFileSync(join(d, 'feature.ts'), 'export const f = true;\n'); // added
    writeFileSync(join(d, '.gitignore'), 'node_modules/\n');
    mkdirSync(join(d, 'node_modules'));
    writeFileSync(join(d, 'node_modules', 'dep.js'), 'junk\n'); // gitignored — must not land
    return d;
  }

  it(
    'commits the composed tree onto cook/<runId>, leaving the active branch and working tree untouched',
    () => {
      const { dir, baseHead } = userRepo();
      const tree = composedTree();
      const branchesBefore = execFileSync('git', ['branch', '--list'], { cwd: dir, encoding: 'utf8' });

      const result = promoteBrownfieldRun({ sourceDir: dir, sourceTreeDir: tree, runId: 'r1' });

      // cook/r1 advanced by one commit on top of the base.
      expect(result.branch).toBe('cook/r1');
      expect(result.commit).not.toBe(baseHead);
      const parent = execFileSync('git', ['rev-parse', 'cook/r1^'], { cwd: dir, encoding: 'utf8' }).trim();
      expect(parent).toBe(baseHead);

      // The commit's tree carries the delta — and not the gitignored deps.
      const files = execFileSync('git', ['ls-tree', '-r', '--name-only', 'cook/r1'], {
        cwd: dir,
        encoding: 'utf8',
      });
      expect(files).toContain('feature.ts');
      expect(files).toContain('app.ts');
      expect(files).not.toContain('node_modules');
      const appAtCook = execFileSync('git', ['show', 'cook/r1:app.ts'], { cwd: dir, encoding: 'utf8' });
      expect(appAtCook).toContain('v = 2');

      // The user's active branch (main), HEAD, working tree, and index are untouched.
      expect(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' }).trim()).toBe(
        baseHead,
      );
      expect(
        execFileSync('git', ['symbolic-ref', '--short', 'HEAD'], { cwd: dir, encoding: 'utf8' }).trim(),
      ).toBe('main');
      expect(readFileSync(join(dir, 'app.ts'), 'utf8')).toContain('v = 1');
      expect(existsSync(join(dir, 'feature.ts'))).toBe(false);
      expect(execFileSync('git', ['status', '--porcelain'], { cwd: dir, encoding: 'utf8' })).toBe('');
      // Only cook/r1 moved — no stray branches.
      expect(execFileSync('git', ['branch', '--list'], { cwd: dir, encoding: 'utf8' })).toBe(branchesBefore);
    },
    GIT_TEST_TIMEOUT_MS,
  );

  it('throws when the cook/<runId> branch is absent (must be created by the worktree)', () => {
    const { dir } = userRepo();
    const tree = composedTree();
    expect(() => promoteBrownfieldRun({ sourceDir: dir, sourceTreeDir: tree, runId: 'missing' })).toThrow(
      /cook\/missing/,
    );
  });

  it(
    'works in the real linked-worktree topology — the live sandbox worktree is left to be discarded, the main checkout untouched',
    () => {
      // Mirror production: cook/r1 exists *because* a linked worktree checked it out.
      const dir = mkdtempSync(join(tmpdir(), 'cook-userrepo-'));
      dirs.push(dir);
      execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: dir });
      writeFileSync(join(dir, 'app.ts'), 'export const v = 1;\n');
      writeFileSync(join(dir, '.gitignore'), 'node_modules/\n');
      execFileSync('git', ['add', '.'], { cwd: dir });
      execFileSync('git', [...id, 'commit', '-q', '-m', 'base'], { cwd: dir });
      const wt = join(dir, 'wt');
      execFileSync('git', ['worktree', 'add', '-q', '-b', 'cook/r1', wt, 'HEAD'], { cwd: dir });
      const baseHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' }).trim();

      const result = promoteBrownfieldRun({ sourceDir: dir, sourceTreeDir: composedTree(), runId: 'r1' });

      // Only cook/r1 moved (one commit on the base).
      expect(execFileSync('git', ['rev-parse', 'cook/r1^'], { cwd: dir, encoding: 'utf8' }).trim()).toBe(
        baseHead,
      );
      expect(execFileSync('git', ['show', 'cook/r1:app.ts'], { cwd: dir, encoding: 'utf8' })).toContain(
        'v = 2',
      );
      // The main checkout is wholly untouched.
      expect(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' }).trim()).toBe(
        baseHead,
      );
      expect(
        execFileSync('git', ['symbolic-ref', '--short', 'HEAD'], { cwd: dir, encoding: 'utf8' }).trim(),
      ).toBe('main');
      expect(readFileSync(join(dir, 'app.ts'), 'utf8')).toContain('v = 1');
      // tracked files untouched (the linked `wt/` dir is an expected untracked entry).
      expect(
        execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], {
          cwd: dir,
          encoding: 'utf8',
        }),
      ).toBe('');
      expect(result.commit).not.toBe(baseHead);
    },
    GIT_TEST_TIMEOUT_MS,
  );

  it('stages tracked deletions — a file removed in the composed tree is removed in the cook commit', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cook-userrepo-'));
    dirs.push(dir);
    execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: dir });
    writeFileSync(join(dir, 'keep.ts'), 'keep\n');
    writeFileSync(join(dir, 'old.ts'), 'remove me\n');
    execFileSync('git', ['add', '.'], { cwd: dir });
    execFileSync('git', [...id, 'commit', '-q', '-m', 'base'], { cwd: dir });
    execFileSync('git', ['branch', 'cook/r1'], { cwd: dir });

    // Composed tree drops old.ts.
    const tree = mkdtempSync(join(tmpdir(), 'cook-composed-'));
    dirs.push(tree);
    writeFileSync(join(tree, 'keep.ts'), 'keep\n');

    promoteBrownfieldRun({ sourceDir: dir, sourceTreeDir: tree, runId: 'r1' });

    const files = execFileSync('git', ['ls-tree', '-r', '--name-only', 'cook/r1'], {
      cwd: dir,
      encoding: 'utf8',
    });
    expect(files).toContain('keep.ts');
    expect(files).not.toContain('old.ts');
  });
});

describe('landCookBranch', () => {
  const id = ['-c', 'user.name=t', '-c', 'user.email=t@e'];

  // A user repo on `main` with one base commit and a promoted cook/r1 branch
  // (the composed result already committed on top of base via promoteBrownfieldRun).
  function repoWithPromotedCook(): { dir: string; baseHead: string; cookCommit: string } {
    const dir = mkdtempSync(join(tmpdir(), 'cook-land-'));
    dirs.push(dir);
    execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: dir });
    writeFileSync(join(dir, 'app.ts'), 'export const v = 1;\n');
    writeFileSync(join(dir, '.gitignore'), 'node_modules/\n');
    execFileSync('git', ['add', '.'], { cwd: dir });
    execFileSync('git', [...id, 'commit', '-q', '-m', 'base'], { cwd: dir });
    execFileSync('git', ['branch', 'cook/r1'], { cwd: dir });
    const baseHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' }).trim();

    const tree = mkdtempSync(join(tmpdir(), 'cook-land-tree-'));
    dirs.push(tree);
    writeFileSync(join(tree, 'app.ts'), 'export const v = 2;\n');
    writeFileSync(join(tree, 'feature.ts'), 'export const f = true;\n');
    writeFileSync(join(tree, '.gitignore'), 'node_modules/\n');
    const { commit } = promoteBrownfieldRun({ sourceDir: dir, sourceTreeDir: tree, runId: 'r1' });
    return { dir, baseHead, cookCommit: commit };
  }

  function head(dir: string): string {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' }).trim();
  }

  it(
    'fast-forwards the active branch onto cook/<runId> when HEAD has not moved',
    () => {
      const { dir, cookCommit } = repoWithPromotedCook();

      const result = landCookBranch({ sourceDir: dir, runId: 'r1' });

      expect(result).toEqual({ kind: 'landed', mode: 'fast-forward', branch: 'main', commit: cookCommit });
      // Active branch advanced to the cook commit; the delta is now in the working tree.
      expect(head(dir)).toBe(cookCommit);
      expect(readFileSync(join(dir, 'app.ts'), 'utf8')).toContain('v = 2');
      expect(existsSync(join(dir, 'feature.ts'))).toBe(true);
      // cook/r1 still exists for re-review.
      expect(execFileSync('git', ['rev-parse', 'cook/r1'], { cwd: dir, encoding: 'utf8' }).trim()).toBe(
        cookCommit,
      );
    },
    GIT_TEST_TIMEOUT_MS,
  );
});
