/**
 * SSE Adapter — translates events into AI SDK UI Message Stream protocol.
 *
 * createTranslator() — SDK stream events → AIEvent (used directly or by tests).
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

/** Minimal shape of an SDKPartialAssistantMessage from the Claude Agent SDK */
interface SDKStreamEvent {
  type: 'stream_event';
  event: {
    type: string;
    index?: number;
    message?: { id: string; role: string; content: unknown[] };
    content_block?: { type: string; thinking?: string; text?: string; name?: string; id?: string };
    delta?: { type: string; text?: string; thinking?: string; partial_json?: string };
  };
}

interface SDKOtherMessage {
  type: string;
}

type SDKMessage = SDKStreamEvent | SDKOtherMessage;

/**
 * Format a payload as an SSE data line.
 */
export function formatSSE(payload: AIEvent | '[DONE]'): string {
  if (payload === '[DONE]') return 'data: [DONE]\n\n';
  return `data: ${JSON.stringify(payload)}\n\n`;
}

/**
 * Create a per-request translator with scoped state.
 * Each request gets its own instance — no shared mutable state.
 */
export function createTranslator() {
  const thinkingBlocks = new Set<number>();
  const textBlocks = new Set<number>();
  const toolUseBlocks = new Map<number, { toolName: string; toolCallId: string; argsJson: string }>();

  function translateEvent(sdkMessage: SDKMessage): AIEvent[] {
    if (sdkMessage.type !== 'stream_event') return [];

    const event = (sdkMessage as SDKStreamEvent).event;

    switch (event.type) {
      case 'message_start':
        return [{ type: 'start', messageId: event.message!.id }];

      case 'content_block_start': {
        const block = event.content_block!;
        if (block.type === 'thinking') {
          thinkingBlocks.add(event.index!);
          return [{ type: 'reasoning-start', id: `reasoning-${event.index}` }];
        }
        if (block.type === 'text') {
          textBlocks.add(event.index!);
          return [{ type: 'text-start', id: `text-${event.index}` }];
        }
        if (block.type === 'tool_use') {
          toolUseBlocks.set(event.index!, {
            toolName: block.name!,
            toolCallId: block.id!,
            argsJson: '',
          });
          return [{ type: 'tool-call-streaming-start', id: block.id!, toolName: block.name! }];
        }
        return [];
      }

      case 'content_block_delta': {
        const delta = event.delta!;
        if (delta.type === 'thinking_delta') {
          return [
            {
              type: 'reasoning-delta',
              id: `reasoning-${event.index}`,
              delta: delta.thinking!,
            },
          ];
        }
        if (delta.type === 'text_delta') {
          return [{ type: 'text-delta', id: `text-${event.index}`, delta: delta.text! }];
        }
        if (delta.type === 'input_json_delta') {
          const toolBlock = toolUseBlocks.get(event.index!);
          if (toolBlock) {
            toolBlock.argsJson += delta.partial_json ?? '';
            return [{ type: 'tool-call-delta', id: toolBlock.toolCallId, delta: delta.partial_json! }];
          }
        }
        return [];
      }

      case 'content_block_stop': {
        if (thinkingBlocks.has(event.index!)) {
          thinkingBlocks.delete(event.index!);
          return [{ type: 'reasoning-end', id: `reasoning-${event.index}` }];
        }
        if (textBlocks.has(event.index!)) {
          textBlocks.delete(event.index!);
          return [{ type: 'text-end', id: `text-${event.index}` }];
        }
        const toolBlock = toolUseBlocks.get(event.index!);
        if (toolBlock) {
          toolUseBlocks.delete(event.index!);
          return [
            {
              type: 'tool-call',
              id: toolBlock.toolCallId,
              toolName: toolBlock.toolName,
              args: toolBlock.argsJson,
            },
          ];
        }
        return [];
      }

      case 'message_stop':
        return [{ type: 'finish-step' }, { type: 'finish', finishReason: 'stop' }];

      default:
        return [];
    }
  }

  return { translateEvent };
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
