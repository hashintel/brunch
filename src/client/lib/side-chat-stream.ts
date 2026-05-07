import type { KnowledgeKind } from '@/shared/knowledge.js';

export type SideChatStreamEvent =
  | { type: 'text-delta'; delta: string }
  | { type: 'done' }
  | { type: 'error'; message: string };

export interface SideChatPriorTurn {
  role: 'user' | 'assistant';
  text: string;
}

export interface SideChatStreamRequest {
  specificationId: number;
  itemKind: KnowledgeKind;
  itemId: number;
  message: string;
  history?: readonly SideChatPriorTurn[];
  signal?: AbortSignal;
  fetch?: typeof fetch;
}

interface ParseResult {
  events: SideChatStreamEvent[];
  remainder: string;
}

const EVENT_DELIMITER = '\n\n';
const DATA_PREFIX = 'data: ';

export function parseSideChatSSEBuffer(buffer: string): ParseResult {
  const events: SideChatStreamEvent[] = [];
  let cursor = 0;

  while (cursor < buffer.length) {
    const delimiterIndex = buffer.indexOf(EVENT_DELIMITER, cursor);
    if (delimiterIndex === -1) {
      break;
    }

    const rawEvent = buffer.slice(cursor, delimiterIndex);
    cursor = delimiterIndex + EVENT_DELIMITER.length;

    if (!rawEvent.startsWith(DATA_PREFIX)) {
      continue;
    }
    const payload = rawEvent.slice(DATA_PREFIX.length);

    if (payload === '[DONE]') {
      events.push({ type: 'done' });
      continue;
    }

    try {
      const parsed = JSON.parse(payload) as { type?: unknown; delta?: unknown; message?: unknown };
      if (parsed.type === 'text-delta' && typeof parsed.delta === 'string') {
        events.push({ type: 'text-delta', delta: parsed.delta });
      } else if (parsed.type === 'error' && typeof parsed.message === 'string') {
        events.push({ type: 'error', message: parsed.message });
      }
    } catch {
      // Malformed line — skip it.
    }
  }

  return { events, remainder: buffer.slice(cursor) };
}

export async function streamSideChatResponse(
  request: SideChatStreamRequest,
  onChunk: (event: SideChatStreamEvent) => void,
): Promise<void> {
  const fetchImpl = request.fetch ?? globalThis.fetch;
  const response = await fetchImpl(`/api/specifications/${request.specificationId}/side-chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      itemKind: request.itemKind,
      itemId: request.itemId,
      message: request.message,
      ...(request.history && request.history.length > 0 ? { history: request.history } : {}),
    }),
    signal: request.signal,
  });

  if (!response.ok) {
    throw new Error(`Side-chat request failed with status ${response.status}`);
  }

  if (!response.body) {
    throw new Error('Side-chat response had no body to stream');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let completed = false;

  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const result = parseSideChatSSEBuffer(buffer);
      buffer = result.remainder;
      for (const event of result.events) {
        if (event.type === 'error') {
          throw new Error(event.message);
        }
        onChunk(event);
        if (event.type === 'done') {
          completed = true;
          return;
        }
      }
    }
    buffer += decoder.decode();
    const tail = parseSideChatSSEBuffer(buffer);
    for (const event of tail.events) {
      if (event.type === 'error') {
        throw new Error(event.message);
      }
      onChunk(event);
      if (event.type === 'done') {
        completed = true;
      }
    }
    if (!completed) {
      throw new Error('Side-chat stream ended before completion');
    }
  } finally {
    reader.releaseLock();
  }
}
