import type { Message } from '@earendil-works/pi-ai';
import type { FileEntry } from '@earendil-works/pi-coding-agent';
import { describe, expect, it } from 'vitest';

import { assistantMessage } from '../../../probes/test-helpers.js';
import { projectTranscriptContext } from '../transcript-context.js';

function toolResultEntry(id: string, parentId: string, toolName: string, text: string, timestamp: number) {
  return {
    id,
    type: 'message',
    parentId,
    timestamp: `2026-06-04T00:00:0${timestamp}.000Z`,
    message: {
      role: 'toolResult' as const,
      toolCallId: `${toolName}-call-${timestamp}`,
      toolName,
      content: [{ type: 'text' as const, text }],
      details: {},
      isError: false,
      timestamp,
    },
  };
}

function primaryText(message: Message): string | undefined {
  if (typeof message.content === 'string') {
    return message.content;
  }
  return message.content.find((block) => block.type === 'text')?.text;
}

describe('transcript-context projection', () => {
  it('keeps every markdown-bearing message in order and drops non-renderable entries', () => {
    const entries = [
      { type: 'session', id: 'session-1', cwd: '/tmp/brunch' },
      {
        id: 'binding-1',
        type: 'custom',
        customType: 'brunch.session_binding',
        parentId: null,
        timestamp: '2026-06-04T00:00:00.000Z',
        data: { schemaVersion: 1, specId: 1 },
      },
      {
        id: 'custom-message-1',
        type: 'custom_message',
        parentId: 'binding-1',
        timestamp: '2026-06-04T00:00:01.000Z',
        customType: 'brunch.note',
        content: 'hello custom',
        display: true,
        details: { hidden: true },
      },
      toolResultEntry('generic-tool-1', 'custom-message-1', 'read', 'Generic file contents', 2),
      toolResultEntry(
        'present-1',
        'generic-tool-1',
        'present_options',
        '## Which direction?\n\n### 1. Fast\n\n**Rationale:** validates the seam.',
        3,
      ),
      toolResultEntry(
        'request-1',
        'present-1',
        'request_choice',
        '### Response\n\n- Fast\n\nComment:\n\n> Keep it deterministic.',
        4,
      ),
      {
        id: 'assistant-1',
        type: 'message',
        parentId: 'request-1',
        timestamp: '2026-06-04T00:00:05.000Z',
        message: assistantMessage(
          [
            { type: 'text', text: 'I will inspect the workspace.' },
            { type: 'thinking', thinking: 'private chain of thought' },
            { type: 'toolCall', id: 'tool-call-1', name: 'read', arguments: { path: 'notes.txt' } },
          ],
          5,
        ),
      },
      {
        id: 'assistant-2',
        type: 'message',
        parentId: 'assistant-1',
        timestamp: '2026-06-04T00:00:06.000Z',
        message: assistantMessage(
          [
            { type: 'thinking', thinking: 'private chain of thought' },
            { type: 'toolCall', id: 'tool-call-2', name: 'read', arguments: { path: 'notes.txt' } },
          ],
          6,
        ),
      },
    ];

    const projected = projectTranscriptContext(entries as FileEntry[]);

    expect(projected.messages).toHaveLength(5);
    expect(projected.messages.map((message) => message.role)).toEqual([
      'user',
      'toolResult',
      'toolResult',
      'toolResult',
      'assistant',
    ]);
    expect(projected.messages.map(primaryText)).toEqual([
      'hello custom',
      'Generic file contents',
      '## Which direction?\n\n### 1. Fast\n\n**Rationale:** validates the seam.',
      '### Response\n\n- Fast\n\nComment:\n\n> Keep it deterministic.',
      'I will inspect the workspace.',
    ]);
  });
});
