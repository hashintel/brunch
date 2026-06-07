import { mkdir, writeFile } from 'node:fs/promises';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createSessionBindingData } from './session-binding.js';
import { inspectWorkspaceCwdSnapshot } from './workspace-context.js';

describe('inspectWorkspaceCwdSnapshot', () => {
  it('returns a gitignore-aware kickoff snapshot with session and markdown sizes', async () => {
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

    const sessionFile = join(cwd, '.brunch', 'sessions', 'session-1.jsonl');
    await writeFile(
      sessionFile,
      [
        JSON.stringify({ type: 'session', id: 'session-1', cwd }),
        JSON.stringify({
          id: 'binding-1',
          type: 'custom',
          parentId: null,
          customType: 'brunch.session_binding',
          data: createSessionBindingData({ specId: 7 }),
        }),
      ].join('\n') + '\n',
    );

    const snapshot = await inspectWorkspaceCwdSnapshot(cwd);

    expect(snapshot.status).toBe('ready');
    expect(snapshot.hasBrunchDir).toBe(true);
    expect(snapshot.sessionFiles).toEqual([
      { file: 'session-1.jsonl', lineCount: 3, byteCount: expect.any(Number) },
    ]);
    expect(snapshot.topLevelEntries).toEqual([
      { name: '.brunch', kind: 'directory', fileCount: 1 },
      { name: '.gitignore', kind: 'file', fileCount: 1 },
      { name: 'README.md', kind: 'file', fileCount: 1 },
      { name: 'src', kind: 'directory', fileCount: 2 },
    ]);
    expect(snapshot.markdownFiles).toEqual([
      { path: 'README.md', lineCount: 3, byteCount: expect.any(Number) },
      { path: 'src/nested/guide.md', lineCount: 2, byteCount: expect.any(Number) },
    ]);
  });

  it('returns a coherent fresh-workspace snapshot when .brunch is absent', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-workspace-context-'));
    await writeFile(join(cwd, 'README.md'), 'Fresh workspace\n');

    const snapshot = await inspectWorkspaceCwdSnapshot(cwd);

    expect(snapshot.hasBrunchDir).toBe(false);
    expect(snapshot.sessionFiles).toEqual([]);
    expect(snapshot.topLevelEntries).toEqual([{ name: 'README.md', kind: 'file', fileCount: 1 }]);
  });
});
