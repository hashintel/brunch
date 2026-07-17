const STRING_PROMPT_KEYS = ['instructions', 'systemInstruction', 'systemPrompt'] as const;
const BRUNCH_FOREGROUND_PROMPT_START = '<brunch-foreground-prompt>';
const BRUNCH_FOREGROUND_PROMPT_END = '</brunch-foreground-prompt>';
const BRUNCH_FOREGROUND_PROMPT_PATTERN = /<brunch-foreground-prompt>[\s\S]*?<\/brunch-foreground-prompt>/gu;

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
  let foundOwnedPrompt = false;
  const replaced = basePrompt.replace(BRUNCH_FOREGROUND_PROMPT_PATTERN, () => {
    if (foundOwnedPrompt) return '';
    foundOwnedPrompt = true;
    return ownedPrompt;
  });

  if (foundOwnedPrompt) return replaced;
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

    let matchedInBlock = false;
    const nextText = block.text.replace(BRUNCH_FOREGROUND_PROMPT_PATTERN, () => {
      matchedInBlock = true;
      if (placedOwnedPrompt) return '';
      placedOwnedPrompt = true;
      return ownedPrompt;
    });
    if (!matchedInBlock || nextText === block.text) return block;
    changed = true;
    return { ...block, text: nextText };
  });

  if (placedOwnedPrompt) return changed ? nextBlocks : blocks;
  return [...blocks, { type: 'text', text: ownedPrompt }];
}

function renderOwnedPrompt(prompt: string): string {
  return `${BRUNCH_FOREGROUND_PROMPT_START}\n${prompt}\n${BRUNCH_FOREGROUND_PROMPT_END}`;
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
