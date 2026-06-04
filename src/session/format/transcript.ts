/**
 * Formats projected transcript context into probe transcript markdown.
 *
 * Input:
 * - projected output from session/project/transcript-context.ts
 *
 * Output:
 * - transcript.md artifact aligned with Pi-derived LLM-visible content
 *
 * Replaces/adapts:
 * - session/session-transcript.ts
 */

import type {
  ImageContent,
  Message,
  TextContent,
  ThinkingContent,
  ToolCall,
  ToolResultMessage,
  UserMessage,
} from '@earendil-works/pi-ai';

import type { ProjectedTranscriptContext } from '../project/transcript-context.js';

export function formatTranscript(
  context: ProjectedTranscriptContext,
  options: { title?: string } = {},
): string {
  const lines: string[] = [`# Transcript${options.title ? ` — ${options.title}` : ''}`];

  for (const [index, message] of context.messages.entries()) {
    lines.push('', ...renderMessage(message, index + 1));
  }

  return `${lines.join('\n').trimEnd()}\n`;
}

function renderMessage(message: Message, index: number): string[] {
  switch (message.role) {
    case 'user':
      return [`## ${index}. User`, '', ...renderUserContent(message.content)];
    case 'assistant':
      return [`## ${index}. Assistant`, '', ...renderTextBlocks(message.content)];
    case 'toolResult':
      return [`## ${index}. Tool result: ${message.toolName}`, '', ...renderUserContent(message.content)];
  }
}

function renderUserContent(
  content: UserMessage['content'] | ToolResultMessage<unknown>['content'],
): string[] {
  if (typeof content === 'string') {
    return renderTextBlock(content);
  }
  return renderTextBlocks(content);
}

function renderTextBlocks(content: Array<TextContent | ImageContent | ThinkingContent | ToolCall>): string[] {
  const rendered = content.flatMap((block) => {
    if (block.type !== 'text') {
      return [];
    }
    return renderTextBlock(block.text);
  });
  return rendered.length > 0 ? interleaveBlankLines(rendered) : [];
}

function renderTextBlock(text: string): string[] {
  const trimmed = text.trim();
  return trimmed.length > 0 ? [trimmed] : ['_(empty)_'];
}

function interleaveBlankLines(lines: string[]): string[] {
  const output: string[] = [];
  for (const line of lines) {
    if (output.length > 0 && line !== '' && output.at(-1) !== '') {
      output.push('');
    }
    output.push(line);
  }
  return output;
}
