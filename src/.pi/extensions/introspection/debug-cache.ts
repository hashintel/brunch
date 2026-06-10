import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface BrunchDebugCacheOptions {
  readonly cwd: string;
}

const BRUNCH_DEBUG_CONTENT_TOOL_NAMES = new Set([
  'brunch_introspect_query',
  'brunch_session_query',
  'mutate_graph',
  'present_alternatives',
  'present_options',
  'present_question',
  'present_review_set',
  'read_graph',
  'read_session_context',
  'read_workspace_context',
  'request_answer',
  'request_choice',
  'request_choices',
  'request_review',
]);

export async function mirrorSystemPromptToDebugCache(
  options: BrunchDebugCacheOptions,
  payload: unknown,
): Promise<void> {
  const systemPrompt = systemPromptFromProviderPayload(payload);
  if (systemPrompt === undefined) return;

  const debugDir = join(options.cwd, '.brunch', 'debug');
  await mkdir(debugDir, { recursive: true });
  await writeFile(join(debugDir, 'system-prompt.md'), systemPrompt, 'utf8');
}

export async function appendToolContentToDebugCache(
  options: BrunchDebugCacheOptions,
  event: unknown,
): Promise<void> {
  const text = toolContentFromEvent(event);
  if (text === undefined) return;

  const debugDir = join(options.cwd, '.brunch', 'debug');
  await mkdir(debugDir, { recursive: true });
  await appendSeparatedBlock(join(debugDir, 'tool-contents.md'), text);
}

function toolContentFromEvent(event: unknown): string | undefined {
  if (!isRecord(event) || typeof event.toolName !== 'string') return undefined;
  if (!BRUNCH_DEBUG_CONTENT_TOOL_NAMES.has(event.toolName)) return undefined;

  const content = event.content;
  if (!Array.isArray(content)) return undefined;

  const text = content.flatMap((block) => {
    if (isRecord(block) && block.type === 'text' && typeof block.text === 'string') return [block.text];
    return [];
  });
  return text.length > 0 ? text.join('\n') : undefined;
}

async function appendSeparatedBlock(file: string, text: string): Promise<void> {
  let existing = '';
  try {
    existing = await readFile(file, 'utf8');
  } catch (error) {
    if (!isNodeError(error) || error.code !== 'ENOENT') throw error;
  }

  await appendFile(file, `${existing.length > 0 ? '\n\n---\n\n' : ''}${text}`, 'utf8');
}

function systemPromptFromProviderPayload(payload: unknown): string | undefined {
  if (!isRecord(payload)) return undefined;

  if (typeof payload.system === 'string') return payload.system;
  if (typeof payload.systemPrompt === 'string') return payload.systemPrompt;

  const messages = payload.messages;
  if (!Array.isArray(messages)) return undefined;

  const systemMessage = messages.find(
    (message): message is { readonly content: unknown } =>
      isRecord(message) && message.role === 'system' && 'content' in message,
  );
  return textFromMessageContent(systemMessage?.content);
}

function textFromMessageContent(content: unknown): string | undefined {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return undefined;

  const parts = content.flatMap((part) => {
    if (typeof part === 'string') return [part];
    if (isRecord(part) && typeof part.text === 'string') return [part.text];
    return [];
  });
  return parts.length > 0 ? parts.join('') : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
