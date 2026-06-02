/**
 * Test helpers — typed factory functions for fixture construction.
 *
 * Tests historically built `Message` objects inline as `{ role, content }`
 * which omits required fields like `timestamp` and (for assistants) wraps
 * string content where the canonical type wants `(TextContent | ...)[]`. The
 * runtime tolerated this; strict TS does not. These factories produce
 * canonical messages so test fixtures stay aligned with production types.
 */

import type {
  AssistantMessage,
  ImageContent,
  TextContent,
  ThinkingContent,
  ToolCall,
  UserMessage,
} from '@earendil-works/pi-ai';
import type { CustomEntry, CustomMessageEntry, SessionEntry } from '@earendil-works/pi-coding-agent';

const ZERO_USAGE = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  totalTokens: 0,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
} as const;

export function userMessage(content: string | (TextContent | ImageContent)[], timestamp = 0): UserMessage {
  return { role: 'user', content, timestamp };
}

export function assistantMessage(
  text: string | (TextContent | ThinkingContent | ToolCall)[],
  timestamp = 0,
): AssistantMessage {
  const content: (TextContent | ThinkingContent | ToolCall)[] =
    typeof text === 'string' ? [{ type: 'text', text }] : text;
  return {
    role: 'assistant',
    content,
    api: 'openai-completions',
    provider: 'openai',
    model: 'test-model',
    usage: { ...ZERO_USAGE, cost: { ...ZERO_USAGE.cost } },
    stopReason: 'stop',
    timestamp,
  };
}

export function isCustomEntry(entry: SessionEntry): entry is CustomEntry {
  return entry.type === 'custom';
}

export function isCustomMessageEntry(entry: SessionEntry): entry is CustomMessageEntry {
  return entry.type === 'custom_message';
}
