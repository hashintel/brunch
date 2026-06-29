import { readFileSync } from 'node:fs';

import type {
  AgentPromptSpecContext,
  AgentPromptWorkspaceContext,
} from '../../contexts/seeds/turn-context.js';
import { bundledAgentBodyLocation } from '../../prompts/registry.js';
import { renderLiveElicitorContext, type LiveElicitorPushedContext } from './context.js';

export interface LiveElicitorSessionState {
  readonly operationalMode: string;
  readonly agentRole: string;
}

export interface ComposeLiveElicitorPromptInput {
  readonly sessionState: LiveElicitorSessionState;
  readonly spec: AgentPromptSpecContext;
  readonly workspace: AgentPromptWorkspaceContext;
  readonly context?: LiveElicitorPushedContext;
  readonly activeTools?: readonly string[];
  readonly agentBody?: string;
}

export interface ComposeLiveElicitorPromptResult {
  readonly prompt: string;
}

export function composeLiveElicitorPrompt(
  input: ComposeLiveElicitorPromptInput,
): ComposeLiveElicitorPromptResult {
  assertLiveElicitorState(input.sessionState);
  const prompt = joinSections([
    input.agentBody ?? readLiveElicitorBody(),
    renderLiveElicitorControl(input),
    renderLiveElicitorContext(input),
  ]);
  return { prompt };
}

function readLiveElicitorBody(): string {
  return readFileSync(bundledAgentBodyLocation('elicitor'), 'utf8');
}

function assertLiveElicitorState(state: LiveElicitorSessionState): void {
  if (state.operationalMode !== 'elicit' || state.agentRole !== 'elicitor') {
    throw new Error(
      `Live elicitor prompt requires elicit/elicitor state, received ${state.operationalMode}/${state.agentRole}.`,
    );
  }
}

function renderLiveElicitorControl(input: ComposeLiveElicitorPromptInput): string {
  const tools = input.activeTools?.join(', ') || 'none';
  return [
    '[Brunch live elicitor control]',
    `- operational mode: ${input.sessionState.operationalMode}`,
    `- foreground role: ${input.sessionState.agentRole}`,
    `- active tools: ${tools}`,
    '- prompt resources: fixed live elicitor path; no strategy/lens/method manifest negotiation',
  ].join('\n');
}

function joinSections(sections: readonly string[]): string {
  return sections
    .map((section) => section.trim())
    .filter(Boolean)
    .join('\n\n');
}
