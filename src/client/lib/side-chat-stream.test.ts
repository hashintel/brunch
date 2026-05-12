import { describe, expect, it, vi } from 'vitest';

import {
  parseSideChatSSEBuffer,
  streamSideChatResponse,
  type SideChatStreamEvent,
  type SideChatStreamRequest,
} from './side-chat-stream.js';

describe('parseSideChatSSEBuffer', () => {
  it('parses text-delta events', () => {
    const buffer = 'data: {"type":"text-delta","delta":"hello"}\n\n';
    const { events, remainder } = parseSideChatSSEBuffer(buffer);
    expect(events).toEqual([{ type: 'text-delta', delta: 'hello' }]);
    expect(remainder).toBe('');
  });

  it('parses the [DONE] sentinel as a done event', () => {
    const buffer = 'data: [DONE]\n\n';
    const { events } = parseSideChatSSEBuffer(buffer);
    expect(events).toEqual([{ type: 'done' }]);
  });

  it('parses error events', () => {
    const buffer = 'data: {"type":"error","message":"rate limited"}\n\n';
    const { events } = parseSideChatSSEBuffer(buffer);
    expect(events).toEqual([{ type: 'error', message: 'rate limited' }]);
  });

  it('parses patch-proposal events with toolCallId, toolName, and input', () => {
    const buffer =
      'data: {"type":"patch-proposal","toolCallId":"call-1","toolName":"propose_edit","input":{"newContent":"updated text","newRationale":"why"}}\n\n';
    const { events } = parseSideChatSSEBuffer(buffer);
    expect(events).toEqual([
      {
        type: 'patch-proposal',
        toolCallId: 'call-1',
        toolName: 'propose_edit',
        input: { newContent: 'updated text', newRationale: 'why' },
      },
    ]);
  });

  it('parses patch-proposal events with no newRationale (only newContent)', () => {
    const buffer =
      'data: {"type":"patch-proposal","toolCallId":"call-2","toolName":"propose_edit","input":{"newContent":"only content"}}\n\n';
    const { events } = parseSideChatSSEBuffer(buffer);
    expect(events).toEqual([
      {
        type: 'patch-proposal',
        toolCallId: 'call-2',
        toolName: 'propose_edit',
        input: { newContent: 'only content' },
      },
    ]);
  });

  it('drops patch-proposal events for unknown toolNames', () => {
    const buffer =
      'data: {"type":"patch-proposal","toolCallId":"call-3","toolName":"unknown_tool","input":{}}\n\n';
    const { events } = parseSideChatSSEBuffer(buffer);
    expect(events).toEqual([]);
  });

  it('drops patch-proposal events with malformed input', () => {
    // input must be an object with a string newContent
    const buffer =
      'data: {"type":"patch-proposal","toolCallId":"call-4","toolName":"propose_edit","input":{}}\n\n';
    const { events } = parseSideChatSSEBuffer(buffer);
    expect(events).toEqual([]);
  });

  it('parses a mix of text-delta, patch-proposal, and done in one buffer', () => {
    const buffer = [
      'data: {"type":"text-delta","delta":"Sure, "}\n\n',
      'data: {"type":"text-delta","delta":"proposing edit. "}\n\n',
      'data: {"type":"patch-proposal","toolCallId":"call-9","toolName":"propose_edit","input":{"newContent":"shorter"}}\n\n',
      'data: [DONE]\n\n',
    ].join('');
    const { events } = parseSideChatSSEBuffer(buffer);
    expect(events).toHaveLength(4);
    expect(events[0]).toEqual({ type: 'text-delta', delta: 'Sure, ' });
    expect(events[1]).toEqual({ type: 'text-delta', delta: 'proposing edit. ' });
    expect(events[2]).toEqual({
      type: 'patch-proposal',
      toolCallId: 'call-9',
      toolName: 'propose_edit',
      input: { newContent: 'shorter' },
    });
    expect(events[3]).toEqual({ type: 'done' });
  });
});

describe('streamSideChatResponse — mode', () => {
  function makeMockFetch(sseBody: string) {
    return vi.fn<typeof fetch>(async () => {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(sseBody));
          controller.close();
        },
      });
      return new Response(stream, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      });
    });
  }

  function readBodyFromCall(fetchMock: ReturnType<typeof makeMockFetch>): Record<string, unknown> {
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init).toBeDefined();
    const body = init?.body;
    expect(typeof body).toBe('string');
    return JSON.parse(body as string) as Record<string, unknown>;
  }

  it('sends mode in the request body when mode is "edit"', async () => {
    const fetchMock = makeMockFetch('data: [DONE]\n\n');
    const request: SideChatStreamRequest = {
      specificationId: 1,
      itemKind: 'decision',
      itemId: 42,
      message: 'reword',
      mode: 'edit',
      fetch: fetchMock,
    };
    await streamSideChatResponse(request, () => {});
    expect(fetchMock).toHaveBeenCalledOnce();
    const body = readBodyFromCall(fetchMock);
    expect(body.mode).toBe('edit');
  });

  it('omits mode from the request body when mode is omitted (explore default)', async () => {
    const fetchMock = makeMockFetch('data: [DONE]\n\n');
    const request: SideChatStreamRequest = {
      specificationId: 1,
      itemKind: 'decision',
      itemId: 42,
      message: 'why?',
      fetch: fetchMock,
    };
    await streamSideChatResponse(request, () => {});
    const body = readBodyFromCall(fetchMock);
    expect(body.mode).toBeUndefined();
  });

  it('forwards patch-proposal events to the onChunk handler', async () => {
    const fetchMock = makeMockFetch(
      [
        'data: {"type":"text-delta","delta":"reply "}\n\n',
        'data: {"type":"patch-proposal","toolCallId":"c1","toolName":"propose_edit","input":{"newContent":"new text"}}\n\n',
        'data: [DONE]\n\n',
      ].join(''),
    );
    const events: SideChatStreamEvent[] = [];
    await streamSideChatResponse(
      {
        specificationId: 1,
        itemKind: 'decision',
        itemId: 42,
        message: 'reword',
        mode: 'edit',
        fetch: fetchMock,
      },
      (event) => events.push(event),
    );
    expect(events).toContainEqual({ type: 'text-delta', delta: 'reply ' });
    expect(events).toContainEqual({
      type: 'patch-proposal',
      toolCallId: 'c1',
      toolName: 'propose_edit',
      input: { newContent: 'new text' },
    });
    expect(events.at(-1)).toEqual({ type: 'done' });
  });
});
