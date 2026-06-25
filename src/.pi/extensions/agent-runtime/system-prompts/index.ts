import { readFile } from 'node:fs/promises';

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

import {
  composeAgentContextSeed,
  type AgentPromptSessionContext,
  type AgentPromptSpecContext,
  type AgentPromptWorkspaceContext,
} from '../../../../session/agent-context-seed.js';
import type { GraphReaders } from '../../brunch-data/graph/index.js';
import {
  activeToolNamesForBrunchAgentState,
  agentBodyResourceLocation,
  projectBrunchAgentState,
} from '../runtime/index.js';
import { composeAgentPrompt, type AgentPromptContextBundle } from './compose.js';
import { createWorldReadCache, type WorldReads } from './world-reads.js';

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

  const worldReadCache = createWorldReadCache();

  pi.on('before_agent_start', async (event, ctx) => {
    const resolvedPromptContext = await resolvePromptContext(promptContext);

    const state = projectState(ctx as BeforeAgentStartContextLike | undefined);
    const agentBody = await readAgentBody(state.agentRole);
    const world = worldReadCache.read(resolvedPromptContext.graphReads, resolvedPromptContext.spec.id);
    const activeTools =
      typeof (pi as Partial<ExtensionAPI>).getAllTools === 'function'
        ? activeToolNamesForBrunchAgentState(pi, state, world.gaps, options.devAllowedToolNames)
        : [];
    if (typeof (pi as Partial<ExtensionAPI>).setActiveTools === 'function') {
      pi.setActiveTools(activeTools);
    }
    const context = contextForPrompt(resolvedPromptContext, state, world);
    const { prompt } = composeAgentPrompt({
      agentId: state.agentRole,
      sessionState: state,
      spec: resolvedPromptContext.spec,
      workspace: resolvedPromptContext.workspace,
      context,
      activeTools,
      gaps: world.gaps,
      agentBody,
    });

    if (prompt.trim().length === 0) return undefined;

    const basePrompt = (event as BeforeAgentStartEventLike).systemPrompt ?? '';
    return {
      systemPrompt: `${basePrompt}\n\n${prompt}`,
    };
  });
}

async function readAgentBody(agentId: ReturnType<typeof projectState>['agentRole']): Promise<string> {
  return readFile(agentBodyResourceLocation(agentId), 'utf8');
}

function contextForPrompt(
  context: BrunchPromptContext,
  state: ReturnType<typeof projectState>,
  world: WorldReads,
): AgentPromptContextBundle {
  const renderedContexts = composeAgentContextSeed({
    spec: context.spec,
    workspace: context.workspace,
    ...(context.session ? { session: context.session } : {}),
    gaps: world.gaps,
    graph: world.graph,
    lens: state.agentLens,
  });

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
