import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

import {
  composeAgentPrompt,
  renderCwdContext,
  renderGraphContext,
  type AgentPromptSessionContext,
  type AgentPromptSnapshotContext,
  type AgentPromptSpecContext,
  type AgentPromptWorkspaceContext,
} from '../../agents/index.js';
import type { GraphSnapshotReaders } from './graph/index.js';
import { activeToolNamesForBrunchAgentState, projectBrunchAgentState } from './operational-mode.js';

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

export interface BrunchPromptContext {
  spec: AgentPromptSpecContext;
  workspace: AgentPromptWorkspaceContext;
  session?: AgentPromptSessionContext;
  snapshots?: AgentPromptSnapshotContext;
  graphSnapshots?: GraphSnapshotReaders;
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
  promptContext: BrunchPromptContextProvider | undefined,
): void {
  if (!supportsPrompting(pi)) return;

  pi.on('before_agent_start', async (event, ctx) => {
    if (!promptContext) {
      throw new Error('Brunch prompting requires selected spec and workspace context.');
    }

    const resolvedPromptContext = await resolvePromptContext(promptContext);
    const state = projectState(ctx as BeforeAgentStartContextLike | undefined);
    const activeTools =
      typeof (pi as Partial<ExtensionAPI>).getAllTools === 'function'
        ? activeToolNamesForBrunchAgentState(pi, state, resolvedPromptContext.spec.readinessGrade)
        : [];
    if (typeof (pi as Partial<ExtensionAPI>).setActiveTools === 'function') {
      pi.setActiveTools(activeTools);
    }
    const snapshots = snapshotsForPromptContext(resolvedPromptContext, state);
    const { prompt } = composeAgentPrompt({
      agentId: state.agentRole,
      sessionState: state,
      spec: resolvedPromptContext.spec,
      workspace: resolvedPromptContext.workspace,
      snapshots,
      activeTools,
    });

    if (prompt.trim().length === 0) return undefined;

    const basePrompt = (event as BeforeAgentStartEventLike).systemPrompt ?? '';
    return {
      systemPrompt: `${basePrompt}\n\n${prompt}`,
    };
  });
}

function snapshotsForPromptContext(
  context: BrunchPromptContext,
  state: ReturnType<typeof projectState>,
): AgentPromptSnapshotContext {
  const renderedContexts = [
    renderCwdContext({
      spec: context.spec,
      workspace: context.workspace,
      ...(context.session ? { session: context.session } : {}),
    }),
  ];
  if (context.graphSnapshots) {
    renderedContexts.push(
      renderGraphContext(context.graphSnapshots.getGraphOverview(), { lens: state.agentLens }),
    );
  }

  return {
    ...(context.snapshots?.contextHandles ? { contextHandles: context.snapshots.contextHandles } : {}),
    renderedContexts: [...(context.snapshots?.renderedContexts ?? []), ...renderedContexts],
  };
}

async function resolvePromptContext(
  promptContext: BrunchPromptContextProvider,
): Promise<BrunchPromptContext> {
  return typeof promptContext === 'function' ? promptContext() : promptContext;
}

export default registerBrunchPrompting;
