import { parseSideChatSSEBuffer, type SideChatStreamEvent } from './side-chat-stream.js';

/**
 * Posts a message to the secondary-chat streaming endpoint and forwards each
 * parsed SSE event to `onChunk`. Reuses `parseSideChatSSEBuffer` because the
 * server emits the identical envelope as the popover side-chat route
 * (text-delta / patch-proposal / done / error). The endpoint shape is the
 * only difference from `streamSideChatResponse`.
 */
export interface SecondaryChatStreamRequest {
  specificationId: number;
  chatId: number;
  message: string;
  signal?: AbortSignal;
  fetch?: typeof fetch;
}

export async function streamSecondaryChatMessage(
  request: SecondaryChatStreamRequest,
  onChunk: (event: SideChatStreamEvent) => void,
): Promise<void> {
  const fetchImpl = request.fetch ?? globalThis.fetch;
  const response = await fetchImpl(
    `/api/specifications/${request.specificationId}/secondary-chats/${request.chatId}/messages`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: request.message }),
      signal: request.signal,
    },
  );

  if (!response.ok) {
    throw new Error(`Secondary-chat request failed with status ${response.status}`);
  }
  if (!response.body) {
    throw new Error('Secondary-chat response had no body to stream');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let completed = false;

  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
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
      throw new Error('Secondary-chat stream ended before completion');
    }
  } finally {
    reader.releaseLock();
  }
}
