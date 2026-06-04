import { describe, expect, it } from 'vitest';

import { renderSessionTranscript } from './session-transcript.js';

function line(value: unknown): string {
  return JSON.stringify(value);
}

describe('session transcript renderer', () => {
  it('derives Pi context first, then renders only markdown-bearing message content', () => {
    const jsonl = [
      line({ type: 'session', id: 'session-1', cwd: '/tmp/brunch' }),
      line({
        id: 'binding-1',
        type: 'custom',
        customType: 'brunch.session_binding',
        parentId: null,
        timestamp: '2026-06-04T00:00:00.000Z',
        data: { schemaVersion: 1, specId: 1 },
      }),
      line({
        id: 'custom-message-1',
        type: 'custom_message',
        parentId: 'binding-1',
        timestamp: '2026-06-04T00:00:01.000Z',
        customType: 'brunch.note',
        content: 'hello custom',
        display: true,
        details: { hidden: true },
      }),
      line({
        id: 'generic-tool-1',
        type: 'message',
        parentId: 'custom-message-1',
        timestamp: '2026-06-04T00:00:02.000Z',
        message: {
          role: 'toolResult',
          toolCallId: 'read-call-1',
          toolName: 'read',
          content: [{ type: 'text', text: 'Generic file contents' }],
          details: { path: 'notes.txt' },
          isError: false,
          timestamp: 2,
        },
      }),
      line({
        id: 'present-1',
        type: 'message',
        parentId: 'generic-tool-1',
        timestamp: '2026-06-04T00:00:03.000Z',
        message: {
          role: 'toolResult',
          toolCallId: 'present-call-1',
          toolName: 'present_options',
          content: [
            {
              type: 'text',
              text: '## Which direction?\n\n### 1. Fast\n\n**Rationale:** validates the seam.',
            },
          ],
          details: {
            schema: 'brunch.structured_exchange.present',
            schemaVersion: 1,
            exchangeId: 'turn-1',
            presentTool: 'present_options',
            kind: 'options',
            status: 'presented',
            expectedRequest: { tool: 'request_choice', required: true },
            createdAtToolCallId: 'present-call-1',
          },
          isError: false,
          timestamp: 3,
        },
      }),
      line({
        id: 'request-1',
        type: 'message',
        parentId: 'present-1',
        timestamp: '2026-06-04T00:00:04.000Z',
        message: {
          role: 'toolResult',
          toolCallId: 'request-call-1',
          toolName: 'request_choice',
          content: [
            {
              type: 'text',
              text: '### Response\n\n- Fast\n\nComment:\n\n> Keep it deterministic.',
            },
          ],
          details: {
            schema: 'brunch.structured_exchange.request',
            schemaVersion: 1,
            exchangeId: 'turn-1',
            requestTool: 'request_choice',
            status: 'answered',
            respondsTo: {
              exchangeId: 'turn-1',
              presentTool: 'present_options',
            },
            choice: { id: 'fast', label: 'Fast' },
            comment: 'Keep it deterministic.',
            createdAtToolCallId: 'request-call-1',
          },
          isError: false,
          timestamp: 4,
        },
      }),
      line({
        id: 'assistant-1',
        type: 'message',
        parentId: 'request-1',
        timestamp: '2026-06-04T00:00:05.000Z',
        message: {
          role: 'assistant',
          content: [
            { type: 'text', text: 'I will inspect the workspace.' },
            { type: 'thinking', thinking: 'private chain of thought' },
            { type: 'toolCall', id: 'tool-call-1', name: 'read', arguments: { path: 'notes.txt' } },
          ],
          api: 'openai-completions',
          provider: 'openai',
          model: 'test-model',
          usage: {
            input: 0,
            output: 0,
            cacheRead: 0,
            cacheWrite: 0,
            totalTokens: 0,
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
          },
          stopReason: 'toolUse',
          timestamp: 5,
        },
      }),
    ].join('\n');

    const transcript = renderSessionTranscript(jsonl, {
      title: 'session.jsonl',
    });

    expect(transcript).toContain('# Transcript — session.jsonl');
    expect(transcript).toContain('## 1. User');
    expect(transcript).toContain('hello custom');
    expect(transcript).toContain('## 2. Tool result: read');
    expect(transcript).toContain('Generic file contents');
    expect(transcript).toContain('## 3. Tool result: present_options');
    expect(transcript).toContain('**Rationale:** validates the seam.');
    expect(transcript).toContain('## 4. Tool result: request_choice');
    expect(transcript).toContain('Keep it deterministic.');
    expect(transcript).toContain('## 5. Assistant');
    expect(transcript).toContain('I will inspect the workspace.');
    expect(transcript).not.toContain('Session binding');
    expect(transcript).not.toContain('turn-1');
    expect(transcript).not.toContain('private chain of thought');
    expect(transcript).not.toContain('Tool call: read');
    expect(transcript).not.toContain('"path": "notes.txt"');
  });
});
