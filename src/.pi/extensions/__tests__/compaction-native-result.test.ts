import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  fauxAssistantMessage,
  fauxToolCall,
  type AssistantMessage,
  type FauxResponseStep,
} from '@earendil-works/pi-ai';
import {
  DefaultResourceLoader,
  SessionManager,
  SettingsManager,
  type CompactionEntry,
} from '@earendil-works/pi-coding-agent';
import { afterEach, describe, expect, it } from 'vitest';

import { createBrunchFauxHarness } from '../../../dev/faux-harness.js';
import { registerBrunchCompaction } from '../compaction/index.js';

const temporaryDirectories: string[] = [];
afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe('Brunch native compaction result', () => {
  it('persists one native result and rebuilds provider context with continuity immediately', async () => {
    const fixture = await createFixture([
      fauxAssistantMessage('seed response'),
      fauxAssistantMessage('recent response'),
      fauxAssistantMessage('native faux narrative'),
      fauxAssistantMessage('continued response'),
    ]);
    try {
      fixture.manager.appendCustomMessageEntry('worldUpdate', 'graph delta lsn 7', false, { lsn: 7 });
      await fixture.session.prompt(`old context ${'o'.repeat(400)}`, promptOptions);
      await fixture.session.prompt(`recent context ${'x'.repeat(100)}`, promptOptions);
      const result = await fixture.session.compact();
      const entry = fixture.manager
        .getEntries()
        .find((item) => item.type === 'compaction') as CompactionEntry;

      expect(result).toMatchObject({
        firstKeptEntryId: entry.firstKeptEntryId,
        tokensBefore: entry.tokensBefore,
        details: {
          readFiles: [],
          modifiedFiles: [],
          brunch: { compactionBlockSchemaVersion: 1, anchorContractVersion: 1 },
        },
      });
      expect(entry.fromHook).toBe(true);
      expect(entry.summary).toContain('graph delta lsn 7');
      expect(entry.summary).toContain('native faux narrative');
      expect(fixture.manager.getEntries().filter((item) => item.type === 'compaction')).toHaveLength(1);
      expect(JSON.stringify(fixture.manager.buildSessionContext().messages)).toContain('graph delta lsn 7');

      await fixture.session.prompt('continue now', promptOptions);
      expect(JSON.stringify(fixture.providerContexts.at(-1)?.messages)).toContain('graph delta lsn 7');
    } finally {
      fixture.dispose();
    }
  });

  it('replaces prior continuity on repeated compaction and reloads the latest carrier', async () => {
    const fixture = await createFixture([
      fauxAssistantMessage('first turn narrative'),
      fauxAssistantMessage('second turn narrative'),
      fauxAssistantMessage('first native summary'),
      fauxAssistantMessage('third turn narrative'),
      fauxAssistantMessage('second native summary'),
    ]);
    try {
      fixture.manager.appendCustomMessageEntry('worldUpdate', 'superseded carrier lsn 7', false, { lsn: 7 });
      await fixture.session.prompt(`first old context ${'a'.repeat(400)}`, promptOptions);
      await fixture.session.prompt(`second old context ${'b'.repeat(400)}`, promptOptions);
      await fixture.session.compact();
      fixture.manager.appendCustomMessageEntry('worldUpdate', 'newest carrier lsn 11', false, { lsn: 11 });
      await fixture.session.prompt(`third old context ${'c'.repeat(400)}`, promptOptions);
      await fixture.session.compact();

      const entries = fixture.manager
        .getEntries()
        .filter((entry): entry is CompactionEntry => entry.type === 'compaction');
      expect(entries).toHaveLength(2);
      const latest = entries.at(-1)!;
      expect(latest.summary.match(/<!-- brunch:compaction-continuity version=1 -->/g)).toHaveLength(1);
      expect(latest.summary).toContain('newest carrier lsn 11');
      expect(latest.summary).not.toContain('superseded carrier lsn 7');
      const summarizationContexts = fixture.providerContexts.filter((context) =>
        context.systemPrompt?.includes('context summarization assistant'),
      );
      expect(summarizationContexts).toHaveLength(2);
      expect(JSON.stringify(summarizationContexts[1]!.messages)).not.toContain(
        'brunch:compaction-continuity',
      );

      const file = fixture.manager.getSessionFile()!;
      expect((await readFile(file, 'utf8')).match(/"type":"compaction"/g)).toHaveLength(2);
      fixture.dispose();
      const reopened = await createFixture([fauxAssistantMessage('resumed after repeated compaction')], {
        cwd: fixture.cwd,
        manager: SessionManager.open(file),
      });
      try {
        const rebuilt = JSON.stringify(reopened.manager.buildSessionContext().messages);
        expect(rebuilt.match(/<!-- brunch:compaction-continuity version=1 -->/g)).toHaveLength(1);
        expect(rebuilt).toContain('newest carrier lsn 11');
        expect(rebuilt).not.toContain('superseded carrier lsn 7');
        const reopenedCompactions = reopened.manager
          .getEntries()
          .filter((entry): entry is CompactionEntry => entry.type === 'compaction');
        expect(reopenedCompactions.at(-1)?.details).toMatchObject({
          readFiles: [],
          modifiedFiles: [],
          brunch: { compactionBlockSchemaVersion: 1, anchorContractVersion: 1 },
        });
        await reopened.session.prompt('resume repeated session', promptOptions);
        const resumed = JSON.stringify(reopened.providerContexts[0]?.messages);
        expect(resumed).toContain('newest carrier lsn 11');
        expect(resumed).toContain('second native summary');
      } finally {
        reopened.dispose();
      }
    } finally {
      fixture.dispose();
    }
  });

  it('preserves native split-turn preparation and retained suffix', async () => {
    const observations: boolean[] = [];
    const fixture = await createFixture(
      [
        fauxAssistantMessage('completed turn before split'),
        toolCallMessage('probe-call'),
        usageMessage(`retained assistant suffix ${'s'.repeat(300)}`, 20),
        fauxAssistantMessage('native history narrative'),
        fauxAssistantMessage('native split-turn narrative'),
      ],
      { observeSplitTurn: observations, keepRecentTokens: 100 },
    );
    try {
      await fixture.session.prompt('completed user turn before split', promptOptions);
      fixture.manager.appendCustomMessageEntry('worldUpdate', 'split carrier lsn 13', false, { lsn: 13 });
      await fixture.session.prompt(`split user prefix ${'p'.repeat(600)}`, promptOptions);
      const result = await fixture.session.compact();

      expect(observations).toEqual([true]);
      expect(result.summary.match(/<!-- brunch:compaction-continuity version=1 -->/g)).toHaveLength(1);
      expect(result.summary).toContain('split carrier lsn 13');
      expect(result.summary).toContain('native split-turn narrative');
      expect(JSON.stringify(fixture.manager.buildSessionContext().messages)).toContain(
        'retained assistant suffix',
      );
    } finally {
      fixture.dispose();
    }
  });

  it('retries recognized overflow with continuity before the sole settlement', async () => {
    const events: string[] = [];
    const fixture = await createFixture(
      [
        fauxAssistantMessage('seed response'),
        overflowMessage(),
        fauxAssistantMessage('overflow native narrative'),
        fauxAssistantMessage('overflow retry succeeded'),
      ],
      { lifecycle: events },
    );
    try {
      fixture.manager.appendCustomMessageEntry('worldUpdate', 'overflow carrier lsn 17', false, { lsn: 17 });
      await fixture.session.prompt('seed before overflow', promptOptions);
      events.length = 0;
      await fixture.session.prompt(`overflow now ${'z'.repeat(400)}`, promptOptions);

      expect(events).toEqual([
        'session_before_compact:overflow:true',
        'session_compact:overflow:true:true',
        'agent_settled:overflow retry succeeded',
      ]);
      const entry = fixture.manager
        .getEntries()
        .find((item): item is CompactionEntry => item.type === 'compaction');
      expect(entry?.fromHook).toBe(true);
      expect(JSON.stringify(fixture.providerContexts.at(-1)?.messages)).toContain('overflow carrier lsn 17');
      expect(await readFile(fixture.manager.getSessionFile()!, 'utf8')).toContain('overflow retry succeeded');
    } finally {
      fixture.dispose();
    }
  });

  it('cancels an owned narrative failure without consuming default fallback', async () => {
    const fixture = await createFixture([
      fauxAssistantMessage('seed response'),
      fauxAssistantMessage('recent response'),
      () => {
        throw new Error('summary exploded');
      },
      fauxAssistantMessage('default fallback remained queued'),
    ]);
    try {
      fixture.manager.appendCustomMessageEntry('worldUpdate', 'failure oracle anchor', false);
      await fixture.session.prompt(`old context ${'o'.repeat(1000)}`, promptOptions);
      await fixture.session.prompt(`recent context ${'x'.repeat(100)}`, promptOptions);
      await expect(fixture.session.compact()).rejects.toThrow('Compaction cancelled');
      expect(fixture.manager.getEntries().filter((item) => item.type === 'compaction')).toHaveLength(0);

      await fixture.session.prompt('after cancelled compaction', promptOptions);
      expect(JSON.stringify(fixture.manager.buildSessionContext().messages)).toContain(
        'default fallback remained queued',
      );
    } finally {
      fixture.dispose();
    }
  });
});

const promptOptions = { expandPromptTemplates: false, source: 'rpc' as const };

interface FixtureOptions {
  cwd?: string;
  manager?: SessionManager;
  observeSplitTurn?: boolean[];
  lifecycle?: string[];
  keepRecentTokens?: number;
}

async function createFixture(responses: readonly FauxResponseStep[], options: FixtureOptions = {}) {
  const cwd = options.cwd ?? (await mkdtemp(join(tmpdir(), 'brunch-native-compaction-')));
  temporaryDirectories.push(cwd);
  const agentDir = await mkdtemp(join(tmpdir(), 'brunch-native-compaction-agent-'));
  temporaryDirectories.push(agentDir);
  const manager = options.manager ?? SessionManager.create(cwd, join(cwd, '.brunch/sessions'));
  const settingsManager = SettingsManager.inMemory({
    quietStartup: true,
    compaction: { enabled: true, reserveTokens: 20, keepRecentTokens: options.keepRecentTokens ?? 50 },
    retry: { enabled: false },
  });
  const resourceLoader = new DefaultResourceLoader({
    cwd,
    agentDir,
    settingsManager,
    extensionFactories: [
      (pi) => {
        if (options.observeSplitTurn) {
          pi.on('session_before_compact', (event) => {
            options.observeSplitTurn!.push(event.preparation.isSplitTurn);
          });
        }
        if (options.lifecycle) {
          pi.on('session_before_compact', (event) => {
            options.lifecycle!.push(`session_before_compact:${event.reason}:${event.willRetry}`);
          });
          pi.on('session_compact', (event) => {
            options.lifecycle!.push(
              `session_compact:${event.reason}:${event.willRetry}:${event.fromExtension}`,
            );
          });
          pi.on('agent_settled', (_event, ctx) => {
            const retryPersisted = JSON.stringify(ctx.sessionManager.getEntries()).includes(
              'overflow retry succeeded',
            );
            options.lifecycle!.push(
              `agent_settled:${retryPersisted ? 'overflow retry succeeded' : 'retry missing'}`,
            );
          });
        }
        registerBrunchCompaction(pi);
      },
    ],
    systemPromptOverride: () => 'Test Brunch compaction.',
  });
  await resourceLoader.reload();
  const harness = await createBrunchFauxHarness({
    cwd,
    responses,
    resourceLoader,
    settingsManager,
    sessionManager: manager,
    customTools: [
      {
        name: 'split_probe',
        label: 'Split probe',
        description: 'Returns a deterministic split-turn marker.',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
        execute: async () => ({
          content: [{ type: 'text', text: `split tool result ${'t'.repeat(600)}` }],
          details: {},
          isError: false,
        }),
      },
    ],
  });
  return { ...harness, cwd, manager };
}

function toolCallMessage(id: string): AssistantMessage {
  const message = fauxAssistantMessage([fauxToolCall('split_probe', {}, { id })], {
    stopReason: 'toolUse',
  });
  return {
    ...message,
    usage: {
      input: 200,
      output: 1,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 201,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
  };
}

function usageMessage(text: string, input: number): AssistantMessage {
  const message = fauxAssistantMessage(text);
  return {
    ...message,
    usage: {
      input,
      output: 1,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: input + 1,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
  };
}

function overflowMessage(): AssistantMessage {
  return fauxAssistantMessage('', {
    stopReason: 'error',
    errorMessage: 'maximum context length exceeded',
  });
}
