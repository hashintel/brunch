/**
 * SDK utilities — shared stream event translation for agents that call query().
 *
 * createStreamTranslator() — per-message SDK stream_event → DomainEvent translator.
 * Each agent owns its own query() call; this handles the shared translation logic.
 * Streaming agents use it; silent agents (observer) don't.
 */

import type { DomainEvent } from './core.js';

/** Minimal shape of an SDK stream_event message. */
export interface SdkStreamEvent {
  type: 'stream_event';
  event: {
    type: string;
    index?: number;
    message?: { id: string };
    content_block?: { type: string; name?: string; id?: string };
    delta?: { type: string; text?: string; thinking?: string; partial_json?: string };
  };
}

/** Shape of SDK ResultMessage (success or error). */
export interface SdkResultMessage {
  type: 'result';
  subtype: 'success' | 'error_during_execution' | 'error_max_turns' | 'error_max_budget_usd';
  duration_ms: number;
  duration_api_ms: number;
  total_cost_usd: number;
  is_error: boolean;
  num_turns: number;
  usage: { input_tokens: number; output_tokens: number };
  result?: string;
  structured_output?: unknown;
}

/**
 * Create a per-request stream translator with scoped state.
 * Maps individual SDK stream_event messages to DomainEvent arrays.
 * Tracks tool_use block lifecycle (start → delta → stop).
 */
export function createStreamTranslator() {
  const toolUseBlocks = new Map<number, { toolName: string; toolCallId: string }>();

  function translate(sdkMessage: unknown): DomainEvent[] {
    const msg = sdkMessage as Record<string, unknown>;
    if (msg.type !== 'stream_event') return [];

    const event = (msg as unknown as SdkStreamEvent).event;
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

/** Extract agent-metrics DomainEvent from an SDK ResultMessage. */
export function extractMetrics(agent: string, msg: SdkResultMessage): DomainEvent {
  return {
    type: 'agent-metrics',
    agent,
    durationMs: msg.duration_ms,
    durationApiMs: msg.duration_api_ms,
    totalCostUsd: msg.total_cost_usd,
    inputTokens: msg.usage.input_tokens,
    outputTokens: msg.usage.output_tokens,
  };
}
