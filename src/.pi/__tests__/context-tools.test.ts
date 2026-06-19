import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { createBrunchFauxHarness } from '../../dev/index.js';
import { openWorkspaceCommandExecutor } from '../../graph/index.js';
import { seedFixture, type SeedFixture } from '../../graph/seed-fixtures.js';
import { createSessionBindingData, SESSION_BINDING_TYPE } from '../../session/session-binding.js';
import { registerBrunchContext } from '../extensions/context/index.js';

function collectContextTools() {
  const tools = new Map<string, { execute: (...args: any[]) => Promise<unknown> }>();
  registerBrunchContext({
    registerTool(tool: { name: string; execute: (...args: any[]) => Promise<unknown> }) {
      tools.set(tool.name, tool);
    },
  } as never);
  return tools;
}

describe('context tools', () => {
  it('read_workspace_context returns a gitignore-aware cwd inventory', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-context-tool-'));
    await mkdir(join(cwd, '.brunch', 'sessions'), { recursive: true });
    await mkdir(join(cwd, 'visible'), { recursive: true });
    await mkdir(join(cwd, 'ignored-dir'), { recursive: true });
    await writeFile(join(cwd, '.gitignore'), ['ignored-dir/', 'ignored.md'].join('\n'));
    await writeFile(join(cwd, 'README.md'), '# Context\n');
    await writeFile(join(cwd, 'ignored.md'), '# Hidden\n');
    await writeFile(join(cwd, 'visible', 'guide.md'), 'Guide\n');
    await writeFile(
      join(cwd, '.brunch', 'sessions', 'session-1.jsonl'),
      [
        JSON.stringify({ type: 'session', id: 'session-1', cwd }),
        JSON.stringify({
          id: 'binding-1',
          type: 'custom',
          parentId: null,
          customType: 'brunch.session_binding',
          data: createSessionBindingData({ specId: 1 }),
        }),
      ].join('\n') + '\n',
    );

    const tools = new Map<string, { execute: (...args: any[]) => Promise<unknown> }>();
    registerBrunchContext({
      registerTool(tool: { name: string; execute: (...args: any[]) => Promise<unknown> }) {
        tools.set(tool.name, tool);
      },
    } as never);

    const result = (await tools
      .get('read_workspace_context')!
      .execute('context-cwd', { mode: 'cwd_inventory' }, undefined, undefined, {
        sessionManager: {
          getHeader: () => ({ type: 'session', id: 'session-1', cwd }),
        },
      })) as {
      content: Array<{ type: 'text'; text: string }>;
      details: { topology: { children?: Array<{ name: string; children?: Array<{ name: string }> }> } };
    };

    expect(result.content[0]?.text).toContain('<workspace>');
    expect(result.content[0]?.text).toContain('Project:');
    expect(result.content[0]?.text).toContain('Topology:');
    expect(result.content[0]?.text).not.toContain('session-1.jsonl');
    expect(result.details).not.toHaveProperty('mode');
    expect(result.details).not.toHaveProperty('data');
    expect(result.details.topology.children?.map((entry) => entry.name)).toContain('README.md');
    expect(result.details.topology.children?.find((entry) => entry.name === 'visible')?.children).toEqual([
      { name: 'guide.md', kind: 'file', fileCount: 1 },
    ]);
  });

  it('read_session_context returns runtime-frame markdown plus typed details', async () => {
    const tools = new Map<string, { execute: (...args: any[]) => Promise<unknown> }>();

    registerBrunchContext({
      registerTool(tool: { name: string; execute: (...args: any[]) => Promise<unknown> }) {
        tools.set(tool.name, tool);
      },
    } as never);

    const result = (await tools.get('read_session_context')!.execute('context-1', {}, undefined, undefined, {
      sessionManager: {
        // The Pi header is reachable only via getHeader(); getEntries() never
        // contains a 'session' entry.
        getHeader: () => ({ type: 'session', id: 'session-1', cwd: '/tmp/brunch' }),
        getEntries: () => [
          {
            id: 'binding-1',
            type: 'custom',
            parentId: null,
            customType: 'brunch.session_binding',
            data: createSessionBindingData({ specId: 1 }),
          },
          {
            id: 'runtime-1',
            type: 'custom',
            parentId: 'binding-1',
            customType: 'brunch.agent_runtime_state',
            data: {
              schemaVersion: 1,
              reason: 'switch',
              source: 'user',
              state: {
                schemaVersion: 1,
                operationalMode: 'elicit',
                agentStrategy: 'project-graph',
                agentLens: 'oracle',
              },
            },
          },
          {
            id: 'mention-1',
            type: 'custom',
            parentId: 'runtime-1',
            customType: 'brunch.mention',
            data: { entityId: 'node-1', handle: 'D12', title: 'Decision seam', snapshottedLsn: 7 },
          },
        ],
      },
    })) as {
      content: Array<{ type: 'text'; text: string }>;
      details: unknown;
    };

    expect(result.content[0]?.text).toContain('[Selected session runtime frame]');
    expect(result.content[0]?.text).toContain('#D12');
    expect(result.content[0]?.text).not.toContain('node-1');
    expect(result.details).toMatchObject({
      status: 'ready',
      specId: 1,
      sessionId: 'session-1',
      agent: {
        strategy: 'project-graph',
        lens: 'oracle',
      },
    });
  });

  it('read_session_context reports missing binding as not_ready instead of throwing', async () => {
    const tools = new Map<string, { execute: (...args: any[]) => Promise<unknown> }>();

    registerBrunchContext({
      registerTool(tool: { name: string; execute: (...args: any[]) => Promise<unknown> }) {
        tools.set(tool.name, tool);
      },
    } as never);

    const result = (await tools.get('read_session_context')!.execute('context-2', {}, undefined, undefined, {
      sessionManager: {
        getHeader: () => ({ type: 'session', id: 'session-1', cwd: '/tmp/brunch' }),
        getEntries: () => [],
      },
    })) as {
      content: Array<{ type: 'text'; text: string }>;
      details: unknown;
    };

    expect(result.content[0]?.text).toContain('status: not_ready');
    expect(result.details).toEqual({
      status: 'not_ready',
      reason: 'missing_binding',
      sessionId: 'session-1',
    });
  });

  it('read_session_context reports missing_session_header only when getHeader() is null', async () => {
    const tools = new Map<string, { execute: (...args: any[]) => Promise<unknown> }>();

    registerBrunchContext({
      registerTool(tool: { name: string; execute: (...args: any[]) => Promise<unknown> }) {
        tools.set(tool.name, tool);
      },
    } as never);

    // Regression: the header lives behind getHeader(), not in getEntries(). A
    // present binding in getEntries() with a null header must still be
    // not_ready / missing_session_header, never ready.
    const result = (await tools.get('read_session_context')!.execute('context-3', {}, undefined, undefined, {
      sessionManager: {
        getHeader: () => null,
        getEntries: () => [
          {
            id: 'binding-1',
            type: 'custom',
            parentId: null,
            customType: 'brunch.session_binding',
            data: createSessionBindingData({ specId: 1 }),
          },
        ],
      },
    })) as {
      content: Array<{ type: 'text'; text: string }>;
      details: unknown;
    };

    expect(result.details).toEqual({
      status: 'not_ready',
      reason: 'missing_session_header',
      sessionId: null,
    });
  });

  it('read_workspace_context returns a workspace overview for bound specs and sessions', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-context-overview-'));
    const executor = await openWorkspaceCommandExecutor(cwd);
    const alpha = seedFixture(executor, await loadFixture('alpha-grounding', 'workspace-spread'));
    const beta = seedFixture(executor, await loadFixture('beta-commitments', 'workspace-spread'));

    await mkdir(join(cwd, '.brunch', 'sessions'), { recursive: true });
    await writeBoundSession(cwd, 'alpha-session', alpha.specId, [messageEntry('u1', 'user')]);
    await writeBoundSession(cwd, 'beta-session', beta.specId, [
      messageEntry('u1', 'user'),
      messageEntry('a1', 'assistant'),
    ]);

    const tools = new Map<string, { execute: (...args: any[]) => Promise<unknown> }>();
    registerBrunchContext({
      registerTool(tool: { name: string; execute: (...args: any[]) => Promise<unknown> }) {
        tools.set(tool.name, tool);
      },
    } as never);

    const result = (await tools
      .get('read_workspace_context')!
      .execute('context-overview', { mode: 'workspace_overview' }, undefined, undefined, {
        sessionManager: {
          getHeader: () => ({ type: 'session', id: 'session-1', cwd }),
        },
      })) as {
      content: Array<{ type: 'text'; text: string }>;
      details: { specs: Array<{ title: string }>; sessions: Array<{ turnCount: number }> };
    };

    expect(result.content[0]?.text).toContain('<workspace>');
    expect(result.content[0]?.text).toContain('Specifications:');
    expect(result.content[0]?.text).toContain('Alpha Grounding');
    expect(result.content[0]?.text).toContain('Beta Commitments');
    expect(result.content[0]?.text).not.toContain('readiness_grade=');
    expect(result.details).not.toHaveProperty('mode');
    expect(result.details).not.toHaveProperty('data');
    expect(result.details.specs.map((spec) => spec.title)).toEqual(['Alpha Grounding', 'Beta Commitments']);
    expect(result.details.sessions.map((session) => session.turnCount)).toEqual([1, 2]);
  });

  it('read_specification_context returns the selected spec render through the registered tool', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-specification-tool-'));
    const executor = await openWorkspaceCommandExecutor(cwd);
    const alpha = seedFixture(executor, await loadFixture('alpha-grounding', 'workspace-spread'));
    const beta = seedFixture(executor, await loadFixture('beta-commitments', 'workspace-spread'));

    await mkdir(join(cwd, '.brunch', 'sessions'), { recursive: true });
    await writeBoundSession(cwd, 'alpha-session', alpha.specId, [messageEntry('u1', 'user')]);
    await writeBoundSession(cwd, 'beta-session', beta.specId, [
      messageEntry('u1', 'user'),
      messageEntry('a1', 'assistant'),
    ]);

    const tools = collectContextTools();
    const result = (await tools
      .get('read_specification_context')!
      .execute('context-spec', {}, undefined, undefined, {
        sessionManager: {
          getHeader: () => ({ type: 'session', id: 'beta-session', cwd }),
          getEntries: () => [
            {
              id: 'binding-1',
              type: 'custom',
              parentId: null,
              timestamp: '2026-06-16T00:00:00.000Z',
              customType: 'brunch.session_binding',
              data: createSessionBindingData({ specId: beta.specId }),
            },
          ],
        },
      })) as {
      content: Array<{ type: 'text'; text: string }>;
      details: {
        spec: { id: number; title: string };
        sessions: Array<{ specId: number; turnCount: number }>;
      };
    };

    expect(result.content[0]?.text).toContain('<specification>');
    expect(result.content[0]?.text).toContain('Overview:');
    expect(result.content[0]?.text).toContain('Sessions:');
    expect(result.content[0]?.text).toContain('Gaps:');
    expect(result.content[0]?.text).toContain('Beta Commitments');
    expect(result.content[0]?.text).not.toContain('Alpha Grounding');
    expect(result.details.spec).toEqual({ id: beta.specId, title: 'Beta Commitments' });
    expect(result.details.sessions).toMatchObject([{ specId: beta.specId, turnCount: 2 }]);
  });

  // Authentic oracle: drive the context tools against the faux harness's REAL
  // SessionManager instead of a hand-written fake. The real manager keeps the
  // Pi header behind getHeader() and excludes it from getEntries(), so this
  // would have failed the header-search bugs (read_session_context always
  // not_ready, read_workspace_context resolving cwd to process.cwd()). A lying
  // mock cannot reproduce that split; the real session machinery does.
  it('context tools resolve against the faux harness real SessionManager (header via getHeader)', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-context-faux-'));
    await mkdir(join(cwd, '.brunch', 'sessions'), { recursive: true });
    await writeFile(join(cwd, 'faux-guard-doc.md'), '# Faux guard\n');

    const harness = await createBrunchFauxHarness({ cwd });
    try {
      const sessionManager = harness.session.sessionManager;
      sessionManager.appendCustomEntry(SESSION_BINDING_TYPE, createSessionBindingData({ specId: 4 }));

      // The real header is reachable only via getHeader(); getEntries() returns
      // SessionEntry[], whose `type` provably never includes 'session' (a search
      // for it is now a compile error — the original bug's root cause). The
      // header below comes from getHeader(); getEntries() holds only the binding.
      const headerId = sessionManager.getHeader()?.id;
      expect(typeof headerId).toBe('string');

      const tools = collectContextTools();
      const ctx = { sessionManager };

      const sessionResult = (await tools
        .get('read_session_context')!
        .execute('faux-session', {}, undefined, undefined, ctx)) as { details: unknown };
      expect(sessionResult.details).toMatchObject({
        status: 'ready',
        specId: 4,
        sessionId: headerId,
      });

      const workspaceResult = (await tools
        .get('read_workspace_context')!
        .execute('faux-workspace', { mode: 'cwd_inventory' }, undefined, undefined, ctx)) as {
        details: { topology: { children?: Array<{ name: string }> } };
      };
      // cwd came from the header (the temp workbench), not process.cwd().
      expect(workspaceResult.details.topology.children?.map((entry) => entry.name)).toContain(
        'faux-guard-doc.md',
      );
    } finally {
      harness.dispose();
    }
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

function messageEntry(id: string, role: 'user' | 'assistant') {
  return {
    type: 'message',
    id,
    parentId: null,
    timestamp: '2026-06-16T00:00:00.000Z',
    message: { role, content: `${role} content` },
  };
}
