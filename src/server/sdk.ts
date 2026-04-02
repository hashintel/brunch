/**
 * SDK utilities — shared stream event translation and client factory.
 *
 * createStreamTranslator() — translates raw Anthropic API streaming events
 * to DomainEvents. Raw events arrive directly (message_start, content_block_start, etc.)
 * without any wrapper envelope.
 *
 * createAnthropicClient() — thin seam over the Anthropic SDK client.
 * Centralizes instantiation so tests can mock a single import.
 */

import Anthropic from '@anthropic-ai/sdk';

import type { DomainEvent } from './core.js';

/** Raw Anthropic streaming event (directly from client.messages.stream/create with stream:true). */
export interface RawStreamEvent {
  type: string;
  index?: number;
  message?: { id: string };
  content_block?: { type: string; name?: string; id?: string };
  delta?: { type: string; text?: string; thinking?: string; partial_json?: string };
}

/** Input for extractMetrics — raw API usage + wall-clock timing. */
export interface RawMetricsInput {
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
}

/** Create the Anthropic SDK client. Thin seam for testability. */
export function createAnthropicClient(): Anthropic {
  return new Anthropic();
}

/**
 * Create a per-request stream translator with scoped state.
 * Maps raw Anthropic streaming events to DomainEvent arrays.
 * Tracks tool_use block lifecycle (start → delta → stop).
 */
export function createStreamTranslator() {
  const toolUseBlocks = new Map<number, { toolName: string; toolCallId: string }>();

  function translate(rawEvent: unknown): DomainEvent[] {
    const event = rawEvent as RawStreamEvent;

    switch (event.type) {
      case 'message_start':
        return [{ type: 'stream-start', messageId: event.message!.id }];

      case 'content_block_start': {
        const block = event.content_block!;
        if (block.type === 'tool_use') {
          toolUseBlocks.set(event.index!, { toolName: block.name!, toolCallId: block.id! });
          return [{ type: 'tool-call-start', toolName: block.name!, toolCallId: block.id! }];
        }
        return [];
      }

      case 'content_block_delta': {
        const delta = event.delta!;
        if (delta.type === 'thinking_delta' && delta.thinking) {
          return [{ type: 'thinking', delta: delta.thinking }];
        }
        if (delta.type === 'text_delta' && delta.text) {
          return [{ type: 'text-delta', delta: delta.text }];
        }
        if (delta.type === 'input_json_delta' && delta.partial_json) {
          const toolBlock = toolUseBlocks.get(event.index!);
          return [
            {
              type: 'tool-call-delta',
              toolCallId: toolBlock?.toolCallId ?? '',
              delta: delta.partial_json,
            },
          ];
        }
        return [];
      }

      case 'content_block_stop': {
        const toolBlock = toolUseBlocks.get(event.index!);
        if (toolBlock) {
          toolUseBlocks.delete(event.index!);
          return [{ type: 'tool-call-end', toolCallId: toolBlock.toolCallId, toolName: toolBlock.toolName }];
        }
        return [];
      }

      case 'message_stop':
        return [{ type: 'stream-end' }];

      default:
        return [];
    }
  }

  return { translate };
}

/** Extract agent-metrics DomainEvent from raw API usage + wall-clock timing. */
export function extractMetrics(agent: string, metrics: RawMetricsInput): DomainEvent {
  return {
    type: 'agent-metrics',
    agent,
    durationMs: metrics.durationMs,
    inputTokens: metrics.inputTokens,
    outputTokens: metrics.outputTokens,
  };
}
