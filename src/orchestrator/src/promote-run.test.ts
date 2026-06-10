import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { promoteGreenfieldRun } from './promote-run.js';

const dirs: string[] = [];
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

  it('lands on a cook/<runId> branch in an existing repo with --force, leaving the original branch intact', () => {
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
  });
});
