import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { detectProfile } from './project-detect.js';

function repo(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'detect-'));
  for (const [name, contents] of Object.entries(files)) {
    writeFileSync(join(dir, name), contents);
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
