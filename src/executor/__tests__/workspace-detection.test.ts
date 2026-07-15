import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { detectWorkspaceCapabilities } from '../workspace-detection.js';

describe('detectWorkspaceCapabilities', () => {
  it('reports non-authoritative Node manifest facts with file provenance', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'brunch-detect-'));
    await writeFile(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'fixture', scripts: { test: 'vitest run', verify: 'npm test' } }),
      'utf8',
    );

    expect(await detectWorkspaceCapabilities(dir)).toEqual([
      { id: 'node.package-json', source: { kind: 'detected', path: 'package.json' } },
      { id: 'node.script.test', source: { kind: 'detected', path: 'package.json' } },
      { id: 'node.script.verify', source: { kind: 'detected', path: 'package.json' } },
    ]);
  });

  it('reports nothing for an empty workspace', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'brunch-detect-empty-'));

    expect(await detectWorkspaceCapabilities(dir)).toEqual([]);
  });

  it('reports nothing for a malformed manifest instead of guessing', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'brunch-detect-bad-'));
    await writeFile(join(dir, 'package.json'), '{ not json', 'utf8');

    expect(await detectWorkspaceCapabilities(dir)).toEqual([]);
  });
});
