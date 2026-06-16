import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { detectProfile, detectTestDir } from './project-detect.js';

function repo(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'detect-'));
  for (const [name, contents] of Object.entries(files)) {
    const path = join(dir, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, contents);
  }
  return dir;
}

const pkg = (deps: Record<string, string>): string => JSON.stringify({ devDependencies: deps });

describe('detectProfile maps real manifest/lockfile evidence to a registry profile', () => {
  it('package.json with vitest → node-vitest', () => {
    const result = detectProfile(repo({ 'package.json': pkg({ vitest: '^2.0.0' }) }));
    expect(result).toMatchObject({ detected: true, profile: 'node-vitest' });
  });

  it('package.json with jest → node-jest', () => {
    const result = detectProfile(repo({ 'package.json': pkg({ jest: '^29.0.0' }) }));
    expect(result).toMatchObject({ detected: true, profile: 'node-jest' });
  });

  it('package.json with no test framework → node-test (built-in runner)', () => {
    const result = detectProfile(repo({ 'package.json': pkg({ typescript: '^5.0.0' }) }));
    expect(result).toMatchObject({ detected: true, profile: 'node-test' });
  });

  it('a bun lockfile → bun (and wins over package.json deps)', () => {
    const result = detectProfile(repo({ 'bun.lockb': '', 'package.json': pkg({ vitest: '^2.0.0' }) }));
    expect(result).toMatchObject({ detected: true, profile: 'bun', evidence: 'bun.lockb' });
  });

  it('a deno config → deno (even alongside a package.json for npm specifiers)', () => {
    const result = detectProfile(repo({ 'deno.json': '{}', 'package.json': pkg({}) }));
    expect(result).toMatchObject({ detected: true, profile: 'deno', evidence: 'deno.json' });
  });

  it('every successful detection carries the evidence that selected it', () => {
    const result = detectProfile(repo({ 'package.json': pkg({ vitest: '^2.0.0' }) }));
    expect(result.detected && result.evidence).toContain('vitest');
  });
});

describe('detectProfile fails loudly rather than defaulting silently', () => {
  it('package.json declaring BOTH vitest and jest → ambiguous, not detected', () => {
    // The cheap check resolves a single clear signal; two runners is genuinely
    // ambiguous and must not be silently resolved by check-order.
    const result = detectProfile(repo({ 'package.json': pkg({ vitest: '^2.0.0', jest: '^29.0.0' }) }));
    expect(result.detected).toBe(false);
    expect(!result.detected && result.reason).toMatch(/ambiguous/i);
    expect(!result.detected && result.reason).toMatch(/--profile/);
  });

  it('a non-JS project (Python/Go) → not detected, actionable reason listing valid profiles', () => {
    // No language-detection engine: any repo without JS/TS evidence falls to the
    // same actionable catch-all (brunch only supports the registry's JS profiles).
    const nonJsRepos: Record<string, string>[] = [
      { 'pyproject.toml': '[project]\nname = "x"\n' },
      { 'go.mod': 'module x\n' },
    ];
    for (const files of nonJsRepos) {
      const result = detectProfile(repo(files));
      expect(result.detected).toBe(false);
      expect(!result.detected && result.reason).toMatch(/could not detect/);
      expect(!result.detected && result.reason).toMatch(/node-vitest/);
    }
  });

  it('an unrecognized directory → not detected, actionable reason', () => {
    const result = detectProfile(repo({ 'README.md': '# hi\n' }));
    expect(result.detected).toBe(false);
    expect(!result.detected && result.reason).toMatch(/could not detect/);
  });

  it('a malformed package.json is still treated as a Node project (node-test)', () => {
    const result = detectProfile(repo({ 'package.json': '{ not json' }));
    expect(result).toMatchObject({ detected: true, profile: 'node-test' });
  });
});

describe('detectTestDir learns the test directory from existing test files', () => {
  it('returns the full directory tests cluster in, not just the top segment', () => {
    const dir = repo({
      'src/lib/bar.test.ts': '',
      'src/lib/qux.test.ts': '',
      'src/foo.test.ts': '',
      'src/lib/baz.ts': '',
    });
    // src/lib has 2 test files, src has 1 → the deeper, dominant dir wins.
    expect(detectTestDir(dir)).toBe('src/lib');
  });

  it('returns a deep monorepo test root so a package-rooted include still covers it', () => {
    const dir = repo({
      'packages/app/src/a.test.ts': '',
      'packages/app/src/b.test.ts': '',
      'packages/lib/src/c.test.ts': '',
    });
    expect(detectTestDir(dir)).toBe('packages/app/src');
  });

  it('picks the dominant directory when tests are split across several', () => {
    const dir = repo({
      'src/a.test.ts': '',
      'src/b.test.ts': '',
      'src/c.test.ts': '',
      'tests/d.test.ts': '',
    });
    expect(detectTestDir(dir)).toBe('src');
  });

  it('recognizes .spec. and jsx/tsx/mjs/cjs test files', () => {
    expect(detectTestDir(repo({ 'app/x.spec.tsx': '' }))).toBe('app');
    expect(detectTestDir(repo({ 'app/x.test.mjs': '' }))).toBe('app');
  });

  it('ignores node_modules and other build/vendor directories', () => {
    const dir = repo({
      'node_modules/pkg/dep.test.ts': '',
      'dist/out.test.ts': '',
      'src/real.test.ts': '',
    });
    expect(detectTestDir(dir)).toBe('src');
  });

  it('returns null when the repo has no test files to learn from', () => {
    expect(detectTestDir(repo({ 'src/index.ts': '', 'package.json': '{}' }))).toBeNull();
  });

  it('ignores test files sitting directly at the repo root (no directory to teach)', () => {
    expect(detectTestDir(repo({ 'root.test.ts': '' }))).toBeNull();
  });
});

describe('detectProfile resolves the runner from workspace packages in a monorepo', () => {
  it('finds vitest in a workspace package when the root declares no runner', () => {
    const dir = repo({
      'package.json': JSON.stringify({ workspaces: ['packages/*'] }),
      'packages/app/package.json': pkg({ vitest: '^2.0.0' }),
      'packages/lib/package.json': pkg({ typescript: '^5.0.0' }),
    });
    expect(detectProfile(dir)).toMatchObject({ detected: true, profile: 'node-vitest' });
  });

  it('finds the runner via a pnpm-workspace.yaml package list', () => {
    const dir = repo({
      'package.json': JSON.stringify({ name: 'root' }),
      'pnpm-workspace.yaml': "packages:\n  - 'packages/*'\n",
      'packages/web/package.json': pkg({ jest: '^29.0.0' }),
    });
    expect(detectProfile(dir)).toMatchObject({ detected: true, profile: 'node-jest' });
  });

  it('a root runner wins without scanning (and a workspace cannot make it ambiguous)', () => {
    const dir = repo({
      'package.json': JSON.stringify({ workspaces: ['packages/*'], devDependencies: { vitest: '^2.0.0' } }),
      'packages/legacy/package.json': pkg({ jest: '^29.0.0' }),
    });
    expect(detectProfile(dir)).toMatchObject({ detected: true, profile: 'node-vitest' });
  });

  it('workspaces collectively declaring both runners is ambiguous, not silently picked', () => {
    const dir = repo({
      'package.json': JSON.stringify({ workspaces: ['packages/*'] }),
      'packages/a/package.json': pkg({ vitest: '^2.0.0' }),
      'packages/b/package.json': pkg({ jest: '^29.0.0' }),
    });
    const result = detectProfile(dir);
    expect(result.detected).toBe(false);
    expect(!result.detected && result.reason).toMatch(/ambiguous/i);
  });

  it('a literal (non-wildcard) workspace directory is resolved', () => {
    const dir = repo({
      'package.json': JSON.stringify({ workspaces: ['apps/web'] }),
      'apps/web/package.json': pkg({ vitest: '^2.0.0' }),
    });
    expect(detectProfile(dir)).toMatchObject({ detected: true, profile: 'node-vitest' });
  });
});
