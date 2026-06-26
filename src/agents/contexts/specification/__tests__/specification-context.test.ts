import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { openWorkspaceCommandExecutor } from '../../../../graph/index.js';
import { presenceGap } from '../../../../graph/schema/elicitation-gap-fixtures.js';
import { seedFixture, type SeedFixture } from '../../../../graph/seed-fixtures.js';
import { createSessionBindingData } from '../../../../session/session-binding.js';
import { inspectSpecificationOverview } from '../../../../session/specification-overview-context.js';
import { renderSpecificationContext } from '../specification-context.js';

describe('renderSpecificationContext', () => {
  it('renders the approved specification house style', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-specification-context-'));
    const executor = await openWorkspaceCommandExecutor(cwd);
    const seeded = seedFixture(executor, await loadFixture('alpha-grounding', 'workspace-spread'));
    await mkdir(join(cwd, '.brunch', 'sessions'), { recursive: true });
    await writeBoundSession(cwd, 'alpha-session', seeded.specId, [
      messageEntry('u1', 'user'),
      messageEntry('a1', 'assistant'),
    ]);

    const details = await inspectSpecificationOverview(cwd, seeded.specId);
    const rendered = renderSpecificationContext(details);

    await expect(rendered).toMatchFileSnapshot('../__snapshots__/specification-context.md');
    expect(rendered).toContain('<specification>');
    expect(rendered).toContain('Overview:');
    expect(rendered).toContain('Graph (LSN 2): 5 nodes, 3 edges');
    expect(rendered).toContain('| id | upstream | relation | downstream |');
    expect(rendered).toContain('Gaps:');
    expect(rendered).toContain('Sessions:');
    expect(rendered.indexOf('Overview:')).toBeLessThan(rendered.indexOf('Graph (LSN 2):'));
    expect(rendered.indexOf('Graph (LSN 2):')).toBeLessThan(rendered.indexOf('Gaps:'));
    expect(rendered.indexOf('Gaps:')).toBeLessThan(rendered.indexOf('Sessions:'));
    expect(rendered).toContain('| code | id | title |');
    expect(rendered).toContain('| id | upstream | relation | downstream |');
    expect(rendered).toContain('| name | file | turns |');
    expect(rendered).toContain('```toon');
    expect(rendered).not.toContain('- graph:');
    expect(rendered).not.toContain('Graph:');
    expect(rendered).not.toMatch(/^#{1,6}\s/m);
    expect(details.sessions.every((session) => session.specId === seeded.specId)).toBe(true);
  });

  it('computes readiness over the full register while Gaps renders the ask-filtered set', () => {
    const openGrounding = presenceGap({ id: 'open-context', refersTo: 'context', coverage: 0 });
    const answeredGrounding = presenceGap({ id: 'answered-goal', refersTo: 'goal', coverage: 1 });
    const rendered = renderSpecificationContext({
      spec: { id: 1, title: 'Readiness parity' },
      graph: { lsn: 4, nodes: [], edges: [] },
      sessions: [],
      gaps: [openGrounding],
      readinessGaps: [openGrounding, answeredGrounding],
    });

    expect(rendered).toContain('readiness estimate (soft; gates nothing): grounding=0.50');
    expect(rendered).toContain('open-context');
    expect(rendered).not.toContain('answered-goal');
  });
});

async function loadFixture(slug: string, set = 'bilal-port'): Promise<SeedFixture> {
  const fixturePath = fileURLToPath(
    new URL(`../../../../../.fixtures/seeds/${set}/${slug}.json`, import.meta.url),
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
