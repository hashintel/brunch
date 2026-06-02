import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  SessionManager,
  type CustomEntry,
  type CustomMessageEntry,
  type SessionEntry,
  type SessionMessageEntry,
} from '@earendil-works/pi-coding-agent';
import { describe, expect, it } from 'vitest';

import { assistantMessage, userMessage } from './test-helpers.js';

interface PersistedSessionFixture {
  file: string;
  manager: SessionManager;
}

describe('Pi JSONL transcript viability', () => {
  it('jsonl raw user assistant payload survival', async () => {
    const { file, manager } = createPersistedSession();
    const userContent: (
      | import('@earendil-works/pi-ai').TextContent
      | import('@earendil-works/pi-ai').ImageContent
    )[] = [
      { type: 'text', text: 'Describe this image' },
      {
        type: 'image',
        data: 'data:image/png;base64,ZmFrZQ==',
        mimeType: 'image/png',
      },
    ];
    const assistantContent: import('@earendil-works/pi-ai').TextContent[] = [
      { type: 'text', text: 'Here is a structured answer.' },
    ];

    manager.appendMessage(userMessage(userContent));
    manager.appendMessage(assistantMessage(assistantContent));

    const reloaded = SessionManager.open(file);
    const messages = reloaded.getEntries().filter(isMessageEntry);

    expect(messages.map((entry) => entry.message)).toMatchObject([
      { role: 'user', content: userContent },
      { role: 'assistant', content: assistantContent },
    ]);
  });

  it('jsonl custom entry survival matrix', async () => {
    const { file, manager } = createPersistedSession();
    const customEntries = [
      ['brunch.lens_switch', { lens: 'verification-design', reason: 'test' }],
      ['brunch.mention', { entityId: 'node-1', snapshottedLsn: 7, title: 'Known node' }],
      ['brunch.mention_staleness_hint', { entityId: 'node-1', seenLsn: 7, currentLsn: 9 }],
      [
        'brunch.continuity',
        {
          lastSeenLsn: 9,
          interestSet: ['node-1', 'node-2'],
          compactionAnchorIds: ['anchor-1'],
        },
      ],
    ] as const;

    for (const [customType, data] of customEntries) {
      manager.appendCustomEntry(customType, data);
    }
    flushPreAssistantEntries(manager);

    const reloaded = SessionManager.open(file);
    const customByType = new Map(
      reloaded
        .getEntries()
        .filter(isCustomEntry)
        .map((entry) => [entry.customType, entry.data]),
    );

    for (const [customType, data] of customEntries) {
      expect(customByType.get(customType)).toEqual(data);
    }
  });

  it('jsonl custom message survival matrix', async () => {
    const { file, manager } = createPersistedSession();
    const worldUpdate = {
      changedSinceLsn: 11,
      items: [{ id: 'node-1', lsn: 12, title: 'Updated node' }],
    };
    const sideTaskResult = {
      taskId: 'side-task-1',
      status: 'succeeded',
      summary: 'Found related risk.',
    };
    const structuredPrompt = {
      promptId: 'prompt-1',
      kind: 'radio',
      choices: ['A', 'B'],
    };

    manager.appendCustomMessageEntry(
      'worldUpdate',
      'Node node-1 changed since your last turn.',
      true,
      worldUpdate,
    );
    manager.appendCustomMessageEntry(
      'brunch.side_task_result',
      [{ type: 'text', text: 'Side task result: Found related risk.' }],
      false,
      sideTaskResult,
    );
    manager.appendCustomMessageEntry(
      'brunch.elicitation_prompt',
      'Choose the better framing.',
      true,
      structuredPrompt,
    );
    flushPreAssistantEntries(manager);

    const reloaded = SessionManager.open(file);
    const customMessages = reloaded.getEntries().filter(isCustomMessageEntry);

    expect(customMessages).toEqual([
      expect.objectContaining({
        customType: 'worldUpdate',
        content: 'Node node-1 changed since your last turn.',
        display: true,
        details: worldUpdate,
      }),
      expect.objectContaining({
        customType: 'brunch.side_task_result',
        content: [{ type: 'text', text: 'Side task result: Found related risk.' }],
        display: false,
        details: sideTaskResult,
      }),
      expect.objectContaining({
        customType: 'brunch.elicitation_prompt',
        content: 'Choose the better framing.',
        display: true,
        details: structuredPrompt,
      }),
    ]);
  });

  it('jsonl custom messages re-enter pi context', async () => {
    const { file, manager } = createPersistedSession();
    manager.appendCustomMessageEntry('worldUpdate', 'World update: node-1 changed.', true, {
      changedSinceLsn: 3,
    });
    manager.appendCustomEntry('brunch.lens_switch', { lens: 'observer' });
    manager.appendCustomMessageEntry('brunch.side_task_result', 'Side task completed.', false, {
      taskId: 'task-1',
    });
    flushPreAssistantEntries(manager);

    const contextMessages = SessionManager.open(file)
      .buildSessionContext()
      .messages.filter((message) => message.role === 'custom');

    expect(contextMessages).toEqual([
      expect.objectContaining({
        role: 'custom',
        customType: 'worldUpdate',
        content: 'World update: node-1 changed.',
      }),
      expect.objectContaining({
        role: 'custom',
        customType: 'brunch.side_task_result',
        content: 'Side task completed.',
      }),
    ]);
  });

  it('jsonl continuity metadata survival', async () => {
    const { file, manager } = createPersistedSession();
    const anchorEntryId = manager.appendMessage(assistantMessage('Anchor before compaction'));
    const continuity = {
      lastSeenLsn: 42,
      interestSet: ['node-a', 'node-b'],
      compactionAnchors: [{ entryId: anchorEntryId, graphNodeId: 'node-a' }],
    };

    manager.appendCustomEntry('brunch.continuity', continuity);
    manager.appendCompaction('Compacted summary', anchorEntryId, 1_234, {
      brunch: { continuity },
    });
    flushPreAssistantEntries(manager);

    const reloaded = SessionManager.open(file);
    const customContinuity = reloaded
      .getEntries()
      .filter(isCustomEntry)
      .find((entry) => entry.customType === 'brunch.continuity');
    const compaction = reloaded.getEntries().find((entry) => entry.type === 'compaction');

    expect(customContinuity?.data).toEqual(continuity);
    expect(compaction).toMatchObject({
      details: { brunch: { continuity } },
    });
  });

  it('jsonl structured elicitation survival', async () => {
    const { file, manager } = createPersistedSession();
    const promptDetails = {
      promptId: 'prompt-1',
      surface: 'checkbox',
      choices: ['fast', 'safe'],
    };
    const responseData = {
      promptId: 'prompt-1',
      selected: ['safe'],
      freeform: 'Prefer safety.',
    };

    manager.appendCustomMessageEntry('brunch.elicitation_prompt', 'Select priorities.', true, promptDetails);
    manager.appendMessage(userMessage('I choose safety.'));
    manager.appendCustomEntry('brunch.elicitation_response', responseData);
    flushPreAssistantEntries(manager);

    const reloadedEntries = SessionManager.open(file).getEntries();
    const structuredPrompt = reloadedEntries.find(
      (entry) => isCustomMessageEntry(entry) && entry.customType === 'brunch.elicitation_prompt',
    );
    const ordinaryUser = reloadedEntries.find(
      (entry) => isMessageEntry(entry) && entry.message.role === 'user',
    );
    const structuredResponse = reloadedEntries.find(
      (entry) => isCustomEntry(entry) && entry.customType === 'brunch.elicitation_response',
    );

    expect(structuredPrompt).toMatchObject({
      type: 'custom_message',
      details: promptDetails,
    });
    expect(ordinaryUser).toMatchObject({
      type: 'message',
      message: userMessage('I choose safety.'),
    });
    expect(structuredResponse).toMatchObject({
      type: 'custom',
      data: responseData,
    });
  });
});

function createPersistedSession(): PersistedSessionFixture {
  const cwd = mkdtempSync(join(tmpdir(), 'brunch-jsonl-'));
  const manager = SessionManager.create(cwd, join(cwd, '.brunch/sessions'));
  const file = manager.getSessionFile();
  if (!file) {
    throw new Error('Expected persisted session file');
  }
  return { file, manager };
}

function flushPreAssistantEntries(manager: SessionManager): void {
  manager.appendMessage(assistantMessage('Persistence sentinel'));
}

function isMessageEntry(entry: SessionEntry): entry is SessionMessageEntry {
  return entry.type === 'message';
}

function isCustomEntry(entry: SessionEntry): entry is CustomEntry {
  return entry.type === 'custom';
}

function isCustomMessageEntry(entry: SessionEntry): entry is CustomMessageEntry {
  return entry.type === 'custom_message';
}
