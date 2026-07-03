import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { openWorkspaceCommandExecutor } from '../../../../../graph/index.js';
import { seedFixture, type SeedFixture } from '../../../../../graph/seed-fixtures.js';
import { createSessionBindingData } from '../../../../../session/session-binding.js';
import { inspectSpecificationOverview } from '../../../../../session/specification-overview-context.js';
import { renderSpecificationContext } from '../spec-context.js';

describe('renderSpecificationContext', () => {
  it('renders the approved specification house style', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-specification-context-'));
    const executor = await openWorkspaceCommandExecutor(cwd);
    const seeded = seedFixture(executor, await loadFixture('workspace-alpha-grounding'));
    await mkdir(join(cwd, '.brunch', 'sessions'), { recursive: true });
    await writeBoundSession(cwd, 'alpha-session', seeded.specId, [
      messageEntry('u1', 'user'),
      messageEntry('a1', 'assistant'),
    ]);

    const details = await inspectSpecificationOverview(cwd, seeded.specId);
    const rendered = renderSpecificationContext(details);

    await expect(rendered).toMatchFileSnapshot('../__snapshots__/spec-context.md');
    expect(details.sessions.every((session) => session.specId === seeded.specId)).toBe(true);
  });

  it('renders graph facts and the session scratchpad, never a persisted readiness score', () => {
    const rendered = renderSpecificationContext({
      spec: { id: 1, title: 'Elicitation gap guidance' },
      graph: { lsn: 4, nodes: [], edges: [] },
      sessions: [],
      scratchpad: [{ id: 'open-context', obligation: 'clarify the context', disposition: 'open' }],
    });

    expect(rendered).not.toMatch(/readiness|score|coverage|importance|rank/i);
    expect(rendered).toContain('lsn: 4');
    expect(rendered).toContain('clarify the context');
  });
});

async function loadFixture(name: string, variant = 'base'): Promise<SeedFixture> {
  const fixturePath = fileURLToPath(
    new URL(`../../../../../../.fixtures/seeds/${name}/${variant}.json`, import.meta.url),
  );
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
        timestamp: '2026-06-16T00:00:00.000Z',
        customType: 'brunch.session_binding',
        data: createSessionBindingData({ specId }),
      }),
      ...entries.map((entry) => JSON.stringify(entry)),
    ].join('\n') + '\n',
  );
}

function messageEntry(id: string, role: 'user' | 'assistant') {
  return {
    type: 'message',
    id,
    parentId: null,
    timestamp: '2026-06-16T00:00:00.000Z',
    message: { role, content: `${role} content` },
  };
}
