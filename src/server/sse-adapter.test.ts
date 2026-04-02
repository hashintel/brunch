import { describe, it, expect, beforeEach } from 'vitest';

import { createDomainAdapter, formatSSE } from './sse-adapter.js';

describe('formatSSE', () => {
  it('wraps a JSON object in SSE data line', () => {
    const result = formatSSE({ type: 'text-delta', id: 'text-1', delta: 'hi' });
    expect(result).toBe('data: {"type":"text-delta","id":"text-1","delta":"hi"}\n\n');
  });

  it('produces [DONE] terminator', () => {
    const result = formatSSE('[DONE]');
    expect(result).toBe('data: [DONE]\n\n');
  });
});

describe('createDomainAdapter — tool-call events', () => {
  it('translates tool-call-start to tool-call-streaming-start', () => {
    const { translate } = createDomainAdapter();
    translate({ type: 'stream-start', messageId: 'msg-1' });
    const events = translate({ type: 'tool-call-start', toolName: 'search', toolCallId: 'tc-1' });
    expect(events).toEqual([{ type: 'tool-call-streaming-start', id: 'tc-1', toolName: 'search' }]);
  });

  it('translates tool-call-delta with toolCallId', () => {
    const { translate } = createDomainAdapter();
    translate({ type: 'stream-start', messageId: 'msg-1' });
    translate({ type: 'tool-call-start', toolName: 'search', toolCallId: 'tc-1' });
    const events = translate({
      type: 'tool-call-delta',
      toolCallId: 'tc-1',
      delta: '{"q":"test"}',
    });
    expect(events).toEqual([{ type: 'tool-call-delta', id: 'tc-1', delta: '{"q":"test"}' }]);
  });

  it('translates tool-call-end with toolName and args', () => {
    const { translate } = createDomainAdapter();
    translate({ type: 'stream-start', messageId: 'msg-1' });
    translate({ type: 'tool-call-start', toolName: 'search', toolCallId: 'tc-1' });
    translate({ type: 'tool-call-delta', toolCallId: 'tc-1', delta: '{"q":"test"}' });
    const events = translate({ type: 'tool-call-end', toolCallId: 'tc-1', toolName: 'search' });
    expect(events).toEqual([{ type: 'tool-call', id: 'tc-1', toolName: 'search', args: '{"q":"test"}' }]);
  });

  it('translates observer-complete to data event', () => {
    const { translate } = createDomainAdapter();
    const events = translate({
      type: 'observer-complete',
      entityIds: { decisions: [1, 2], assumptions: [3] },
    } as any);
    expect(events).toEqual([
      {
        type: 'data',
        data: { type: 'data-observer-result', entityIds: { decisions: [1, 2], assumptions: [3] } },
      },
    ]);
  });

  it('translates observer-error to error event', () => {
    const { translate } = createDomainAdapter();
    const events = translate({ type: 'observer-error', message: 'extraction failed' } as any);
    expect(events).toEqual([{ type: 'error', errorText: 'Observer: extraction failed' }]);
  });

  it('translates agent-metrics to empty array (internal only)', () => {
    const { translate } = createDomainAdapter();
    const events = translate({
      type: 'agent-metrics',
      agent: 'observer',
      durationMs: 1500,
      durationApiMs: 1000,
      totalCostUsd: 0.001,
      inputTokens: 300,
      outputTokens: 100,
    } as any);
    expect(events).toEqual([]);
  });
});
