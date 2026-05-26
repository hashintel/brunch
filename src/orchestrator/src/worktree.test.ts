import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createSandbox } from './worktree.js';

describe('createSandbox', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
    dirs.length = 0;
  });

  it('creates sandbox under baseDir/.brunch/cook/runs/<runId>/worktree/', () => {
    const baseDir = mkdtempSync(join(tmpdir(), 'cook-wt-'));
    dirs.push(baseDir);

    const info = createSandbox(baseDir, 'test-run-1');
    expect(info.runId).toBe('test-run-1');
    expect(info.runDir).toBe(join(baseDir, '.brunch', 'cook', 'runs', 'test-run-1'));
    expect(info.sandboxDir).toBe(join(baseDir, '.brunch', 'cook', 'runs', 'test-run-1', 'worktree'));
    expect(existsSync(info.sandboxDir)).toBe(true);
  });

  it('generates a runId when not provided', () => {
    const baseDir = mkdtempSync(join(tmpdir(), 'cook-wt-'));
    dirs.push(baseDir);

    const info = createSandbox(baseDir);
    expect(info.runId).toBeTruthy();
    expect(existsSync(info.sandboxDir)).toBe(true);
  });

  it('does not write to a separate fixture directory', () => {
    const baseDir = mkdtempSync(join(tmpdir(), 'cook-base-'));
    const fixtureDir = mkdtempSync(join(tmpdir(), 'cook-fixture-'));
    dirs.push(baseDir, fixtureDir);

    createSandbox(baseDir, 'isolated-run');

    // Fixture dir must not have a .brunch/cook/ run output
    expect(existsSync(join(fixtureDir, '.brunch', 'cook'))).toBe(false);
    // Base dir must have it
    expect(existsSync(join(baseDir, '.brunch', 'cook', 'runs', 'isolated-run', 'worktree'))).toBe(true);
  });
});

describe('createSandbox — codebase mode', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
    dirs.length = 0;
  });

  function makeTmpDir(prefix: string): string {
    const d = mkdtempSync(join(tmpdir(), prefix));
    dirs.push(d);
    return d;
  }

  function initSeededGitRepo(dir: string): void {
    execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: dir });
    execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: dir });
    execFileSync('git', ['config', 'user.name', 'Test'], { cwd: dir });
    writeFileSync(join(dir, 'README.md'), '# seed\n');
    writeFileSync(join(dir, 'src.txt'), 'hello\n');
    execFileSync('git', ['add', '.'], { cwd: dir });
    execFileSync('git', ['commit', '-q', '-m', 'initial'], { cwd: dir });
  }

  it('creates a git worktree of sourceDir on a cook/<runId> branch', () => {
    const baseDir = makeTmpDir('cook-base-');
    const sourceDir = makeTmpDir('cook-src-');
    initSeededGitRepo(sourceDir);

    const info = createSandbox(baseDir, 'codebase-run-1', { mode: 'codebase', sourceDir });

    expect(info.runId).toBe('codebase-run-1');
    expect(existsSync(info.sandboxDir)).toBe(true);
    // Worktree contents mirror sourceDir HEAD
    expect(readFileSync(join(info.sandboxDir, 'README.md'), 'utf8')).toBe('# seed\n');
    expect(readFileSync(join(info.sandboxDir, 'src.txt'), 'utf8')).toBe('hello\n');
  });

  it('worktree is checked out on branch cook/<runId>', () => {
    const baseDir = makeTmpDir('cook-base-');
    const sourceDir = makeTmpDir('cook-src-');
    initSeededGitRepo(sourceDir);

    const info = createSandbox(baseDir, 'branch-test', { mode: 'codebase', sourceDir });

    const branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: info.sandboxDir,
      encoding: 'utf8',
    }).trim();
    expect(branch).toBe('cook/branch-test');
  });

  it('source branch in sourceDir is byte-identical after worktree creation', () => {
    const baseDir = makeTmpDir('cook-base-');
    const sourceDir = makeTmpDir('cook-src-');
    initSeededGitRepo(sourceDir);

    const sourceHeadBefore = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: sourceDir,
      encoding: 'utf8',
    }).trim();

    createSandbox(baseDir, 'isolation-test', { mode: 'codebase', sourceDir });

    const sourceHeadAfter = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: sourceDir,
      encoding: 'utf8',
    }).trim();
    expect(sourceHeadAfter).toBe(sourceHeadBefore);

    // No uncommitted changes either
    const status = execFileSync('git', ['status', '--porcelain'], {
      cwd: sourceDir,
      encoding: 'utf8',
    });
    expect(status).toBe('');
  });
});
