import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { inspectWorkspaceCwdInventory } from './cwd-inventory.js';

describe('inspectWorkspaceCwdInventory', () => {
  it('returns a gitignore-aware kickoff inventory with session and markdown sizes', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-workspace-context-'));
    await mkdir(join(cwd, '.brunch', 'sessions'), { recursive: true });
    await mkdir(join(cwd, 'src', 'nested'), { recursive: true });
    await mkdir(join(cwd, 'ignored-dir'), { recursive: true });

    await writeFile(join(cwd, '.gitignore'), ['ignored-dir/', 'ignored.md'].join('\n'));
    await writeFile(join(cwd, 'README.md'), '# Workspace\nA note\n');
    await writeFile(join(cwd, 'ignored.md'), '# Ignore me\n');
    await writeFile(join(cwd, 'src', 'index.ts'), 'export {}\n');
    await writeFile(join(cwd, 'src', 'nested', 'guide.md'), 'Nested guide\n');
    await writeFile(join(cwd, 'ignored-dir', 'secret.txt'), 'hidden\n');

    await writeFile(
      join(cwd, '.brunch', 'sessions', 'session-1.jsonl'),
      [JSON.stringify({ type: 'session', id: 'session-1', cwd }), JSON.stringify({ type: 'custom' })].join(
        '\n',
      ) + '\n',
    );

    const inventory = await inspectWorkspaceCwdInventory(cwd);

    expect(inventory.status).toBe('ready');
    expect(inventory.hasBrunchDir).toBe(true);
    expect(inventory.sessionFiles).toEqual([
      { file: 'session-1.jsonl', lineCount: 3, byteCount: expect.any(Number) },
    ]);
    expect(inventory.topLevelEntries).toEqual([
      { name: '.brunch', kind: 'directory', fileCount: 1 },
      { name: '.gitignore', kind: 'file', fileCount: 1 },
      { name: 'README.md', kind: 'file', fileCount: 1 },
      { name: 'src', kind: 'directory', fileCount: 2 },
    ]);
    expect(inventory.markdownFiles).toEqual([
      { path: 'README.md', lineCount: 3, byteCount: expect.any(Number) },
      { path: 'src/nested/guide.md', lineCount: 2, byteCount: expect.any(Number) },
    ]);
  });

  it('returns a coherent fresh-workspace inventory when .brunch is absent', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-workspace-context-'));
    await writeFile(join(cwd, 'README.md'), 'Fresh workspace\n');

    const inventory = await inspectWorkspaceCwdInventory(cwd);

    expect(inventory.hasBrunchDir).toBe(false);
    expect(inventory.sessionFiles).toEqual([]);
    expect(inventory.topLevelEntries).toEqual([{ name: 'README.md', kind: 'file', fileCount: 1 }]);
  });
});
