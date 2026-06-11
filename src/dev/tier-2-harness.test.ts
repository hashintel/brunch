import { type ToolDefinition } from '@earendil-works/pi-coding-agent';
import { describe, expect, it } from 'vitest';

import { openWorkspaceGraphRuntime } from '../graph/index.js';
import { assistantMessage, userMessage } from '../probes/test-helpers.js';
import { projectAssistantVisibleWatermark } from '../projections/session/assistant-visible-watermark.js';
import { projectBrunchAgentState } from '../projections/session/runtime-state.js';
import { BRUNCH_AGENT_RUNTIME_STATE_CUSTOM_TYPE } from '../session/runtime-state.js';
import {
  bootTier2RuntimeThroughRunBrunchTui,
  resumeTier2Fixture,
  runTier2RealBootFauxTurn,
} from './tier-2-harness.js';

describe('FE-847 Tier-2 real boot harness', () => {
  it('owns real runtime boot proof for ready context and BRUNCH_DEV-gated query tools', async () => {
    const productBoot = await bootTier2RuntimeThroughRunBrunchTui({ dev: false });
    try {
      expect(productBoot.runtime.session.sessionManager.getHeader()).toMatchObject({
        cwd: productBoot.cwd,
        id: expect.any(String),
        type: 'session',
      });
      await expect(readSessionContextDetails(productBoot.runtime.session)).resolves.toMatchObject({
        status: 'ready',
        specId: expect.any(Number),
      });
      await expect(readWorkspaceContextMarkdownFiles(productBoot.runtime.session)).resolves.toContain(
        'boot-seam.md',
      );
      expect(productBoot.runtime.session.getAllTools().map((tool) => tool.name)).not.toEqual(
        expect.arrayContaining(['brunch_session_query', 'brunch_introspect_query']),
      );
      expect(productBoot.runtime.session.getActiveToolNames()).not.toEqual(
        expect.arrayContaining(['brunch_session_query', 'brunch_introspect_query']),
      );
    } finally {
      await productBoot.runtime.dispose();
      productBoot.restoreEnv();
    }

    const devBoot = await bootTier2RuntimeThroughRunBrunchTui({ dev: true });
    try {
      expect(devBoot.runtime.session.sessionManager.getHeader()).toMatchObject({ cwd: devBoot.cwd });
      await expect(readSessionContextDetails(devBoot.runtime.session)).resolves.toMatchObject({
        status: 'ready',
      });
      expect(devBoot.runtime.session.getAllTools().map((tool) => tool.name)).toEqual(
        expect.arrayContaining(['brunch_session_query', 'brunch_introspect_query']),
      );
      expect(devBoot.runtime.session.getActiveToolNames()).toEqual(
        expect.arrayContaining(['brunch_session_query', 'brunch_introspect_query']),
      );
    } finally {
      await devBoot.runtime.dispose();
      devBoot.restoreEnv();
    }
  });

  it('invokes a registered Brunch runtime switch command through the real runBrunchTui boot', async () => {
    const boot = await bootTier2RuntimeThroughRunBrunchTui({ dev: false });
    try {
      const command = boot.runtime.session.extensionRunner.getCommand('brunch:lens');
      expect(command).toBeDefined();

      await command?.handler('intent', boot.runtime.session.extensionRunner.createCommandContext());

      const entries = boot.runtime.session.sessionManager.getEntries();
      expect(entries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'custom',
            customType: BRUNCH_AGENT_RUNTIME_STATE_CUSTOM_TYPE,
            data: expect.objectContaining({
              reason: 'switch',
              source: 'user',
              state: expect.objectContaining({ agentLens: 'intent' }),
              previous: expect.objectContaining({ agentLens: 'auto' }),
            }),
          }),
        ]),
      );
      expect(projectBrunchAgentState(entries).agentLens).toBe('intent');
      expect(boot.runtime.session.getActiveToolNames()).not.toEqual(expect.arrayContaining(['bash']));
    } finally {
      await boot.runtime.dispose();
      boot.restoreEnv();
    }
  });

  it('boots runBrunchTui, drives one faux-provider turn, captures payload, and inspects transcript entries', async () => {
    const result = await runTier2RealBootFauxTurn({
      prompt: 'Tier-2 oracle prompt',
      responseText: 'Tier-2 oracle response',
    });

    expect(result.providerPayload).toBeDefined();
    expect(result.providerContexts).toHaveLength(1);
    expect(result.activeToolNames).toEqual(result.providerPayload?.activeToolNames);
    expect(result.assistantText).toBe('Tier-2 oracle response');
    expect(result.transcriptEntries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'message',
          message: expect.objectContaining({ role: 'user' }),
        }),
        expect.objectContaining({
          type: 'message',
          message: expect.objectContaining({ role: 'assistant' }),
        }),
      ]),
    );
    expect(JSON.stringify(result.transcriptEntries)).toContain('Tier-2 oracle prompt');
    expect(result.renderedTranscript).toContain('Tier-2 oracle response');
  });

  it('resumes from a fixture transcript and exposes transcript state', async () => {
    const fixtureJsonl = [
      JSON.stringify(userMessage('Fixture question')),
      JSON.stringify(assistantMessage('Fixture answer')),
    ].join('\n');

    const result = await resumeTier2Fixture({ fixtureJsonl });

    expect(result.resumedSameSessionFile).toBe(true);
    expect(result.originalSessionFile).toBe(result.sessionFile);
    expect(result.transcriptEntries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'message', message: expect.objectContaining({ role: 'user' }) }),
        expect.objectContaining({ type: 'message', message: expect.objectContaining({ role: 'assistant' }) }),
      ]),
    );
    expect(JSON.stringify(result.transcriptEntries)).toContain('Fixture question');
  });
});

describe('FE-847 coverage-first scaffold — I45-L assistant-visible watermark', () => {
  it('seed and full-overview snapshots advance the watermark while narrow getNodes/queryNodes reads do not', async () => {
    const boot = await bootTier2RuntimeThroughRunBrunchTui({ dev: false });
    try {
      const specId = await readSessionContextSpecId(boot.runtime.session);
      const graph = await openWorkspaceGraphRuntime(boot.cwd);
      const first = graph.commandExecutor.createNode({
        specId,
        plane: 'intent',
        kind: 'goal',
        title: 'Narrow-read goal',
      });
      if (first.status !== 'success') throw new Error('Failed to create Tier-2 graph fixture node');

      await executeReadGraph(boot.runtime.session, { mode: 'list_by_kind', kinds: ['goal'], show: 'all' });
      await boot.runtime.session.extensionRunner.emitBeforeProviderRequest({});
      const afterNarrowRead = boot.runtime.session.sessionManager.getEntries();
      expect(customEntries(afterNarrowRead, 'worldUpdate')).toEqual([
        expect.objectContaining({
          data: expect.objectContaining({
            specId,
            currentLsn: first.lsn,
            changedSinceLsn: 0,
            items: expect.arrayContaining([
              expect.objectContaining({ lsn: first.lsn, title: 'Narrow-read goal' }),
            ]),
          }),
        }),
      ]);

      await executeReadGraph(boot.runtime.session, { mode: 'overview', show: 'all' });
      const afterOverview = boot.runtime.session.sessionManager.getEntries();
      expect(projectAssistantVisibleWatermark(afterOverview, { specId })).toEqual({ specId, lsn: first.lsn });
      await boot.runtime.session.extensionRunner.emitBeforeProviderRequest({});
      expect(customEntries(boot.runtime.session.sessionManager.getEntries(), 'worldUpdate')).toHaveLength(1);
    } finally {
      await boot.runtime.dispose();
      boot.restoreEnv();
    }
  });

  it('worldUpdate emits the strict-greater set through the live provider guard retry', async () => {
    const boot = await bootTier2RuntimeThroughRunBrunchTui({ dev: false });
    try {
      const specId = await readSessionContextSpecId(boot.runtime.session);
      boot.runtime.session.sessionManager.appendCustomEntry('brunch.context_seed', {
        specId,
        snapshotLsn: 1,
      });
      const graph = await openWorkspaceGraphRuntime(boot.cwd);
      const stale = graph.commandExecutor.createNode({ specId, plane: 'intent', kind: 'goal', title: 'Old' });
      const fresh = graph.commandExecutor.createNode({
        specId,
        plane: 'intent',
        kind: 'requirement',
        title: 'Fresh',
      });
      if (stale.status !== 'success' || fresh.status !== 'success') {
        throw new Error('Failed to create Tier-2 graph fixture nodes');
      }

      await boot.runtime.session.extensionRunner.emitBeforeProviderRequest({});

      expect(customEntries(boot.runtime.session.sessionManager.getEntries(), 'worldUpdate')).toEqual([
        expect.objectContaining({
          data: expect.objectContaining({
            specId,
            currentLsn: fresh.lsn,
            changedSinceLsn: 1,
            items: [expect.objectContaining({ lsn: stale.lsn }), expect.objectContaining({ lsn: fresh.lsn })],
          }),
        }),
      ]);
    } finally {
      await boot.runtime.dispose();
      boot.restoreEnv();
    }
  });

  it('bare LSNs are never compared across specs; watermark comparisons use {specId, lsn}', async () => {
    const boot = await bootTier2RuntimeThroughRunBrunchTui({ dev: false });
    try {
      const specId = await readSessionContextSpecId(boot.runtime.session);
      boot.runtime.session.sessionManager.appendCustomEntry('brunch.context_seed', {
        specId: specId + 1,
        snapshotLsn: 99,
      });
      const graph = await openWorkspaceGraphRuntime(boot.cwd);
      const node = graph.commandExecutor.createNode({
        specId,
        plane: 'intent',
        kind: 'goal',
        title: 'Spec-local',
      });
      if (node.status !== 'success') throw new Error('Failed to create Tier-2 graph fixture node');

      await boot.runtime.session.extensionRunner.emitBeforeProviderRequest({});

      expect(customEntries(boot.runtime.session.sessionManager.getEntries(), 'worldUpdate')[0]).toEqual(
        expect.objectContaining({
          data: expect.objectContaining({ specId, changedSinceLsn: 0, currentLsn: node.lsn }),
        }),
      );
    } finally {
      await boot.runtime.dispose();
      boot.restoreEnv();
    }
  });

  it('a foreign write between snapshot read and seed insertion is not masked by the seed', async () => {
    const boot = await bootTier2RuntimeThroughRunBrunchTui({ dev: false });
    try {
      const specId = await readSessionContextSpecId(boot.runtime.session);
      boot.runtime.session.sessionManager.appendCustomEntry('brunch.context_seed', {
        specId,
        snapshotLsn: 1,
      });
      const graph = await openWorkspaceGraphRuntime(boot.cwd);
      const node = graph.commandExecutor.createNode({
        specId,
        plane: 'intent',
        kind: 'goal',
        title: 'Foreign write after seed snapshot',
      });
      if (node.status !== 'success') throw new Error('Failed to create Tier-2 graph fixture node');

      await boot.runtime.session.extensionRunner.emitBeforeProviderRequest({});

      expect(customEntries(boot.runtime.session.sessionManager.getEntries(), 'worldUpdate')[0]).toEqual(
        expect.objectContaining({
          data: expect.objectContaining({
            specId,
            changedSinceLsn: 1,
            items: [expect.objectContaining({ title: 'Foreign write after seed snapshot' })],
          }),
        }),
      );
    } finally {
      await boot.runtime.dispose();
      boot.restoreEnv();
    }
  });

  it('same-session capture is surfaced by the next worldUpdate rather than swallowed as already visible', async () => {
    const boot = await bootTier2RuntimeThroughRunBrunchTui({ dev: false });
    try {
      const specId = await readSessionContextSpecId(boot.runtime.session);
      boot.runtime.session.sessionManager.appendCustomEntry('brunch.context_seed', {
        specId,
        snapshotLsn: 1,
      });
      const graph = await openWorkspaceGraphRuntime(boot.cwd);
      const node = graph.commandExecutor.createNode({
        specId,
        plane: 'intent',
        kind: 'context',
        title: 'Captured from submit',
      });
      if (node.status !== 'success') throw new Error('Failed to create Tier-2 graph fixture node');

      await boot.runtime.session.extensionRunner.emitBeforeProviderRequest({});

      expect(customEntries(boot.runtime.session.sessionManager.getEntries(), 'worldUpdate')[0]).toEqual(
        expect.objectContaining({
          data: expect.objectContaining({
            specId,
            items: [expect.objectContaining({ title: 'Captured from submit' })],
          }),
        }),
      );
    } finally {
      await boot.runtime.dispose();
      boot.restoreEnv();
    }
  });
});

describe.skip('FE-847 coverage-first scaffold — I46-L honest origination', () => {
  it('a new session seeds context and kicks an assistant-originated turn with no fabricated user entry');
  it('resume kick uses the pre-reconcile tail so a user tail still earns a kick after continuity notices');
  it('request_* and system leaves stay idle on resume');
  it('crash-after-notice-before-provider still kicks when the underlying debt is unanswered');
  it('trailing side-task or reviewer drains are continuity-only and do not manufacture or mask debt');
});

describe.skip('FE-847 coverage-first scaffold — I47-L carrier discipline and idempotence', () => {
  it('no redundant worldUpdate is emitted immediately after a seed naming the current snapshot LSN');
  it('compaction and resume preserve the latest watermark carrier so projection cannot regress');
  it('boot/resume seeding derives dedupe from transcript projection rather than hidden flags');
  it('continuity assertions use sets and {specId, lsn} properties rather than payload-order goldens');
});

async function readSessionContextDetails(session: {
  getToolDefinition(name: string): ToolDefinition | undefined;
  sessionManager: unknown;
}) {
  const tool = session.getToolDefinition('read_session_context');
  if (!tool) throw new Error('read_session_context tool is not registered');
  const result = await tool.execute('boot-session-context', {}, undefined, undefined, {
    sessionManager: session.sessionManager,
  } as never);
  return result.details;
}

async function readSessionContextSpecId(session: {
  getToolDefinition(name: string): ToolDefinition | undefined;
  sessionManager: unknown;
}): Promise<number> {
  const details = await readSessionContextDetails(session);
  if (!isRecord(details) || typeof details.specId !== 'number') {
    throw new Error('read_session_context did not return a numeric specId');
  }
  return details.specId;
}

async function executeReadGraph(
  session: { getToolDefinition(name: string): ToolDefinition | undefined; sessionManager: unknown },
  params: Record<string, unknown>,
): Promise<unknown> {
  const tool = session.getToolDefinition('read_graph');
  if (!tool) throw new Error('read_graph tool is not registered');
  return tool.execute('tier-2-read-graph', params, undefined, undefined, {
    sessionManager: session.sessionManager,
  } as never);
}

function customEntries(entries: readonly unknown[], customType: string): ReadonlyArray<{ data: unknown }> {
  return entries.filter(
    (entry): entry is { customType: string; data: unknown } =>
      typeof entry === 'object' &&
      entry !== null &&
      (entry as { customType?: unknown }).customType === customType,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function readWorkspaceContextMarkdownFiles(session: {
  getToolDefinition(name: string): ToolDefinition | undefined;
  sessionManager: unknown;
}): Promise<string[]> {
  const tool = session.getToolDefinition('read_workspace_context');
  if (!tool) throw new Error('read_workspace_context tool is not registered');
  const result = (await tool.execute(
    'boot-workspace-context',
    { mode: 'cwd_inventory' },
    undefined,
    undefined,
    { sessionManager: session.sessionManager } as never,
  )) as { details: { data: { markdownFiles: Array<{ path: string }> } } };
  return result.details.data.markdownFiles.map((file) => file.path);
}
