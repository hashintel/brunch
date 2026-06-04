/**
 * Canonical session-to-transcript projection for Brunch probe artifacts.
 *
 * Input:
 * - raw FileEntry[] / SessionEntry[] from Pi session JSONL
 *
 * Output:
 * - Pi-derived active message context after buildSessionContext() and convertToLlm()
 * - probe-specific filtering policy for which derived messages are worth rendering
 *
 * Used by:
 * - session/format/transcript.ts
 * - any future transcript artifact or transcript-equivalence probes
 */

import type {
  ImageContent,
  Message,
  TextContent,
  ThinkingContent,
  ToolCall,
} from '@earendil-works/pi-ai';
import type { FileEntry, SessionEntry } from '@earendil-works/pi-coding-agent';
import { buildSessionContext, convertToLlm } from '@earendil-works/pi-coding-agent';

export interface ProjectedTranscriptContext {
  readonly messages: readonly Message[];
}

export function projectTranscriptContext(entries: readonly FileEntry[]): ProjectedTranscriptContext {
  const sessionEntries = entries.filter((entry): entry is SessionEntry => entry.type !== 'session');
  const messages = convertToLlm(buildSessionContext(sessionEntries).messages);
  return {
    messages: messages.filter((message) => renderMarkdown(message).length > 0),
  };
}

function renderMarkdown(message: Message): string[] {
  switch (message.role) {
    case 'user':
      return renderUserContent(message.content);
    case 'assistant':
      return renderTextBlocks(message.content);
    case 'toolResult':
      return renderUserContent(message.content);
  }
}

function renderUserContent(content: Message['content'] | Extract<Message, { role: 'toolResult' }>['content']): string[] {
  if (typeof content === 'string') {
    return renderTextBlock(content);
  }
  return renderTextBlocks(content);
}

function renderTextBlocks(content: Array<TextContent | ImageContent | ThinkingContent | ToolCall>): string[] {
  return content.flatMap((block) => (block.type === 'text' ? renderTextBlock(block.text) : []));
}

function renderTextBlock(text: string): string[] {
  const trimmed = text.trim();
  return trimmed.length > 0 ? [trimmed] : ['_(empty)_'];
}
