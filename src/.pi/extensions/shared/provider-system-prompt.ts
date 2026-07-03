const STRING_PROMPT_KEYS = ['instructions', 'systemInstruction', 'systemPrompt'] as const;

export function appendProviderSystemPromptIfMissing(payload: unknown, prompt: string): unknown {
  if (!isRecord(payload)) return undefined;

  for (const key of STRING_PROMPT_KEYS) {
    const replacement = appendToStringProperty(payload, key, prompt);
    if (replacement !== undefined) return replacement;
  }

  const systemReplacement = appendToStringOrBlocksProperty(payload, 'system', prompt);
  if (systemReplacement !== undefined) return systemReplacement;

  return appendToMessageArray(payload, prompt);
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

function appendToStringProperty(payload: Record<string, unknown>, key: string, prompt: string): unknown {
  const value = payload[key];
  if (typeof value !== 'string') return undefined;
  const nextValue = appendPromptIfMissing(value, prompt);
  return nextValue === value ? payload : { ...payload, [key]: nextValue };
}

function appendToStringOrBlocksProperty(
  payload: Record<string, unknown>,
  key: string,
  prompt: string,
): unknown {
  const value = payload[key];
  if (typeof value === 'string') return appendToStringProperty(payload, key, prompt);
  if (!Array.isArray(value)) return undefined;

  const currentPrompt = textFromBlocks(value, '\n');
  if (systemPromptHasBrunchPrompt(currentPrompt, prompt)) return payload;
  return {
    ...payload,
    [key]: [...value, { type: 'text', text: prompt }],
  };
}

function appendToMessageArray(payload: Record<string, unknown>, prompt: string): unknown {
  const messages = payload.messages ?? payload.input;
  if (!Array.isArray(messages)) return undefined;

  const firstSystemIndex = messages.findIndex(isSystemMessageLike);
  if (firstSystemIndex === -1) return undefined;

  const message = messages[firstSystemIndex];
  const contentText = contentToText(message.content, '\n');
  if (contentText === undefined || systemPromptHasBrunchPrompt(contentText, prompt)) return payload;

  const nextMessages = [...messages];
  nextMessages[firstSystemIndex] = {
    ...message,
    content: appendContent(message.content, prompt),
  };
  return {
    ...payload,
    [payload.messages === messages ? 'messages' : 'input']: nextMessages,
  };
}

function appendPromptIfMissing(basePrompt: string, prompt: string): string {
  if (systemPromptHasBrunchPrompt(basePrompt, prompt)) return basePrompt;
  return basePrompt.trim().length > 0 ? `${basePrompt}\n\n${prompt}` : prompt;
}

function systemPromptHasBrunchPrompt(systemPrompt: string, prompt: string): boolean {
  const sentinel = prompt
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean);
  return sentinel !== undefined && systemPrompt.includes(sentinel);
}

function appendContent(content: unknown, prompt: string): unknown {
  if (typeof content === 'string') return appendPromptIfMissing(content, prompt);
  if (Array.isArray(content)) return [...content, { type: 'text', text: prompt }];
  return content;
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
