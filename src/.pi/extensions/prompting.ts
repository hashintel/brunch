import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

import { composeBrunchPrompt } from '../context/compose-brunch-prompt.js';
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

function supportsPrompting(pi: ExtensionAPI): boolean {
  return typeof (pi as Partial<ExtensionAPI>).on === 'function';
}

function projectState(ctx: BeforeAgentStartContextLike | undefined) {
  return projectBrunchAgentState(ctx?.sessionManager?.getEntries() ?? []);
}

export function registerBrunchPrompting(pi: ExtensionAPI): void {
  if (!supportsPrompting(pi)) return;

  pi.on('before_agent_start', async (event, ctx) => {
    const state = projectState(ctx as BeforeAgentStartContextLike | undefined);
    const activeTools =
      typeof (pi as Partial<ExtensionAPI>).getAllTools === 'function'
        ? activeToolNamesForBrunchAgentState(pi, state)
        : [];
    const { prompt } = composeBrunchPrompt({
      operationalMode: state.operationalMode,
      agentRole: state.agentRole,
      agentStrategy: state.agentStrategy,
      agentLens: state.agentLens,
      agentGoal: state.agentGoal,
      activeTools,
    });

    if (prompt.trim().length === 0) return undefined;

    const basePrompt = (event as BeforeAgentStartEventLike).systemPrompt ?? '';
    return {
      systemPrompt: `${basePrompt}\n\n${prompt}`,
    };
  });
}

export default registerBrunchPrompting;
