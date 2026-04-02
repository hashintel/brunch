/**
 * SSE Adapter — translates DomainEvents into AI SDK UI Message Stream protocol.
 *
 * createDomainAdapter() — DomainEvent → AIEvent (used by Express adapter).
 * formatSSE() — standalone pure function for SSE wire format.
 */

import type { DomainEvent } from './core.js';

/** AI SDK protocol event types we emit */
export type AIEvent =
  | { type: 'start'; messageId: string }
  | { type: 'text-start'; id: string }
  | { type: 'text-delta'; id: string; delta: string }
  | { type: 'text-end'; id: string }
  | { type: 'reasoning-start'; id: string }
  | { type: 'reasoning-delta'; id: string; delta: string }
  | { type: 'reasoning-end'; id: string }
  | { type: 'tool-call-streaming-start'; id: string; toolName: string }
  | { type: 'tool-call-delta'; id: string; delta: string }
  | { type: 'tool-call'; id: string; toolName: string; args: string }
  | { type: 'finish-step' }
  | { type: 'finish'; finishReason: string }
  | { type: 'error'; errorText: string }
  | { type: 'data'; data: unknown };

/**
 * Format a payload as an SSE data line.
 */
export function formatSSE(payload: AIEvent | '[DONE]'): string {
  if (payload === '[DONE]') return 'data: [DONE]\n\n';
  return `data: ${JSON.stringify(payload)}\n\n`;
}

/**
 * Create a per-request DomainEvent → AIEvent adapter.
 * Manages block lifecycle (start/end) for the SSE protocol.
 */
export function createDomainAdapter() {
  let blockIndex = 0;
  let currentBlock: 'thinking' | 'text' | 'tool-call' | null = null;
  let currentToolArgsJson = '';

  function translate(event: DomainEvent): AIEvent[] {
    switch (event.type) {
      case 'stream-start':
        return [{ type: 'start', messageId: event.messageId }];

      case 'thinking': {
        if (currentBlock !== 'thinking') {
          currentBlock = 'thinking';
          return [
            { type: 'reasoning-start', id: `reasoning-${blockIndex}` },
            { type: 'reasoning-delta', id: `reasoning-${blockIndex}`, delta: event.delta },
          ];
        }
        return [{ type: 'reasoning-delta', id: `reasoning-${blockIndex}`, delta: event.delta }];
      }

      case 'text-delta': {
        const events: AIEvent[] = [];
        if (currentBlock === 'thinking') {
          events.push({ type: 'reasoning-end', id: `reasoning-${blockIndex}` });
          blockIndex++;
        }
        if (currentBlock !== 'text') {
          currentBlock = 'text';
          events.push({ type: 'text-start', id: `text-${blockIndex}` });
        }
        events.push({ type: 'text-delta', id: `text-${blockIndex}`, delta: event.delta });
        return events;
      }

      case 'tool-call-start': {
        const events: AIEvent[] = [];
        if (currentBlock === 'thinking') {
          events.push({ type: 'reasoning-end', id: `reasoning-${blockIndex}` });
          blockIndex++;
        } else if (currentBlock === 'text') {
          events.push({ type: 'text-end', id: `text-${blockIndex}` });
          blockIndex++;
        }
        currentBlock = 'tool-call';
        currentToolArgsJson = '';
        events.push({
          type: 'tool-call-streaming-start',
          id: event.toolCallId,
          toolName: event.toolName,
        });
        return events;
      }

      case 'tool-call-delta': {
        currentToolArgsJson += event.delta;
        return [{ type: 'tool-call-delta', id: event.toolCallId, delta: event.delta }];
      }

      case 'tool-call-end': {
        currentBlock = null;
        const toolCallEvent: AIEvent = {
          type: 'tool-call',
          id: event.toolCallId,
          toolName: event.toolName,
          args: currentToolArgsJson,
        };
        currentToolArgsJson = '';
        blockIndex++;
        return [toolCallEvent];
      }

      case 'stream-end': {
        // Close any open blocks; finish-step + finish are emitted by the Express adapter
        // after all events (including observer) have been processed.
        const events: AIEvent[] = [];
        if (currentBlock === 'thinking') {
          events.push({ type: 'reasoning-end', id: `reasoning-${blockIndex}` });
        } else if (currentBlock === 'text') {
          events.push({ type: 'text-end', id: `text-${blockIndex}` });
        }
        return events;
      }

      case 'error':
        return [{ type: 'error', errorText: event.message }];

      case 'turn-created':
        return []; // No SSE representation

      case 'observer-complete':
        return [
          {
            type: 'data',
            data: {
              type: 'data-observer-result',
              entityIds: event.entityIds,
            },
          },
        ];

      case 'observer-error':
        return [{ type: 'error', errorText: `Observer: ${event.message}` }];

      case 'agent-metrics':
        return []; // Internal only — not sent to client

      default:
        return [];
    }
  }

  return { translate };
}
