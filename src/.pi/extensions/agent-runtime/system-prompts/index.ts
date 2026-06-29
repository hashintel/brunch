import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

import type { LiveElicitorPushedContext } from '../../../../agents/contexts/live/elicitor-context.js';
import type {
  AgentPromptSessionContext,
  AgentPromptSpecContext,
  AgentPromptWorkspaceContext,
} from '../../../../agents/contexts/seeds/turn-context.js';
import { composeLiveElicitorPrompt } from '../../../../agents/runtime/elicitor/compose-live-prompt.js';
import type { GraphReaders } from '../../brunch-data/graph/index.js';
import { activeToolNamesForBrunchAgentState, projectBrunchAgentState } from '../runtime/index.js';

type BrunchAgentStateEntries = Parameters<typeof projectBrunchAgentState>[0];

interface SessionManagerLike {
  getEntries(): BrunchAgentStateEntries;
}

interface BeforeAgentStartEventLike {
  systemPrompt?: string;
}

interface BeforeAgentStartContextLike {
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

function projectState(ctx: BeforeAgentStartContextLike | undefined) {
  return projectBrunchAgentState(ctx?.sessionManager?.getEntries() ?? []);
}

export function registerBrunchPrompting(
  pi: ExtensionAPI,
  promptContext: BrunchPromptContextProvider,
  options: { devAllowedToolNames?: readonly string[] | undefined } = {},
): void {
  if (!supportsPrompting(pi)) return;

  pi.on('before_agent_start', async (event, ctx) => {
    const resolvedPromptContext = await resolvePromptContext(promptContext);

    const state = projectState(ctx as BeforeAgentStartContextLike | undefined);
    const activeTools =
      typeof (pi as Partial<ExtensionAPI>).getAllTools === 'function'
        ? activeToolNamesForBrunchAgentState(pi, state, undefined, options.devAllowedToolNames)
        : [];
    if (typeof (pi as Partial<ExtensionAPI>).setActiveTools === 'function') {
      pi.setActiveTools(activeTools);
    }
    const prompt = composeLiveElicitorPrompt({
      sessionState: state,
      spec: resolvedPromptContext.spec,
      workspace: resolvedPromptContext.workspace,
      ...(resolvedPromptContext.context ? { context: resolvedPromptContext.context } : {}),
      activeTools,
    }).prompt;

    if (prompt.trim().length === 0) return undefined;

    const basePrompt = (event as BeforeAgentStartEventLike).systemPrompt ?? '';
    return {
      systemPrompt: `${basePrompt}\n\n${prompt}`,
    };
  });
}

async function resolvePromptContext(
  promptContext: BrunchPromptContextProvider,
): Promise<BrunchPromptContext> {
  return typeof promptContext === 'function' ? promptContext() : promptContext;
}
