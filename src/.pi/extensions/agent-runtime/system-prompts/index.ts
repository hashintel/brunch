import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

import type {
  AgentPromptSessionContext,
  AgentPromptSpecContext,
  AgentPromptWorkspaceContext,
} from '../../../../agents/contexts/seeds/turn-context.js';
import type { LiveElicitorPushedContext } from '../../../../agents/runtime/elicitor/context.js';
import { composeForegroundRuntimePrompt } from '../../../../agents/runtime/foreground-policy.js';
import { latestElicitationStyle } from '../../../../session/elicitation-style.js';
import type { GraphReaders } from '../../brunch-data/graph/index.js';
import { appendProviderSystemPromptIfMissing } from '../../shared/provider-system-prompt.js';
import { activeToolNamesForBrunchAgentState, projectBrunchAgentState } from '../runtime/index.js';

type BrunchAgentStateEntries = Parameters<typeof projectBrunchAgentState>[0];

interface SessionManagerLike {
  getBranch(): BrunchAgentStateEntries;
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

export function registerBrunchPrompting(
  pi: ExtensionAPI,
  promptContext: BrunchPromptContextProvider,
  options: {
    directiveAblation?: 'warrant-before-commit' | undefined;
  } = {},
): void {
  if (!supportsPrompting(pi)) return;

  pi.on('before_agent_start', async (event, ctx) => {
    const { prompt, activeTools } = await composeBrunchPromptForContext(
      pi,
      promptContext,
      ctx as PromptingContextLike | undefined,
      options.directiveAblation,
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
      options.directiveAblation,
    );
    if (prompt.trim().length === 0) return undefined;

    return appendProviderSystemPromptIfMissing((event as BeforeProviderRequestEventLike).payload, prompt);
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
  directiveAblation: 'warrant-before-commit' | undefined,
): Promise<{ prompt: string; activeTools: string[] }> {
  const resolvedPromptContext = await resolvePromptContext(promptContext);
  const branch = ctx?.sessionManager?.getBranch() ?? [];
  const state = projectBrunchAgentState(branch);
  const activeTools =
    typeof (pi as Partial<ExtensionAPI>).getAllTools === 'function'
      ? activeToolNamesForBrunchAgentState(pi, state)
      : [];
  const elicitationStyle = latestElicitationStyle(branch);
  const prompt = composeForegroundRuntimePrompt({
    sessionState: state.agentRole === 'elicitor' && elicitationStyle ? { ...state, elicitationStyle } : state,
    spec: resolvedPromptContext.spec,
    workspace: resolvedPromptContext.workspace,
    ...(resolvedPromptContext.context ? { context: resolvedPromptContext.context } : {}),
    activeTools,
    ...(state.agentRole === 'elicitor' && directiveAblation ? { directiveAblation } : {}),
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
