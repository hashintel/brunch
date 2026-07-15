import { readFileSync } from 'node:fs';

import { PROJECT_EXECUTION_HARNESS_TITLE } from '../../../graph/schema/nodes.js';
import { operationalModeLabel, type OperationalModeId } from '../../../session/schema/kinds.js';
import type {
  AgentPromptSpecContext,
  AgentPromptWorkspaceContext,
} from '../../contexts/seeds/turn-context.js';
import { bundledAgentBodyLocation } from '../../prompts/registry.js';
import { renderBrunchReferences } from '../../references/registry.js';
import { renderBrunchSkills } from '../../skills/registry.js';
import { renderLiveElicitorContext, type LiveElicitorPushedContext } from './context.js';

export interface LiveElicitorSessionState {
  readonly operationalMode: OperationalModeId;
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
    renderProjectExecutionHarnessGuidance(),
    renderLiveElicitorControl(input),
    renderBrunchSkills(),
    renderBrunchReferences(),
    renderLiveElicitorContext(input),
  ]);
  return { prompt };
}

function readLiveElicitorBody(): string {
  return readFileSync(bundledAgentBodyLocation('elicitor'), 'utf8');
}

function renderProjectExecutionHarnessGuidance(): string {
  return [
    '[Brunch execution harness authority]',
    `Before committing an execution-facing scope, require one settled \`oracle/vv_method\` named \`${PROJECT_EXECUTION_HARNESS_TITLE}\`.`,
    'If none exists, ask one focused question: "What command should Brunch run to verify the implementation?"',
    'Preserve the accepted answer as a plain argv recipe line in that node: `execute.verify: <command>`.',
    'Capture `execute.setup:` and `execute.build:` in the same node only when the user specifies them.',
    'Never infer or silently accept a command from workspace files; detected conventions may be offered as suggestions, but the user must approve the recipe.',
    'Reject shell composition (`&&`, pipes, redirects, expansion, or quoted shell fragments) and ask for one plain command per line.',
  ].join('\n');
}

function assertLiveElicitorState(state: LiveElicitorSessionState): void {
  if (state.operationalMode !== 'specify' || state.agentRole !== 'elicitor') {
    throw new Error(
      `Live elicitor prompt requires specify/elicitor state, received ${state.operationalMode}/${state.agentRole}.`,
    );
  }
}

function renderLiveElicitorControl(input: ComposeLiveElicitorPromptInput): string {
  const tools = input.activeTools?.join(', ') || 'none';
  return [
    '[Brunch live elicitor control]',
    '- product mode: Specify',
    `- operational mode id: ${input.sessionState.operationalMode} (${operationalModeLabel(input.sessionState.operationalMode)})`,
    `- foreground role: ${input.sessionState.agentRole}`,
    `- active tools: ${tools}`,
    '- prompt resources: code-owned live skill and shared reference lists only; no runtime axis negotiation',
  ].join('\n');
}

function joinSections(sections: readonly string[]): string {
  return sections
    .map((section) => section.trim())
    .filter(Boolean)
    .join('\n\n');
}
