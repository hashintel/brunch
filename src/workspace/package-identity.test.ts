import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

interface PackageJson {
  name: string;
  version: string;
  bin: Record<string, string>;
}

function readPackageJson(): PackageJson {
  const raw = readFileSync(join(repoRoot, 'package.json'), 'utf8');
  return JSON.parse(raw) as PackageJson;
}

function parseMajorMinorPatch(version: string): [number, number, number] {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version);
  if (!match) throw new Error(`unparseable version: ${version}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

describe('package identity', () => {
  it('publishes as brunch-cli', () => {
    const pkg = readPackageJson();
    expect(pkg.name).toBe('brunch-cli');
  });

  it('declares a version of at least 0.1.0', () => {
    const pkg = readPackageJson();
    const [major, minor] = parseMajorMinorPatch(pkg.version);
    const atLeast010 = major > 0 || (major === 0 && minor >= 1);
    expect(atLeast010, `version ${pkg.version} must be >= 0.1.0`).toBe(true);
  });

  it('exposes exactly one bin command, brunch-cli, with no brunch-next alias', () => {
    const pkg = readPackageJson();
    expect(Object.keys(pkg.bin)).toEqual(['brunch-cli']);
    expect(pkg.bin['brunch-cli']).toBe('./bin/brunch-cli.js');
  });

  it('ships an executable bin shim at the declared path', () => {
    const pkg = readPackageJson();
    const declaredPath = pkg.bin['brunch-cli'];
    if (declaredPath === undefined) {
      throw new Error('brunch-cli bin entry must be declared');
    }
    const binPath = join(repoRoot, declaredPath);
    const stat = statSync(binPath);
    expect(stat.isFile()).toBe(true);
    const ownerExecutable = (stat.mode & 0o100) !== 0;
    expect(ownerExecutable, `${binPath} must be executable`).toBe(true);
  });
});
