import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));

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
  it('publishes as @hashintel/brunch', () => {
    const pkg = readPackageJson();
    expect(pkg.name).toBe('@hashintel/brunch');
  });

  it('declares a version on the 1.x release line', () => {
    const pkg = readPackageJson();
    const [major] = parseMajorMinorPatch(pkg.version);
    expect(major, `version ${pkg.version} must be on the 1.x line`).toBeGreaterThanOrEqual(1);
  });

  it('exposes exactly one bin command, brunch, with no brunch-cli or brunch-next alias', () => {
    const pkg = readPackageJson();
    expect(Object.keys(pkg.bin)).toEqual(['brunch']);
    expect(pkg.bin['brunch']).toBe('bin/brunch.js');
  });

  it('ships an executable bin shim at the declared path', () => {
    const pkg = readPackageJson();
    const declaredPath = pkg.bin['brunch'];
    if (declaredPath === undefined) {
      throw new Error('brunch bin entry must be declared');
    }
    const binPath = join(repoRoot, declaredPath);
    const stat = statSync(binPath);
    expect(stat.isFile()).toBe(true);
    const ownerExecutable = (stat.mode & 0o100) !== 0;
    expect(ownerExecutable, `${binPath} must be executable`).toBe(true);
  });
});
