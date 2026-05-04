import { describe, expect, it } from 'vitest';

import {
  parseSideChatSSEBuffer,
  streamSideChatResponse,
  type SideChatStreamEvent,
} from '../side-chat-stream.js';

function toReadableStream(chunks: readonly string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}

describe('parseSideChatSSEBuffer', () => {
  it('returns no events and the full buffer as remainder when no complete event has arrived', () => {
    const result = parseSideChatSSEBuffer('data: {"type":"text-delta","delta":"par');
    expect(result.events).toEqual([]);
    expect(result.remainder).toBe('data: {"type":"text-delta","delta":"par');
  });

  it('parses a single text-delta event and consumes its bytes', () => {
    const result = parseSideChatSSEBuffer('data: {"type":"text-delta","delta":"hello"}\n\n');
    expect(result.events).toEqual([{ type: 'text-delta', delta: 'hello' }]);
    expect(result.remainder).toBe('');
  });

  it('parses multiple text-delta events from one buffer', () => {
    const buffer =
      'data: {"type":"text-delta","delta":"hello "}\n\n' + 'data: {"type":"text-delta","delta":"world"}\n\n';
    const result = parseSideChatSSEBuffer(buffer);
    expect(result.events).toEqual([
      { type: 'text-delta', delta: 'hello ' },
      { type: 'text-delta', delta: 'world' },
    ]);
    expect(result.remainder).toBe('');
  });

  it('parses [DONE] as a done event', () => {
    const result = parseSideChatSSEBuffer('data: [DONE]\n\n');
    expect(result.events).toEqual([{ type: 'done' }]);
    expect(result.remainder).toBe('');
  });

  it('returns complete events plus the partial trailing remainder', () => {
    const buffer =
      'data: {"type":"text-delta","delta":"first"}\n\n' + 'data: {"type":"text-delta","delta":"sec';
    const result = parseSideChatSSEBuffer(buffer);
    expect(result.events).toEqual([{ type: 'text-delta', delta: 'first' }]);
    expect(result.remainder).toBe('data: {"type":"text-delta","delta":"sec');
  });

  it('skips malformed JSON lines without throwing', () => {
    const buffer = 'data: not-json\n\n' + 'data: {"type":"text-delta","delta":"recovered"}\n\n';
    const result = parseSideChatSSEBuffer(buffer);
    expect(result.events).toEqual([{ type: 'text-delta', delta: 'recovered' }]);
    expect(result.remainder).toBe('');
  });
});

describe('streamSideChatResponse', () => {
  it('POSTs to /api/specifications/:id/side-chat with the typed body and content-type', async () => {
    const fetchSpy = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      capturedInput = input;
      capturedInit = init;
      return Promise.resolve(
        new Response(toReadableStream(['data: [DONE]\n\n']), {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        }),
      );
    };
    let capturedInput: RequestInfo | URL | undefined;
    let capturedInit: RequestInit | undefined;

    await streamSideChatResponse(
      {
        specificationId: 42,
        itemKind: 'decision',
        itemId: 7,
        message: 'Why SQLite?',
        fetch: fetchSpy,
      },
      () => {},
    );

    expect(capturedInput).toBe('/api/specifications/42/side-chat');
    expect(capturedInit?.method).toBe('POST');
    const headers = new Headers(capturedInit?.headers);
    expect(headers.get('Content-Type')).toMatch(/application\/json/);
    expect(typeof capturedInit?.body).toBe('string');
    expect(JSON.parse(capturedInit?.body as string)).toEqual({
      itemKind: 'decision',
      itemId: 7,
      message: 'Why SQLite?',
    });
  });

  it('includes the history array in the request body when supplied', async () => {
    let capturedInit: RequestInit | undefined;
    await streamSideChatResponse(
      {
        specificationId: 7,
        itemKind: 'decision',
        itemId: 1,
        message: 'Follow-up?',
        history: [
          { role: 'user', text: 'First message' },
          { role: 'assistant', text: 'First reply' },
        ],
        fetch: (_input, init) => {
          capturedInit = init;
          return Promise.resolve(
            new Response(toReadableStream(['data: [DONE]\n\n']), {
              status: 200,
              headers: { 'Content-Type': 'text/event-stream' },
            }),
          );
        },
      },
      () => {},
    );

    expect(JSON.parse(capturedInit?.body as string)).toEqual({
      itemKind: 'decision',
      itemId: 1,
      message: 'Follow-up?',
      history: [
        { role: 'user', text: 'First message' },
        { role: 'assistant', text: 'First reply' },
      ],
    });
  });

  it('omits history from the request body when empty or absent', async () => {
    let capturedInit: RequestInit | undefined;
    await streamSideChatResponse(
      {
        specificationId: 7,
        itemKind: 'decision',
        itemId: 1,
        message: 'Hi',
        history: [],
        fetch: (_input, init) => {
          capturedInit = init;
          return Promise.resolve(
            new Response(toReadableStream(['data: [DONE]\n\n']), {
              status: 200,
              headers: { 'Content-Type': 'text/event-stream' },
            }),
          );
        },
      },
      () => {},
    );

    const body = JSON.parse(capturedInit?.body as string);
    expect(body).not.toHaveProperty('history');
  });

  it('forwards each parsed event through the onChunk callback in order', async () => {
    const events: SideChatStreamEvent[] = [];
    await streamSideChatResponse(
      {
        specificationId: 1,
        itemKind: 'decision',
        itemId: 1,
        message: 'why?',
        fetch: () =>
          Promise.resolve(
            new Response(
              toReadableStream([
                'data: {"type":"text-delta","delta":"hello "}\n\n',
                'data: {"type":"text-delta","delta":"world"}\n\n',
                'data: [DONE]\n\n',
              ]),
            ),
          ),
      },
      (event) => events.push(event),
    );

    expect(events).toEqual([
      { type: 'text-delta', delta: 'hello ' },
      { type: 'text-delta', delta: 'world' },
      { type: 'done' },
    ]);
  });

  it('reassembles events that span multiple read chunks', async () => {
    const events: SideChatStreamEvent[] = [];
    await streamSideChatResponse(
      {
        specificationId: 1,
        itemKind: 'decision',
        itemId: 1,
        message: 'why?',
        fetch: () =>
          Promise.resolve(
            new Response(
              toReadableStream(['data: {"type":"text-delta","delt', 'a":"hello"}\n\ndata: [DONE]\n\n']),
            ),
          ),
      },
      (event) => events.push(event),
    );

    expect(events).toEqual([{ type: 'text-delta', delta: 'hello' }, { type: 'done' }]);
  });

  it('throws when the response has no body to stream', async () => {
    await expect(
      streamSideChatResponse(
        {
          specificationId: 1,
          itemKind: 'decision',
          itemId: 1,
          message: 'why?',
          fetch: () =>
            Promise.resolve(
              new Response(null, {
                status: 200,
                headers: { 'Content-Type': 'text/event-stream' },
              }),
            ),
        },
        () => {},
      ),
    ).rejects.toThrow();
  });

  it('throws when the response is not OK', async () => {
    await expect(
      streamSideChatResponse(
        {
          specificationId: 99999,
          itemKind: 'decision',
          itemId: 1,
          message: 'why?',
          fetch: () =>
            Promise.resolve(
              new Response(JSON.stringify({ error: 'Specification not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
              }),
            ),
        },
        () => {},
      ),
    ).rejects.toThrow();
  });
});
