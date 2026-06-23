/**
 * Canonical session-to-transcript projection for Brunch debug artifacts.
 *
 * Input:
 * - raw FileEntry[] / SessionEntry[] from Pi session JSONL
 *
 * Output:
 * - Pi-derived active message context after buildSessionContext() and convertToLlm()
 * - debug filtering policy: user, assistant, and Brunch-owned custom tool results
 *
 * Used by:
 * - renderers/session/transcript.ts
 * - `.brunch/debug/transcript.md` writers
 */

import type { ImageContent, Message, TextContent, ThinkingContent, ToolCall } from '@earendil-works/pi-ai';
import type { FileEntry, SessionEntry } from '@earendil-works/pi-coding-agent';
import { buildSessionContext, convertToLlm } from '@earendil-works/pi-coding-agent';

export interface ProjectedTranscriptContext {
  readonly messages: readonly Message[];
}

const BRUNCH_TRANSCRIPT_TOOL_NAMES = new Set([
  'brunch_introspect_query',
  'brunch_session_query',
  'mutate_graph',
  'present_alternatives',
  'present_candidates',
  'present_question',
  'present_review_set',
  'read_elicitation_gaps',
  'read_graph',
  'read_reconciliation_needs',
  'read_session_context',
  'read_specification_context',
  'read_workspace_context',
  'request_response',
  'subagent',
  'update_elicitation_gaps',
  'update_reconciliation_needs',
]);

export function projectTranscriptContext(entries: readonly FileEntry[]): ProjectedTranscriptContext {
  const sessionEntries = entries.filter((entry): entry is SessionEntry => entry.type !== 'session');
  const messages = convertToLlm(buildSessionContext(sessionEntries).messages);
  return {
    messages: messages.filter(
      (message) => shouldRenderMessage(message) && renderMarkdown(message).length > 0,
    ),
  };
}

function shouldRenderMessage(message: Message): boolean {
  return (
    message.role === 'user' ||
    message.role === 'assistant' ||
    (message.role === 'toolResult' && BRUNCH_TRANSCRIPT_TOOL_NAMES.has(message.toolName))
  );
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

function renderUserContent(
  content: Message['content'] | Extract<Message, { role: 'toolResult' }>['content'],
): string[] {
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
