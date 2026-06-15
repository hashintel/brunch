import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

import type { ElicitationGap } from '../../../graph/schema/elicitation-gaps.js';
import {
  composeAgentPrompt,
  type AgentPromptContextBundle,
  type AgentPromptSpecContext,
  type AgentPromptWorkspaceContext,
} from './compose.js';
import { renderWorkspaceSeed, type AgentPromptSessionContext } from './seed/workspace.js';
import { renderGraphSeed } from './seed/graph.js';
import type { GraphReaders } from '../graph/index.js';
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
  context?: AgentPromptContextBundle;
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
    const gaps = gapsForPrompt(resolvedPromptContext);
    const activeTools =
      typeof (pi as Partial<ExtensionAPI>).getAllTools === 'function'
        ? activeToolNamesForBrunchAgentState(pi, state, gaps, options.devAllowedToolNames)
        : [];
    if (typeof (pi as Partial<ExtensionAPI>).setActiveTools === 'function') {
      pi.setActiveTools(activeTools);
    }
    const context = contextForPrompt(resolvedPromptContext, state, gaps);
    const { prompt } = composeAgentPrompt({
      agentId: state.agentRole,
      sessionState: state,
      spec: resolvedPromptContext.spec,
      workspace: resolvedPromptContext.workspace,
      context,
      activeTools,
      gaps,
    });

    if (prompt.trim().length === 0) return undefined;

    const basePrompt = (event as BeforeAgentStartEventLike).systemPrompt ?? '';
    return {
      systemPrompt: `${basePrompt}\n\n${prompt}`,
    };
  });
}

function gapsForPrompt(context: BrunchPromptContext): readonly ElicitationGap[] {
  return context.graphReads.getElicitationGaps(context.spec.id);
}

function contextForPrompt(
  context: BrunchPromptContext,
  state: ReturnType<typeof projectState>,
  gaps: readonly ElicitationGap[],
): AgentPromptContextBundle {
  const renderedContexts = [
    renderWorkspaceSeed({
      spec: context.spec,
      workspace: context.workspace,
      ...(context.session ? { session: context.session } : {}),
      gaps,
    }),
  ];
  renderedContexts.push(renderGraphSeed(context.graphReads.queryGraph(), { lens: state.agentLens }));

  return {
    ...(context.context?.contextHandles ? { contextHandles: context.context.contextHandles } : {}),
    renderedContexts: [...(context.context?.renderedContexts ?? []), ...renderedContexts],
  };
}

async function resolvePromptContext(
  promptContext: BrunchPromptContextProvider,
): Promise<BrunchPromptContext> {
  return typeof promptContext === 'function' ? promptContext() : promptContext;
}
