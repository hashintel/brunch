import { mkdir, writeFile } from 'node:fs/promises';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { openWorkspaceCommandExecutor } from '../graph/index.js';
import { seedFixture, type SeedFixture } from '../graph/seed-fixtures.js';
import { createSessionBindingData } from './session-binding.js';
import { inspectWorkspaceCwdInventory, inspectWorkspaceOverview } from './workspace-context.js';

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

  it('returns a workspace overview with spec node counts and session turn counts', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-workspace-overview-'));
    const executor = await openWorkspaceCommandExecutor(cwd);
    const alpha = seedFixture(executor, await loadFixture('alpha-grounding', 'workspace-spread'));
    const beta = seedFixture(executor, await loadFixture('beta-commitments', 'workspace-spread'));

    await mkdir(join(cwd, '.brunch', 'sessions'), { recursive: true });
    await writeBoundSession(cwd, 'alpha-session', alpha.specId, [{ type: 'user', id: 'u1' }]);
    await writeBoundSession(cwd, 'beta-session', beta.specId, [
      { type: 'user', id: 'u1' },
      { type: 'assistant', id: 'a1' },
    ]);

    const overview = await inspectWorkspaceOverview(cwd);

    expect(overview.specs).toEqual([
      { id: alpha.specId, title: 'Alpha Grounding', nodeCount: 4, sessionCount: 1 },
      { id: beta.specId, title: 'Beta Commitments', nodeCount: 5, sessionCount: 1 },
    ]);
    expect(overview.sessions).toEqual([
      {
        id: 'alpha-session',
        file: 'alpha-session.jsonl',
        specId: alpha.specId,
        specTitle: 'Alpha Grounding',
        turnCount: 1,
        readinessGrade: 'grounding_onboarding',
      },
      {
        id: 'beta-session',
        file: 'beta-session.jsonl',
        specId: beta.specId,
        specTitle: 'Beta Commitments',
        turnCount: 2,
        readinessGrade: 'commitments_ready',
      },
    ]);
  });
});

async function loadFixture(slug: string, set = 'bilal-port'): Promise<SeedFixture> {
  const fixturePath = fileURLToPath(new URL(`../../.fixtures/seeds/${set}/${slug}.json`, import.meta.url));
  return JSON.parse(await import('node:fs/promises').then(({ readFile }) => readFile(fixturePath, 'utf8')));
}

async function writeBoundSession(
  cwd: string,
  sessionId: string,
  specId: number,
  entries: Array<{ type: 'user' | 'assistant'; id: string }>,
): Promise<void> {
  await writeFile(
    join(cwd, '.brunch', 'sessions', `${sessionId}.jsonl`),
    [
      JSON.stringify({ type: 'session', id: sessionId, cwd }),
      JSON.stringify({
        id: `${sessionId}-binding`,
        type: 'custom',
        parentId: null,
        customType: 'brunch.session_binding',
        data: createSessionBindingData({ specId }),
      }),
      ...entries.map((entry) => JSON.stringify(entry)),
    ].join('\n') + '\n',
  );
}
