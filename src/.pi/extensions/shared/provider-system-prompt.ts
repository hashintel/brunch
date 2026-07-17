const STRING_PROMPT_KEYS = ['instructions', 'systemInstruction', 'systemPrompt'] as const;
const BRUNCH_FOREGROUND_PROMPT_START = '<brunch-foreground-prompt>';
const BRUNCH_FOREGROUND_PROMPT_END = '</brunch-foreground-prompt>';
const BRUNCH_FOREGROUND_PROMPT_PREFIX = `${BRUNCH_FOREGROUND_PROMPT_START}\nlength: `;
const BRUNCH_FOREGROUND_PROMPT_SUFFIX = `\n${BRUNCH_FOREGROUND_PROMPT_END}`;

interface OwnedPromptFrame {
  readonly start: number;
  readonly end: number;
}

export function upsertBrunchProviderSystemPrompt(payload: unknown, prompt: string): unknown {
  if (!isRecord(payload)) return undefined;

  for (const key of STRING_PROMPT_KEYS) {
    const replacement = upsertStringProperty(payload, key, prompt);
    if (replacement !== undefined) return replacement;
  }

  const systemReplacement = upsertStringOrBlocksProperty(payload, 'system', prompt);
  if (systemReplacement !== undefined) return systemReplacement;

  return upsertMessageArray(payload, prompt);
}

export function upsertBrunchOwnedSystemPrompt(basePrompt: string, prompt: string): string {
  const ownedPrompt = renderOwnedPrompt(prompt);
  const replacement = replaceOwnedPromptFrames(basePrompt, ownedPrompt);

  if (replacement.found) return replacement.value;
  return basePrompt.trim().length > 0 ? `${basePrompt}\n\n${ownedPrompt}` : ownedPrompt;
}

export function systemPromptFromProviderPayload(payload: unknown): string | undefined {
  if (!isRecord(payload)) return undefined;

  for (const key of STRING_PROMPT_KEYS) {
    const value = payload[key];
    if (typeof value === 'string') return value;
  }

  const system = textFromStringOrBlocks(payload.system, '\n\n');
  if (system !== undefined) return system;

  const messages = payload.messages ?? payload.input;
  if (!Array.isArray(messages)) return undefined;

  const systemMessage = messages.find(isSystemMessageLike);
  return systemMessage ? contentToText(systemMessage.content, '') : undefined;
}

function upsertStringProperty(payload: Record<string, unknown>, key: string, prompt: string): unknown {
  const value = payload[key];
  if (typeof value !== 'string') return undefined;
  const nextValue = upsertBrunchOwnedSystemPrompt(value, prompt);
  return nextValue === value ? payload : { ...payload, [key]: nextValue };
}

function upsertStringOrBlocksProperty(
  payload: Record<string, unknown>,
  key: string,
  prompt: string,
): unknown {
  const value = payload[key];
  if (typeof value === 'string') return upsertStringProperty(payload, key, prompt);
  if (!Array.isArray(value)) return undefined;

  const nextValue = upsertContentBlocks(value, prompt);
  return nextValue === value ? payload : { ...payload, [key]: nextValue };
}

function upsertMessageArray(payload: Record<string, unknown>, prompt: string): unknown {
  const messages = payload.messages ?? payload.input;
  if (!Array.isArray(messages)) return undefined;

  const firstSystemIndex = messages.findIndex(isSystemMessageLike);
  if (firstSystemIndex === -1) return undefined;

  const message = messages[firstSystemIndex];
  const nextContent = upsertContent(message.content, prompt);
  if (nextContent === undefined || nextContent === message.content) return payload;

  const nextMessages = [...messages];
  nextMessages[firstSystemIndex] = {
    ...message,
    content: nextContent,
  };
  return {
    ...payload,
    [payload.messages === messages ? 'messages' : 'input']: nextMessages,
  };
}

function upsertContent(content: unknown, prompt: string): unknown {
  if (typeof content === 'string') return upsertBrunchOwnedSystemPrompt(content, prompt);
  if (Array.isArray(content)) return upsertContentBlocks(content, prompt);
  return undefined;
}

function upsertContentBlocks(blocks: readonly unknown[], prompt: string): readonly unknown[] {
  const ownedPrompt = renderOwnedPrompt(prompt);
  let placedOwnedPrompt = false;
  let changed = false;
  const nextBlocks = blocks.map((block) => {
    if (!isRecord(block) || typeof block.text !== 'string') return block;

    const replacement = replaceOwnedPromptFrames(block.text, placedOwnedPrompt ? undefined : ownedPrompt);
    if (!replacement.found) return block;
    placedOwnedPrompt = true;
    if (replacement.value === block.text) return block;
    changed = true;
    return { ...block, text: replacement.value };
  });

  if (placedOwnedPrompt) return changed ? nextBlocks : blocks;
  return [...blocks, { type: 'text', text: ownedPrompt }];
}

function renderOwnedPrompt(prompt: string): string {
  return `${BRUNCH_FOREGROUND_PROMPT_PREFIX}${prompt.length}\n${prompt}${BRUNCH_FOREGROUND_PROMPT_SUFFIX}`;
}

function replaceOwnedPromptFrames(
  value: string,
  replacement: string | undefined,
): { readonly value: string; readonly found: boolean } {
  const frames = findOwnedPromptFrames(value);
  if (frames.length === 0) return { value, found: false };

  let cursor = 0;
  let nextValue = '';
  for (const [index, frame] of frames.entries()) {
    nextValue += value.slice(cursor, frame.start);
    if (index === 0 && replacement !== undefined) nextValue += replacement;
    cursor = frame.end;
  }
  nextValue += value.slice(cursor);
  return { value: nextValue, found: true };
}

function findOwnedPromptFrames(value: string): OwnedPromptFrame[] {
  const frames: OwnedPromptFrame[] = [];
  let searchFrom = 0;

  while (searchFrom < value.length) {
    const start = value.indexOf(BRUNCH_FOREGROUND_PROMPT_PREFIX, searchFrom);
    if (start === -1) break;

    const lengthStart = start + BRUNCH_FOREGROUND_PROMPT_PREFIX.length;
    const lengthEnd = value.indexOf('\n', lengthStart);
    if (lengthEnd === -1) break;

    const encodedLength = value.slice(lengthStart, lengthEnd);
    const contentLength = Number(encodedLength);
    if (
      !Number.isSafeInteger(contentLength) ||
      contentLength < 0 ||
      String(contentLength) !== encodedLength
    ) {
      searchFrom = lengthStart;
      continue;
    }

    const contentStart = lengthEnd + 1;
    const suffixStart = contentStart + contentLength;
    if (!value.startsWith(BRUNCH_FOREGROUND_PROMPT_SUFFIX, suffixStart)) {
      searchFrom = lengthStart;
      continue;
    }

    const end = suffixStart + BRUNCH_FOREGROUND_PROMPT_SUFFIX.length;
    frames.push({ start, end });
    searchFrom = end;
  }

  return frames;
}

function contentToText(content: unknown, separator: string): string | undefined {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return textFromBlocks(content, separator);
  return undefined;
}

function textFromStringOrBlocks(value: unknown, separator: string): string | undefined {
  if (typeof value === 'string') return value;
  if (!Array.isArray(value)) return undefined;
  const text = textFromBlocks(value, separator);
  return text.length > 0 ? text : undefined;
}

function textFromBlocks(blocks: readonly unknown[], separator: string): string {
  return blocks
    .map((block) => (isRecord(block) && typeof block.text === 'string' ? block.text : ''))
    .filter(Boolean)
    .join(separator);
}

function isSystemMessageLike(
  message: unknown,
): message is { readonly content: unknown } & Record<string, unknown> {
  return (
    isRecord(message) && (message.role === 'system' || message.role === 'developer') && 'content' in message
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
