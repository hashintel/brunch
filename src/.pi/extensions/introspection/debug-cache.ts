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

/**
 * Mirror a Brunch-originated transcript entry to `.brunch/debug/entry-contents.md`.
 *
 * Hooked at the append seam (not provider events) so seeded context and
 * continuity notices are observable even when no provider turn ever runs —
 * the gap that masked the origination-kick defect. Observability only:
 * never a carrier, never read back by product code.
 */
export async function appendEntryContentToDebugCache(
  options: BrunchDebugCacheOptions,
  entry: {
    readonly type: 'custom' | 'custom_message';
    readonly customType: string;
    readonly content?: string;
    readonly data?: unknown;
    readonly details?: unknown;
  },
): Promise<void> {
  const payload = entry.type === 'custom_message' ? entry.details : entry.data;
  const block = [
    `## ${entry.customType} (${entry.type}) · ${new Date().toISOString()}`,
    ...(entry.content ? ['', entry.content] : []),
    ...(payload === undefined ? [] : ['', '```json', debugCacheJson(payload), '```']),
  ].join('\n');

  const debugDir = join(options.cwd, '.brunch', 'debug');
  await mkdir(debugDir, { recursive: true });
  await appendSeparatedBlock(join(debugDir, 'entry-contents.md'), block);
}

export async function appendOriginationRecordToDebugCache(
  options: BrunchDebugCacheOptions,
  record: unknown,
): Promise<void> {
  const block = [
    `## brunch.origination (${new Date().toISOString()})`,
    '',
    '```json',
    debugCacheJson(record),
    '```',
  ].join('\n');

  const debugDir = join(options.cwd, '.brunch', 'debug');
  await mkdir(debugDir, { recursive: true });
  await appendSeparatedBlock(join(debugDir, 'origination.md'), block);
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

export function debugCacheJson(value: unknown): string {
  return JSON.stringify(value, (_key, nested) => serializeDebugCacheValue(nested), 2);
}

function serializeDebugCacheValue(value: unknown): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      ...(value.stack ? { stack: value.stack } : {}),
    };
  }
  return value;
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
  // anthropic-messages serializes `system` as an array of text blocks (with
  // optional cache_control) — never a string. Join blocks as sections.
  if (Array.isArray(payload.system)) {
    const blocks = payload.system.flatMap((block) =>
      isRecord(block) && typeof block.text === 'string' ? [block.text] : [],
    );
    if (blocks.length > 0) return blocks.join('\n\n');
  }
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
