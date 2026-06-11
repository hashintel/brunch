import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

import {
  composeAgentPrompt,
  renderCwdContext,
  renderGraphContext,
  type AgentPromptSessionContext,
  type AgentPromptContextBundle,
  type AgentPromptSpecContext,
  type AgentPromptWorkspaceContext,
} from '../../agents/index.js';
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
  session?: AgentPromptSessionContext;
  context?: AgentPromptContextBundle;
  graphReads?: GraphReaders;
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
        ? activeToolNamesForBrunchAgentState(
            pi,
            state,
            resolvedPromptContext.spec.readinessGrade,
            options.devAllowedToolNames,
          )
        : [];
    if (typeof (pi as Partial<ExtensionAPI>).setActiveTools === 'function') {
      pi.setActiveTools(activeTools);
    }
    const context = contextForPrompt(resolvedPromptContext, state);
    const { prompt } = composeAgentPrompt({
      agentId: state.agentRole,
      sessionState: state,
      spec: resolvedPromptContext.spec,
      workspace: resolvedPromptContext.workspace,
      context,
      activeTools,
    });

    if (prompt.trim().length === 0) return undefined;

    const basePrompt = (event as BeforeAgentStartEventLike).systemPrompt ?? '';
    return {
      systemPrompt: `${basePrompt}\n\n${prompt}`,
    };
  });
}

function contextForPrompt(
  context: BrunchPromptContext,
  state: ReturnType<typeof projectState>,
): AgentPromptContextBundle {
  const renderedContexts = [
    renderCwdContext({
      spec: context.spec,
      workspace: context.workspace,
      ...(context.session ? { session: context.session } : {}),
    }),
  ];
  if (context.graphReads) {
    renderedContexts.push(renderGraphContext(context.graphReads.queryGraph(), { lens: state.agentLens }));
  }

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
