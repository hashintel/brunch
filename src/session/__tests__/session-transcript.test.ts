import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { SessionManager } from '@earendil-works/pi-coding-agent';
import { describe, expect, it } from 'vitest';

import { assistantMessage, userMessage } from '../../probes/test-helpers.js';
import { renderAllHistoryDiagnosticTranscript, renderSessionTranscriptFile } from '../session-transcript.js';

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
          toolName: 'present_question',
          content: [
            {
              type: 'text',
              text: '## Which direction?\n\n### 1. Fast\n\n**Rationale:** validates the seam.',
            },
          ],
          details: {
            schema: 'brunch.structured_exchange.present',
            v: 1,
            exchange_id: 'turn-1',
            tool_meta: { curr: 'present_question', next: 'request_response' },
            response_kind: 'choice',
            display: { heading: 'Which direction?' },
            options: [{ id: 'fast', content: 'Fast', rationale: 'validates the seam.' }],
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
          toolName: 'request_response',
          content: [
            {
              type: 'text',
              text: '### Response\n\n- Fast\n\nComment:\n\n> Keep it deterministic.',
            },
          ],
          details: {
            schema: 'brunch.structured_exchange.request',
            v: 1,
            exchange_id: 'turn-1',
            tool_meta: { prev: 'present_question', curr: 'request_choice' },
            answered: {
              choice: { id: 'fast', label: 'Fast', kind: 'listed' },
              comment: 'Keep it deterministic.',
            },
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

    const transcript = renderAllHistoryDiagnosticTranscript(jsonl, {
      title: 'session.jsonl',
    });

    expect(transcript).toMatchInlineSnapshot(`
      "# Transcript — session.jsonl

      ## 1. User

      hello custom

      ## 2. Tool result: present_question

      ## Which direction?

      ### 1. Fast

      **Rationale:** validates the seam.

      ## 3. Tool result: request_response

      ### Response

      - Fast

      Comment:

      > Keep it deterministic.

      ## 4. Assistant

      I will inspect the workspace.
      "
    `);
  });

  it('renders the active branch by default and excludes an abandoned sibling', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-transcript-'));
    const manager = SessionManager.create(cwd, join(cwd, '.brunch', 'sessions'));
    const sharedId = manager.appendMessage(assistantMessage('Shared question'));
    manager.appendMessage(userMessage('Abandoned answer'));
    manager.branch(sharedId);
    manager.appendMessage(userMessage('Selected answer'));

    const transcript = await renderSessionTranscriptFile(manager.getSessionFile()!);

    expect(transcript).toContain('Shared question');
    expect(transcript).toContain('Selected answer');
    expect(transcript).not.toContain('Abandoned answer');
  });
});
