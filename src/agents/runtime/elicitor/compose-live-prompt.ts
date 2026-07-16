import { createHash } from 'node:crypto';
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
  /** Dev/eval-only selection; product composition never supplies this. */
  readonly directiveAblation?: 'warrant-before-commit';
}

export interface ComposeLiveElicitorPromptResult {
  readonly prompt: string;
}
const DIRECTIVE_ID = 'warrant-before-commit' as const;
const START = `<!-- brunch-directive:${DIRECTIVE_ID}:start -->`;
const END = `<!-- brunch-directive:${DIRECTIVE_ID}:end -->`;
const bundledDirective = directiveBlock(readLiveElicitorBody());

export const LIVE_ELICITOR_DIRECTIVES = {
  [DIRECTIVE_ID]: {
    id: DIRECTIVE_ID,
    hash: directiveHash(readLiveElicitorBody()),
    providerVisibleText: bundledDirective.paragraph,
  },
} as const;
export function composeLiveElicitorPrompt(
  input: ComposeLiveElicitorPromptInput,
): ComposeLiveElicitorPromptResult {
  assertLiveElicitorState(input.sessionState);
  const prompt = joinSections([
    projectAgentBody(input.agentBody ?? readLiveElicitorBody(), input.directiveAblation),
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

function directiveBlock(body: string): { paragraph: string; full: string } {
  const start = body.indexOf(START);
  const end = body.indexOf(END);
  if (start < 0 || end <= start || body.indexOf(START, start + 1) >= 0 || body.indexOf(END, end + 1) >= 0) {
    throw new Error(`Live elicitor body must contain exactly one ${DIRECTIVE_ID} directive block.`);
  }
  const paragraph = body.slice(start + START.length, end).trim();
  if (!paragraph.startsWith('When a commitment is ready')) {
    throw new Error(`${DIRECTIVE_ID} directive content drifted from its stable opening.`);
  }
  return { paragraph, full: body.slice(start, end + END.length) };
}

function projectAgentBody(
  body: string,
  ablation: ComposeLiveElicitorPromptInput['directiveAblation'],
): string {
  if (!body.includes(START) && !body.includes(END)) {
    if (ablation) throw new Error(`Cannot ablate missing ${DIRECTIVE_ID} directive block.`);
    return body;
  }
  const block = directiveBlock(body);
  return body.replace(block.full, ablation === DIRECTIVE_ID ? '' : block.paragraph);
}

function directiveHash(body: string): string {
  return `sha256:${createHash('sha256').update(directiveBlock(body).paragraph).digest('hex')}`;
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
