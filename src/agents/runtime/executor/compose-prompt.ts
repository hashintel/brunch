import { readFileSync } from 'node:fs';

import { bundledAgentBodyLocation } from '../../prompts/registry.js';
import type { ForegroundRuntimePromptInput, ForegroundRuntimePromptResult } from '../foreground-policy.js';

export function composeExecutorPrompt(
  input: ForegroundRuntimePromptInput,
): ForegroundRuntimePromptResult {
  assertExecutorState(input.sessionState);
  return {
    prompt: joinSections([input.agentBody ?? readExecutorBody(), renderExecutorControl(input)]),
  };
}

function assertExecutorState(state: ForegroundRuntimePromptInput['sessionState']): void {
  if (state.operationalMode !== 'execute' || state.agentRole !== 'executor') {
    throw new Error(
      `Executor prompt requires execute/executor state, received ${state.operationalMode}/${state.agentRole}.`,
    );
  }
}

function renderExecutorControl(input: ForegroundRuntimePromptInput): string {
  const tools = input.activeTools?.join(', ') || 'none';
  return [
    '[Brunch executor control]',
    '- target product surface: CODE',
    `- operational mode: ${input.sessionState.operationalMode}`,
    `- foreground role: ${input.sessionState.agentRole}`,
    `- active tools: ${tools}`,
    '- direct shell/edit/write tools stay blocked by Brunch runtime policy',
  ].join('\n');
}

function readExecutorBody(): string {
  return readFileSync(bundledAgentBodyLocation('executor'), 'utf8');
}

function joinSections(sections: readonly string[]): string {
  return sections
    .map((section) => section.trim())
    .filter(Boolean)
    .join('\n\n');
}
