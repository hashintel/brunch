import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { discoverProjectIdentity, slugify } from './project-identity.js';

describe('slugify', () => {
  it('lowercases and collapses non-alphanumeric runs to single dashes', () => {
    expect(slugify('Acme Control Plane')).toBe('acme-control-plane');
    expect(slugify('Foo___Bar  Baz!!')).toBe('foo-bar-baz');
  });

  it('strips leading and trailing dashes', () => {
    expect(slugify('---wrap-around---')).toBe('wrap-around');
  });

  it('handles scoped npm package names', () => {
    expect(slugify('@hashintel/brunch')).toBe('hashintel-brunch');
  });

  it("returns 'project' for inputs with no alphanumerics", () => {
    expect(slugify('!!!')).toBe('project');
    expect(slugify('')).toBe('project');
  });
});

describe('discoverProjectIdentity', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'brunch-project-identity-'));
  });

  afterEach(() => {
    // Temp dirs are reaped by the OS; leaving them is acceptable for tests.
  });

  it('prefers package.json over every other signal', async () => {
    await writeFile(join(dir, 'package.json'), JSON.stringify({ name: '@hashintel/brunch' }));
    await writeFile(join(dir, 'pyproject.toml'), '[project]\nname = "pythonic"\n');
    await writeFile(join(dir, 'Cargo.toml'), '[package]\nname = "rusty"\n');
    await writeFile(join(dir, 'go.mod'), 'module example.com/golang\n');

    const identity = await discoverProjectIdentity(dir);

    expect(identity).toEqual({
      name: '@hashintel/brunch',
      slug: 'hashintel-brunch',
      source: 'package.json',
    });
  });

  it('reads pyproject.toml [project].name when package.json is absent', async () => {
    await writeFile(
      join(dir, 'pyproject.toml'),
      '# comment\n[build-system]\nrequires = ["hatch"]\n\n[project]\nname = "snake_case_app"\nversion = "0.1.0"\n',
    );

    const identity = await discoverProjectIdentity(dir);

    expect(identity).toEqual({
      name: 'snake_case_app',
      slug: 'snake-case-app',
      source: 'pyproject.toml',
    });
  });

  it('falls back to [tool.poetry].name in pyproject.toml', async () => {
    await writeFile(join(dir, 'pyproject.toml'), '[tool.poetry]\nname = "poetry-app"\n');

    const identity = await discoverProjectIdentity(dir);

    expect(identity.name).toBe('poetry-app');
    expect(identity.source).toBe('pyproject.toml');
  });

  it('reads Cargo.toml [package].name', async () => {
    await writeFile(
      join(dir, 'Cargo.toml'),
      '[package]\nname = "rustacean"\nversion = "0.1.0"\nedition = "2021"\n',
    );

    const identity = await discoverProjectIdentity(dir);

    expect(identity).toEqual({
      name: 'rustacean',
      slug: 'rustacean',
      source: 'cargo.toml',
    });
  });

  it('uses the final segment of the module path in go.mod', async () => {
    await writeFile(join(dir, 'go.mod'), 'module github.com/hashintel/widget-service\n\ngo 1.22\n');

    const identity = await discoverProjectIdentity(dir);

    expect(identity).toEqual({
      name: 'widget-service',
      slug: 'widget-service',
      source: 'go.mod',
    });
  });

  it('falls back to the directory basename when no manifest is present', async () => {
    const identity = await discoverProjectIdentity(dir);

    expect(identity.source).toBe('directory');
    expect(identity.name).toBe(dir.split('/').pop());
    expect(identity.slug.length).toBeGreaterThan(0);
  });

  it('falls back past a malformed package.json to the next signal', async () => {
    await writeFile(join(dir, 'package.json'), '{ this is not json');
    await writeFile(join(dir, 'Cargo.toml'), '[package]\nname = "rusty"\n');

    const identity = await discoverProjectIdentity(dir);

    expect(identity.name).toBe('rusty');
    expect(identity.source).toBe('cargo.toml');
  });

  it('ignores package.json with a missing or empty name field', async () => {
    await writeFile(join(dir, 'package.json'), JSON.stringify({ version: '1.0.0' }));
    await writeFile(join(dir, 'go.mod'), 'module example.com/fallback\n');

    const identity = await discoverProjectIdentity(dir);

    expect(identity.name).toBe('fallback');
    expect(identity.source).toBe('go.mod');
  });
});
