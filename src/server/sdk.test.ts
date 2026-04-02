import { describe, it, expect } from 'vitest';

import { createStreamTranslator, extractMetrics, type SdkResultMessage } from './sdk.js';

describe('createStreamTranslator', () => {
  it('translates message_start to stream-start', () => {
    const { translate } = createStreamTranslator();
    const events = translate({
      type: 'stream_event',
      event: { type: 'message_start', message: { id: 'msg-1' } },
    });
    expect(events).toEqual([{ type: 'stream-start', messageId: 'msg-1' }]);
  });

  it('translates thinking_delta to thinking', () => {
    const { translate } = createStreamTranslator();
    const events = translate({
      type: 'stream_event',
      event: { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: 'hmm' } },
    });
    expect(events).toEqual([{ type: 'thinking', delta: 'hmm' }]);
  });

  it('translates text_delta to text-delta', () => {
    const { translate } = createStreamTranslator();
    const events = translate({
      type: 'stream_event',
      event: { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: 'hello' } },
    });
    expect(events).toEqual([{ type: 'text-delta', delta: 'hello' }]);
  });

  it('translates tool_use lifecycle (start → delta → stop)', () => {
    const { translate } = createStreamTranslator();

    const start = translate({
      type: 'stream_event',
      event: {
        type: 'content_block_start',
        index: 0,
        content_block: { type: 'tool_use', name: 'ask_question', id: 'toolu_01' },
      },
    });
    expect(start).toEqual([{ type: 'tool-call-start', toolName: 'ask_question', toolCallId: 'toolu_01' }]);

    const delta = translate({
      type: 'stream_event',
      event: {
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'input_json_delta', partial_json: '{"q":"hi"}' },
      },
    });
    expect(delta).toEqual([{ type: 'tool-call-delta', toolCallId: 'toolu_01', delta: '{"q":"hi"}' }]);

    const stop = translate({
      type: 'stream_event',
      event: { type: 'content_block_stop', index: 0 },
    });
    expect(stop).toEqual([{ type: 'tool-call-end', toolCallId: 'toolu_01', toolName: 'ask_question' }]);
  });

  it('translates message_stop to stream-end', () => {
    const { translate } = createStreamTranslator();
    const events = translate({
      type: 'stream_event',
      event: { type: 'message_stop' },
    });
    expect(events).toEqual([{ type: 'stream-end' }]);
  });

  it('ignores non-stream_event messages', () => {
    const { translate } = createStreamTranslator();
    expect(translate({ type: 'result', subtype: 'success' })).toEqual([]);
    expect(translate({ type: 'system' })).toEqual([]);
  });
});

describe('extractMetrics', () => {
  it('produces agent-metrics DomainEvent from ResultMessage', () => {
    const result: SdkResultMessage = {
      type: 'result',
      subtype: 'success',
      duration_ms: 1200,
      duration_api_ms: 800,
      total_cost_usd: 0.003,
      is_error: false,
      num_turns: 1,
      usage: { input_tokens: 500, output_tokens: 200 },
      result: 'ok',
    };
    const event = extractMetrics('observer', result);
    expect(event).toEqual({
      type: 'agent-metrics',
      agent: 'observer',
      durationMs: 1200,
      durationApiMs: 800,
      totalCostUsd: 0.003,
      inputTokens: 500,
      outputTokens: 200,
    });
  });
});
