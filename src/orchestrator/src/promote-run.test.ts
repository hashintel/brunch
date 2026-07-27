import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { landCookBranch, promoteGreenfieldRun } from './promote-run.js';

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

    expect(result.branch).toBe('brunch/run/r1');
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

  it('re-promotes onto an existing brunch/run/<runId> branch', () => {
    const sandbox = makeSandbox();
    const target = tmpTarget();
    execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: target });

    const first = promoteGreenfieldRun({ sandboxDir: sandbox, target, runId: 'r1', force: false });
    writeFileSync(join(sandbox, 'index.ts'), 'export const x = 2;\n');
    const second = promoteGreenfieldRun({ sandboxDir: sandbox, target, runId: 'r1', force: true });

    expect(second.branch).toBe('brunch/run/r1');
    expect(second.commit).not.toBe(first.commit);
    expect(readFileSync(join(target, 'index.ts'), 'utf8')).toContain('export const x = 2');
  });

  it('lands on a brunch/run/<runId> branch in a freshly git-init target without --force', () => {
    const sandbox = makeSandbox();
    const target = tmpTarget();
    execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: target });

    const result = promoteGreenfieldRun({ sandboxDir: sandbox, target, runId: 'r1', force: false });

    expect(result.branch).toBe('brunch/run/r1');
    expect(existsSync(join(target, 'index.ts'))).toBe(true);
    expect(execFileSync('git', ['branch', '--show-current'], { cwd: target, encoding: 'utf8' }).trim()).toBe(
      'brunch/run/r1',
    );
  });

  it(
    'lands on a brunch/run/<runId> branch in an existing repo with --force, leaving the original branch intact',
    () => {
      const sandbox = makeSandbox();
      const target = tmpTarget();
      const id = ['-c', 'user.name=t', '-c', 'user.email=t@e'];
      execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: target });
      writeFileSync(join(target, 'existing.txt'), 'keep\n');
      execFileSync('git', ['add', '.'], { cwd: target });
      execFileSync('git', [...id, 'commit', '-q', '-m', 'existing'], { cwd: target });

      const result = promoteGreenfieldRun({ sandboxDir: sandbox, target, runId: 'r1', force: true });

      expect(result.branch).toBe('brunch/run/r1');
      expect(existsSync(join(target, 'index.ts'))).toBe(true);
      expect(execFileSync('git', ['branch', '--list'], { cwd: target, encoding: 'utf8' })).toContain('main');
    },
    GIT_TEST_TIMEOUT_MS,
  );
});

describe('landCookBranch', () => {
  const id = ['-c', 'user.name=t', '-c', 'user.email=t@e'];

  // A user repo on `main` with one base commit and a promoted brunch/run/r1 branch
  // carrying the composed result one commit ahead of base (what a cook run leaves —
  // built here via a throwaway worktree on the run branch, the shape landCookBranch merges).
  function repoWithPromotedCook(): { dir: string; baseHead: string; cookCommit: string } {
    const dir = mkdtempSync(join(tmpdir(), 'cook-land-'));
    dirs.push(dir);
    execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: dir });
    writeFileSync(join(dir, 'app.ts'), 'export const v = 1;\n');
    writeFileSync(join(dir, '.gitignore'), 'node_modules/\n');
    execFileSync('git', ['add', '.'], { cwd: dir });
    execFileSync('git', [...id, 'commit', '-q', '-m', 'base'], { cwd: dir });
    execFileSync('git', ['branch', 'brunch/run/r1'], { cwd: dir });
    const baseHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' }).trim();

    const wt = mkdtempSync(join(tmpdir(), 'cook-land-wt-'));
    dirs.push(wt);
    execFileSync('git', ['worktree', 'add', '-q', wt, 'brunch/run/r1'], { cwd: dir });
    writeFileSync(join(wt, 'app.ts'), 'export const v = 2;\n');
    writeFileSync(join(wt, 'feature.ts'), 'export const f = true;\n');
    execFileSync('git', ['add', '-A'], { cwd: wt });
    execFileSync('git', [...id, 'commit', '-q', '-m', 'cook: r1'], { cwd: wt });
    const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: wt, encoding: 'utf8' }).trim();
    execFileSync('git', ['worktree', 'remove', '--force', wt], { cwd: dir });
    return { dir, baseHead, cookCommit: commit };
  }

  function head(dir: string): string {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' }).trim();
  }

  it(
    'fast-forwards the active branch onto brunch/run/<runId> when HEAD has not moved',
    () => {
      const { dir, cookCommit } = repoWithPromotedCook();

      const result = landCookBranch({ sourceDir: dir, runId: 'r1' });

      expect(result).toEqual({ kind: 'landed', mode: 'fast-forward', branch: 'main', commit: cookCommit });
      // Active branch advanced to the cook commit; the delta is now in the working tree.
      expect(head(dir)).toBe(cookCommit);
      expect(readFileSync(join(dir, 'app.ts'), 'utf8')).toContain('v = 2');
      expect(existsSync(join(dir, 'feature.ts'))).toBe(true);
      // brunch/run/r1 still exists for re-review.
      expect(execFileSync('git', ['rev-parse', 'brunch/run/r1'], { cwd: dir, encoding: 'utf8' }).trim()).toBe(
        cookCommit,
      );
    },
    GIT_TEST_TIMEOUT_MS,
  );
});
