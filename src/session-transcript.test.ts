import { describe, expect, it } from 'vitest';

import { renderSessionTranscript } from './session-transcript.js';

function line(value: unknown): string {
  return JSON.stringify(value);
}

describe('session transcript renderer', () => {
  it('renders structured-exchange tuple JSONL as a readable transcript', () => {
    const jsonl = [
      line({ type: 'session', id: 'session-1', cwd: '/tmp/brunch' }),
      line({
        id: 'binding-1',
        type: 'custom',
        customType: 'brunch.session_binding',
        data: { specId: 'spec-1', specTitle: 'Demo spec' },
      }),
      line({
        id: 'generic-tool-1',
        type: 'message',
        message: {
          role: 'toolResult',
          toolName: 'read',
          content: [{ type: 'text', text: 'Generic file contents' }],
          details: { path: 'notes.txt' },
        },
      }),
      line({
        id: 'present-1',
        type: 'message',
        message: {
          role: 'toolResult',
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
        },
      }),
      line({
        id: 'request-1',
        type: 'message',
        message: {
          role: 'toolResult',
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
        },
      }),
    ].join('\n');

    const transcript = renderSessionTranscript(jsonl, {
      title: 'session.jsonl',
    });

    expect(transcript).toContain('# Transcript — session.jsonl');
    expect(transcript).toContain('## Session');
    expect(transcript).toContain('- session: session-1');
    expect(transcript).toContain('## Session binding');
    expect(transcript).toContain('## Exchange turn-1 — prompt (present_options → request_choice)');
    expect(transcript).toContain('**Rationale:** validates the seam.');
    expect(transcript).toContain('## Exchange turn-1 — response (request_choice, answered)');
    expect(transcript).toContain('Keep it deterministic.');
    expect(transcript).not.toContain('## Tool result: read');
    expect(transcript).not.toContain('Generic file contents');
  });
});
