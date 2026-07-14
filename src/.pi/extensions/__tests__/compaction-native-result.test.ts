import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { fauxAssistantMessage, type FauxResponseStep } from '@earendil-works/pi-ai';
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

async function createFixture(responses: readonly FauxResponseStep[]) {
  const cwd = await mkdtemp(join(tmpdir(), 'brunch-native-compaction-'));
  temporaryDirectories.push(cwd);
  const agentDir = await mkdtemp(join(tmpdir(), 'brunch-native-compaction-agent-'));
  temporaryDirectories.push(agentDir);
  const manager = SessionManager.create(cwd, join(cwd, '.brunch/sessions'));
  const settingsManager = SettingsManager.inMemory({
    quietStartup: true,
    compaction: { enabled: true, reserveTokens: 20, keepRecentTokens: 50 },
    retry: { enabled: false },
  });
  const resourceLoader = new DefaultResourceLoader({
    cwd,
    agentDir,
    settingsManager,
    extensionFactories: [(pi) => registerBrunchCompaction(pi)],
    systemPromptOverride: () => 'Test Brunch compaction.',
  });
  await resourceLoader.reload();
  const harness = await createBrunchFauxHarness({
    cwd,
    responses,
    resourceLoader,
    settingsManager,
    sessionManager: manager,
  });
  return { ...harness, manager };
}
