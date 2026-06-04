import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type {
  ImageContent,
  Message,
  TextContent,
  ThinkingContent,
  ToolCall,
  ToolResultMessage,
  UserMessage,
} from '@earendil-works/pi-ai';
import type { FileEntry, SessionEntry } from '@earendil-works/pi-coding-agent';
import { buildSessionContext, convertToLlm } from '@earendil-works/pi-coding-agent';

type TranscriptEntry = FileEntry;

export async function renderSessionTranscriptFile(sessionFile: string): Promise<string> {
  const text = await readFile(sessionFile, 'utf8');
  return renderSessionTranscript(text, { title: basename(sessionFile) });
}

export function renderSessionTranscript(jsonl: string, options: { title?: string } = {}): string {
  const entries = parseJsonl(jsonl);
  const messages = renderableMessages(llmMessages(entries));
  const lines: string[] = [`# Transcript${options.title ? ` — ${options.title}` : ''}`];

  for (const [index, message] of messages.entries()) {
    lines.push('', ...renderMessage(message, index + 1));
  }

  return `${lines.join('\n').trimEnd()}\n`;
}

function parseJsonl(jsonl: string): FileEntry[] {
  return jsonl
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line, index) => {
      try {
        return JSON.parse(line) as TranscriptEntry;
      } catch (error) {
        throw new Error(`Invalid JSONL at line ${index + 1}: ${(error as Error).message}`);
      }
    });
}

function llmMessages(entries: TranscriptEntry[]): Message[] {
  const sessionEntries = entries.filter((entry): entry is SessionEntry => entry.type !== 'session');
  return convertToLlm(buildSessionContext(sessionEntries).messages);
}

function renderableMessages(messages: Message[]): Message[] {
  return messages.filter((message) => renderMarkdown(message).length > 0);
}

function renderMessage(message: Message, index: number): string[] {
  switch (message.role) {
    case 'user':
      return renderUserMessage(message, index);
    case 'assistant':
      return renderAssistantMessage(message, index);
    case 'toolResult':
      return renderToolResult(message, index);
  }
}

function renderUserMessage(message: UserMessage, index: number): string[] {
  return [`## ${index}. User`, '', ...renderUserContent(message.content)];
}

function renderAssistantMessage(message: Extract<Message, { role: 'assistant' }>, index: number): string[] {
  return [`## ${index}. Assistant`, '', ...renderMarkdown(message)];
}

function renderToolResult(message: ToolResultMessage<unknown>, index: number): string[] {
  return [`## ${index}. Tool result: ${message.toolName}`, '', ...renderMarkdown(message)];
}

function renderUserContent(
  content: UserMessage['content'] | ToolResultMessage<unknown>['content'],
): string[] {
  if (typeof content === 'string') {
    return renderTextBlock(content);
  }
  return renderTextBlocks(content);
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

function renderTextBlocks(content: Array<TextContent | ImageContent | ThinkingContent | ToolCall>): string[] {
  const rendered = content.flatMap((block) => {
    if (!isTextContent(block)) {
      return [];
    }
    return renderTextBlock(block.text);
  });
  return rendered.length > 0 ? interleaveBlankLines(rendered) : [];
}

function isTextContent(
  block: TextContent | ImageContent | ThinkingContent | ToolCall,
): block is TextContent {
  return block.type === 'text';
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

async function main(): Promise<void> {
  const [, , sessionFile] = process.argv;
  if (!sessionFile) {
    process.stderr.write('Usage: tsx src/session-transcript.ts <session.jsonl>\n');
    process.exitCode = 1;
    return;
  }
  process.stdout.write(await renderSessionTranscriptFile(sessionFile));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void main().catch((error) => {
    process.stderr.write(`${(error as Error).stack ?? String(error)}\n`);
    process.exitCode = 1;
  });
}
