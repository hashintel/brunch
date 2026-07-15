import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { fauxAssistantMessage, type AssistantMessage } from '@earendil-works/pi-ai';
import {
  DefaultResourceLoader,
  SessionManager,
  SettingsManager,
  type CompactionEntry,
  type ExtensionFactory,
} from '@earendil-works/pi-coding-agent';
import { afterEach, describe, expect, it } from 'vitest';

import { createBrunchFauxHarness } from '../faux-harness.js';

const SUMMARY_MARKER = 'native summary marker';
const NEXT_TURN_MARKER = 'deferred next-turn marker';
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe('Pi native compaction lifecycle', () => {
  it('persists and reloads native manual compaction through public session APIs', async () => {
    const fixture = await createFixture({
      responses: [usageMessage('seed response', 24), fauxAssistantMessage(SUMMARY_MARKER)],
    });
    const lifecycle: string[] = [];
    fixture.session.subscribe((event) => {
      if (event.type === 'compaction_start' || event.type === 'compaction_end') lifecycle.push(event.type);
    });
    fixture.observations.pushTo = lifecycle;

    try {
      await fixture.session.prompt(`old context ${'x'.repeat(400)}`, promptOptions);
      const result = await fixture.session.compact();
      const entry = onlyCompaction(fixture.manager);

      expect(lifecycle).toEqual([
        'compaction_start',
        'session_before_compact:manual:false',
        'session_compact:manual:false:false',
        'compaction_end',
      ]);
      expect(result).toMatchObject({
        firstKeptEntryId: entry.firstKeptEntryId,
        tokensBefore: entry.tokensBefore,
        details: { readFiles: [], modifiedFiles: [] },
      });
      expect(result.summary).toContain(SUMMARY_MARKER);
      expect(entry).toMatchObject({
        summary: result.summary,
        firstKeptEntryId: result.firstKeptEntryId,
        tokensBefore: result.tokensBefore,
        details: result.details,
      });
      expect(entry.fromHook).not.toBe(true);
      expect(fixture.providerContexts[1]?.systemPrompt).toContain('context summarization assistant');

      const jsonl = await readFile(fixture.file, 'utf8');
      expect(jsonl).toContain(`"type":"compaction"`);
      expect(jsonl).toContain(SUMMARY_MARKER);

      fixture.dispose();
      const reopened = await createFixture({
        cwd: fixture.cwd,
        sessionManager: SessionManager.open(fixture.file),
        responses: [fauxAssistantMessage('resumed response')],
      });
      try {
        const rebuilt = reopened.manager.buildSessionContext().messages;
        expect(rebuilt).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ role: 'compactionSummary', summary: result.summary }),
          ]),
        );
        await reopened.session.prompt('resume after reload', promptOptions);
        const resumedProviderContext = JSON.stringify(reopened.providerContexts[0]?.messages);
        expect(resumedProviderContext).toContain(SUMMARY_MARKER);
        expect(resumedProviderContext).toContain('seed response');
      } finally {
        reopened.dispose();
      }
    } finally {
      fixture.dispose();
    }
  });

  it('compacts at the configured threshold and settles without a conversational retry', async () => {
    const fixture = await createFixture({
      model: { contextWindow: 40_000, maxTokens: 20 },
      reserveTokens: 15_000,
      responses: [usageMessage('threshold response', 185), fauxAssistantMessage(SUMMARY_MARKER)],
    });
    const events: string[] = [];
    fixture.observations.pushTo = events;
    fixture.session.subscribe((event) => {
      if (event.type === 'agent_settled') events.push('agent_settled');
    });

    try {
      await fixture.session.prompt(`threshold context ${'y'.repeat(400)}`, promptOptions);

      expect(events).toEqual([
        'session_before_compact:threshold:false',
        'session_compact:threshold:false:false',
        'agent_settled',
      ]);
      expect(fixture.manager.getEntries().filter((entry) => entry.type === 'compaction')).toHaveLength(1);
      expect(fixture.providerContexts).toHaveLength(2);
      expect(fixture.providerContexts[1]?.systemPrompt).toContain('context summarization assistant');
    } finally {
      fixture.dispose();
    }
  });

  it('compacts a recognized overflow, retries automatically, and defers nextTurn until a later prompt', async () => {
    const fixture = await createFixture({
      responses: [
        usageMessage('seed before overflow', 24),
        overflowMessage(),
        fauxAssistantMessage(SUMMARY_MARKER),
        fauxAssistantMessage('overflow retry succeeded'),
        fauxAssistantMessage('next explicit prompt succeeded'),
      ],
      queueNextTurnMarker: true,
    });
    const events: string[] = [];
    fixture.observations.pushTo = events;
    fixture.session.subscribe((event) => {
      if (event.type === 'agent_settled') events.push('agent_settled');
    });

    try {
      await fixture.session.prompt('seed a complete turn before overflow', promptOptions);
      events.length = 0;
      await fixture.session.prompt(`overflow context ${'z'.repeat(400)}`, promptOptions);

      expect(events).toEqual([
        'session_before_compact:overflow:true',
        'session_compact:overflow:true:false',
        'agent_settled',
      ]);
      expect(fixture.providerContexts).toHaveLength(4);
      expect(JSON.stringify(fixture.providerContexts[3]?.messages)).toContain(SUMMARY_MARKER);
      expect(JSON.stringify(fixture.providerContexts[3]?.messages)).not.toContain(NEXT_TURN_MARKER);
      expect(await readFile(fixture.file, 'utf8')).not.toContain(NEXT_TURN_MARKER);

      await fixture.session.prompt('explicit prompt after overflow', promptOptions);

      expect(JSON.stringify(fixture.providerContexts[4]?.messages)).toContain(NEXT_TURN_MARKER);
      expect(await readFile(fixture.file, 'utf8')).toContain(NEXT_TURN_MARKER);
    } finally {
      fixture.dispose();
    }
  });
});

const promptOptions = { expandPromptTemplates: false, source: 'rpc' as const };

interface FixtureOptions {
  cwd?: string;
  sessionManager?: SessionManager;
  responses: AssistantMessage[];
  model?: { contextWindow: number; maxTokens: number };
  queueNextTurnMarker?: boolean;
  reserveTokens?: number;
}

async function createFixture(options: FixtureOptions) {
  const cwd = options.cwd ?? (await temporaryDirectory('brunch-pi-compaction-'));
  const agentDir = await temporaryDirectory('brunch-pi-compaction-agent-');
  const manager = options.sessionManager ?? SessionManager.create(cwd, join(cwd, '.brunch/sessions'));
  const file = manager.getSessionFile();
  if (!file) throw new Error('Expected a persisted Pi session');

  const observations: { pushTo: string[] } = { pushTo: [] };
  const extension: ExtensionFactory = (pi) => {
    pi.on('session_before_compact', (event) => {
      observations.pushTo.push(`session_before_compact:${event.reason}:${event.willRetry}`);
    });
    pi.on('session_compact', (event) => {
      observations.pushTo.push(`session_compact:${event.reason}:${event.willRetry}:${event.fromExtension}`);
      if (options.queueNextTurnMarker) {
        pi.sendMessage(
          { customType: 'characterization-next-turn', content: NEXT_TURN_MARKER, display: false },
          { deliverAs: 'nextTurn' },
        );
      }
    });
  };
  const settingsManager = SettingsManager.inMemory({
    quietStartup: true,
    compaction: { enabled: true, reserveTokens: options.reserveTokens ?? 20, keepRecentTokens: 1 },
    retry: { enabled: false },
  });
  const resourceLoader = new DefaultResourceLoader({
    cwd,
    agentDir,
    settingsManager,
    extensionFactories: [extension],
    systemPromptOverride: () => 'Characterize Pi compaction.',
  });
  await resourceLoader.reload();
  const harness = await createBrunchFauxHarness({
    cwd,
    responses: options.responses,
    ...(options.model ? { model: options.model } : {}),
    resourceLoader,
    settingsManager,
    sessionManager: manager,
  });
  return { ...harness, cwd, file, manager, observations };
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
  return {
    ...fauxAssistantMessage('', {
      stopReason: 'error',
      errorMessage: 'maximum context length exceeded',
    }),
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
  };
}

function onlyCompaction(manager: SessionManager): CompactionEntry {
  const entries = manager.getEntries().filter((entry) => entry.type === 'compaction');
  expect(entries).toHaveLength(1);
  return entries[0] as CompactionEntry;
}

async function temporaryDirectory(prefix: string): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), prefix));
  temporaryDirectories.push(path);
  return path;
}
