import { describe, expect, it } from 'vitest';

import type { ProjectedTranscriptContext } from '../../projections/session/transcript-context.js';
import { renderAllHistoryDiagnosticTranscript } from '../session-transcript.js';
import { formatTranscript } from '../transcript-markdown.js';

describe('debug transcript markdown', () => {
  it('renders projected transcript messages without non-text assistant blocks', () => {
    const context: ProjectedTranscriptContext = {
      messages: [
        { role: 'user', content: '  hello user  ', timestamp: 1 },
        {
          role: 'assistant',
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
          stopReason: 'stop',
          timestamp: 2,
          content: [
            { type: 'text', text: 'First assistant paragraph.' },
            { type: 'thinking', thinking: 'private reasoning' },
            { type: 'text', text: 'Second assistant paragraph.' },
          ],
        },
        {
          role: 'toolResult',
          toolName: 'request_response',
          toolCallId: 'call-1',
          content: [{ type: 'text', text: '### Response\n\nAccepted.' }],
          isError: false,
          timestamp: 3,
        },
      ],
    };

    expect(formatTranscript(context, { title: 'debug.jsonl' })).toMatchInlineSnapshot(`
      "# Transcript — debug.jsonl

      ## 1. User

      hello user

      ## 2. Assistant

      First assistant paragraph.

      Second assistant paragraph.

      ## 3. Tool result: request_response

      ### Response

      Accepted.
      "
    `);
  });

  it('reports malformed JSONL at its physical one-based line after blank separators', () => {
    const valid = { type: 'message', message: { role: 'user', content: 'hello', timestamp: 1 } };
    expect(() => renderAllHistoryDiagnosticTranscript(`${JSON.stringify(valid)}\n\t\n{broken}\n`)).toThrow(
      'Invalid JSONL at line 3',
    );
    expect(renderAllHistoryDiagnosticTranscript(`\n${JSON.stringify(valid)}\n`)).toContain('hello');
  });
});
