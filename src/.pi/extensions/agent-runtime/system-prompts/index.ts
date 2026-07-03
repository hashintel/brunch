import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

import type {
  AgentPromptSessionContext,
  AgentPromptSpecContext,
  AgentPromptWorkspaceContext,
} from '../../../../agents/contexts/seeds/turn-context.js';
import type { LiveElicitorPushedContext } from '../../../../agents/runtime/elicitor/context.js';
import { composeForegroundRuntimePrompt } from '../../../../agents/runtime/foreground-policy.js';
import type { GraphReaders } from '../../brunch-data/graph/index.js';
import { activeToolNamesForBrunchAgentState, projectBrunchAgentState } from '../runtime/index.js';

type BrunchAgentStateEntries = Parameters<typeof projectBrunchAgentState>[0];

interface SessionManagerLike {
  getEntries(): BrunchAgentStateEntries;
}

interface BeforeAgentStartEventLike {
  systemPrompt?: string;
}

interface BeforeProviderRequestEventLike {
  payload: unknown;
}

interface PromptingContextLike {
  sessionManager?: SessionManagerLike;
}

interface BrunchPromptContext {
  spec: AgentPromptSpecContext;
  workspace: AgentPromptWorkspaceContext;
  /** Intended-optional: display label only; prompts render without a session label. */
  session?: AgentPromptSessionContext;
  /** Intended-optional: extra caller-supplied handles/contexts merged into the bundle. */
  context?: LiveElicitorPushedContext;
  /**
   * Must-wire: legality (gaps), tool posture, and graph context all derive from
   * these reads. Required so a composition root that forgets them is a type
   * error, never a silent fallback posture (the lesson of the FE-844/FE-847
   * review pass: an optional hook here froze live legality at a floor).
   */
  graphReads: GraphReaders;
}

export type BrunchPromptContextProvider =
  | BrunchPromptContext
  | (() => BrunchPromptContext | Promise<BrunchPromptContext>);

function supportsPrompting(pi: ExtensionAPI): boolean {
  return typeof (pi as Partial<ExtensionAPI>).on === 'function';
}

function projectState(ctx: PromptingContextLike | undefined) {
  return projectBrunchAgentState(ctx?.sessionManager?.getEntries() ?? []);
}

export function registerBrunchPrompting(
  pi: ExtensionAPI,
  promptContext: BrunchPromptContextProvider,
  options: { devAllowedToolNames?: readonly string[] | undefined } = {},
): void {
  if (!supportsPrompting(pi)) return;

  pi.on('before_agent_start', async (event, ctx) => {
    const { prompt, activeTools } = await composeBrunchPromptForContext(
      pi,
      promptContext,
      ctx as PromptingContextLike | undefined,
      options.devAllowedToolNames,
    );
    if (typeof (pi as Partial<ExtensionAPI>).setActiveTools === 'function') {
      pi.setActiveTools(activeTools);
    }
    if (prompt.trim().length === 0) return undefined;

    const basePrompt = (event as BeforeAgentStartEventLike).systemPrompt ?? '';
    return {
      systemPrompt: appendPromptIfMissing(basePrompt, prompt),
    };
  });

  pi.on('before_provider_request', async (event, ctx) => {
    const { prompt } = await composeBrunchPromptForContext(
      pi,
      promptContext,
      ctx as PromptingContextLike | undefined,
      options.devAllowedToolNames,
    );
    if (prompt.trim().length === 0) return undefined;

    return appendPromptToProviderPayloadIfMissing((event as BeforeProviderRequestEventLike).payload, prompt);
  });
}

async function resolvePromptContext(
  promptContext: BrunchPromptContextProvider,
): Promise<BrunchPromptContext> {
  return typeof promptContext === 'function' ? promptContext() : promptContext;
}

async function composeBrunchPromptForContext(
  pi: ExtensionAPI,
  promptContext: BrunchPromptContextProvider,
  ctx: PromptingContextLike | undefined,
  devAllowedToolNames: readonly string[] | undefined,
): Promise<{ prompt: string; activeTools: string[] }> {
  const resolvedPromptContext = await resolvePromptContext(promptContext);
  const state = projectState(ctx);
  const activeTools =
    typeof (pi as Partial<ExtensionAPI>).getAllTools === 'function'
      ? activeToolNamesForBrunchAgentState(pi, state, devAllowedToolNames)
      : [];
  const prompt = composeForegroundRuntimePrompt({
    sessionState: state,
    spec: resolvedPromptContext.spec,
    workspace: resolvedPromptContext.workspace,
    ...(resolvedPromptContext.context ? { context: resolvedPromptContext.context } : {}),
    activeTools,
  }).prompt;
  return { prompt, activeTools };
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

function appendPromptToProviderPayloadIfMissing(payload: unknown, prompt: string): unknown {
  if (!isRecord(payload)) return undefined;

  const replacements = [
    appendToStringProperty(payload, 'instructions', prompt),
    appendToStringProperty(payload, 'systemInstruction', prompt),
    appendToStringOrBlocksProperty(payload, 'system', prompt),
    appendToMessageArray(payload, prompt),
  ];
  return replacements.find((replacement) => replacement !== undefined);
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

  const currentPrompt = textFromBlocks(value);
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
  if (!isRecord(message)) return undefined;
  const content = message.content;
  const contentText = contentToText(content);
  if (contentText === undefined || systemPromptHasBrunchPrompt(contentText, prompt)) return payload;

  const nextMessages = [...messages];
  nextMessages[firstSystemIndex] = {
    ...message,
    content: appendContent(content, prompt),
  };
  return {
    ...payload,
    [payload.messages === messages ? 'messages' : 'input']: nextMessages,
  };
}

function isSystemMessageLike(message: unknown): boolean {
  return isRecord(message) && (message.role === 'system' || message.role === 'developer');
}

function appendContent(content: unknown, prompt: string): unknown {
  if (typeof content === 'string') return appendPromptIfMissing(content, prompt);
  if (Array.isArray(content)) return [...content, { type: 'text', text: prompt }];
  return content;
}

function contentToText(content: unknown): string | undefined {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return textFromBlocks(content);
  return undefined;
}

function textFromBlocks(blocks: readonly unknown[]): string {
  return blocks
    .map((block) => (isRecord(block) && typeof block.text === 'string' ? block.text : ''))
    .filter(Boolean)
    .join('\n');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
