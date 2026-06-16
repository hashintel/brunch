import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { openWorkspaceCommandExecutor } from '../../graph/index.js';
import { seedFixture, type SeedFixture } from '../../graph/seed-fixtures.js';
import { createSessionBindingData } from '../session-binding.js';
import { inspectWorkspaceOverview } from '../workspace-overview-context.js';

describe('inspectWorkspaceOverview', () => {
  it('returns a workspace overview with spec node counts and session turn counts', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-workspace-overview-'));
    const executor = await openWorkspaceCommandExecutor(cwd);
    const alpha = seedFixture(executor, await loadFixture('alpha-grounding', 'workspace-spread'));
    const beta = seedFixture(executor, await loadFixture('beta-commitments', 'workspace-spread'));

    await mkdir(join(cwd, '.brunch', 'sessions'), { recursive: true });
    await writeBoundSession(cwd, 'alpha-session', alpha.specId, [messageEntry('u1', 'user')]);
    await writeBoundSession(cwd, 'beta-session', beta.specId, [
      messageEntry('u1', 'user'),
      messageEntry('tool-1', 'toolResult'),
      {
        type: 'custom',
        id: 'state-1',
        parentId: null,
        timestamp: '2026-06-16T00:00:00.000Z',
        customType: 'brunch.agent_runtime_state',
      },
      messageEntry('a1', 'assistant'),
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
      },
      {
        id: 'beta-session',
        file: 'beta-session.jsonl',
        specId: beta.specId,
        specTitle: 'Beta Commitments',
        turnCount: 2,
      },
    ]);
  });
});

async function loadFixture(slug: string, set = 'bilal-port'): Promise<SeedFixture> {
  const fixturePath = fileURLToPath(new URL(`../../../.fixtures/seeds/${set}/${slug}.json`, import.meta.url));
  return JSON.parse(await import('node:fs/promises').then(({ readFile }) => readFile(fixturePath, 'utf8')));
}

async function writeBoundSession(
  cwd: string,
  sessionId: string,
  specId: number,
  entries: unknown[],
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

function messageEntry(id: string, role: 'user' | 'assistant' | 'toolResult') {
  return {
    type: 'message',
    id,
    parentId: null,
    timestamp: '2026-06-16T00:00:00.000Z',
    message: { role, content: `${role} content` },
  };
}
