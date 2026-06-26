import { selectElicitationGap } from '../../graph/elicitation-driver.js';
import type { ElicitationGap } from '../../graph/schema/elicitation-gaps.js';
import type { ResolvedBrunchAgentState } from '../../projections/session/runtime-state.js';
import type { AgentPromptSpecContext, AgentPromptWorkspaceContext } from '../contexts/seeds/turn-context.js';
import { renderSoftReadinessEstimate } from '../contexts/session/readiness-estimate.js';
import { renderBrunchSkills, type PromptManifests } from './prompt-skills.js';
import { manifestsForState } from './state.js';

export interface AgentPromptContextBundle {
  contextHandles?: readonly string[];
  renderedContexts?: readonly string[];
}

export interface ComposeAgentPromptInput {
  agentId: ResolvedBrunchAgentState['agentRole'];
  sessionState: ResolvedBrunchAgentState;
  spec: AgentPromptSpecContext;
  workspace: AgentPromptWorkspaceContext;
  context?: AgentPromptContextBundle;
  activeTools?: readonly string[];
  gaps: readonly ElicitationGap[];
  agentBody?: string;
}

export interface ComposeAgentPromptResult {
  prompt: string;
  manifests: PromptManifests;
}

export function composeAgentPrompt(input: ComposeAgentPromptInput): ComposeAgentPromptResult {
  if (input.agentId !== input.sessionState.agentRole) {
    throw new Error(
      `Prompt agent "${String(input.agentId)}" does not match runtime-derived role "${String(input.sessionState.agentRole)}".`,
    );
  }

  const definition = input.sessionState.agentRoleDefinition;
  const manifests = manifestsForState(input.sessionState, input.gaps);
  const prompt = joinSections([
    input.agentBody ?? '',
    renderAgentControl(input, definition),
    renderRuntimeState(input),
    renderElicitorOnlySection(input, renderElicitationRecommendation(input)),
    renderPushedContext(input.context),
    renderElicitorOnlySection(input, renderBrunchSkills(manifests)),
    renderElicitorOnlySection(input, renderRouterRules(input.sessionState)),
  ]);

  return { prompt, manifests };
}

function renderAgentControl(
  input: ComposeAgentPromptInput,
  definition: ResolvedBrunchAgentState['agentRoleDefinition'],
): string {
  const tools = input.activeTools?.join(', ') || 'none';
  return [
    '[Brunch agent control]',
    `- agent: ${definition.id}`,
    `- foreground role: ${input.sessionState.agentRole} (derived from op_mode=${input.sessionState.operationalMode})`,
    `- model: ${definition.model}; thinking: ${definition.thinking}`,
    `- tool authority: ${definition.toolAuthority}`,
    `- active tools: ${tools}`,
  ].join('\n');
}

function renderRuntimeState(input: ComposeAgentPromptInput): string {
  return [
    '[Brunch runtime state]',
    `- op_mode: ${input.sessionState.operationalMode}`,
    `- prompt strategy resource: ${input.sessionState.agentStrategy}`,
    `- prompt lens resource: ${input.sessionState.agentLens}`,
    `- spec: ${input.spec.name} (#${input.spec.id}), ${renderSoftReadinessEstimate(input.gaps)}`,
    `- workspace: ${input.workspace.cwd}`,
    `- workspace posture: ${renderPosture(input.workspace.posture)}`,
  ].join('\n');
}

function renderPosture(posture: AgentPromptWorkspaceContext['posture']): string {
  if (!posture) return 'unrecorded';
  const entries = Object.entries(posture).filter((entry): entry is [string, string] =>
    Boolean(entry[1]?.trim()),
  );
  return entries.length > 0 ? entries.map(([key, value]) => `${key}=${value}`).join('; ') : 'unrecorded';
}

function renderElicitorOnlySection(input: ComposeAgentPromptInput, section: string): string {
  return input.sessionState.agentRole === 'elicitor' ? section : '';
}

function renderElicitationRecommendation(input: ComposeAgentPromptInput): string {
  const gap = selectElicitationGap(input.gaps, input.sessionState);
  if (!gap) return '';
  return [
    '[Brunch elicitation recommendation]',
    `- next question: ${oneLine(gap.question)}`,
    `- refers to: ${gap.refersTo}`,
    `- rationale: ${oneLine(gap.rationale)}`,
  ].join('\n');
}

function oneLine(value: string): string {
  return value.trim().replaceAll(/\s+/g, ' ');
}

function renderPushedContext(context: AgentPromptContextBundle | undefined): string {
  const handles = context?.contextHandles ?? [];
  const renderedContexts = context?.renderedContexts ?? [];
  return [
    '[Brunch pushed context]',
    ...(handles.length ? handles.map((handle) => `- handle: ${handle}`) : ['- handles: none pushed']),
    ...(renderedContexts.length
      ? ['- rendered context blocks:', ...renderedContexts.map(indentBlock)]
      : ['- rendered context blocks: none pushed']),
  ].join('\n');
}

function indentBlock(value: string): string {
  return value
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n');
}

function renderRouterRules(state: ResolvedBrunchAgentState): string {
  return [
    '[Brunch prompt-resource routing]',
    '- Use only resources advertised in <brunch-skills>; do not infer availability from the filesystem.',
    '- Strategy and lens names are prompt-resource routing hints, not user-changeable session identity or stored foreground-agent roles.',
    '- When AUTO exposes several strategy or lens resources, choose at most one advertised resource of each kind, then read the selected resource before applying detailed behavior.',
    '- Methods compose freely when advertised; read a method skill when that mechanism is relevant to the next turn.',
    '- For code-selected singleton resources, that singleton is the selected resource.',
    `- Current prompt-resource selection: strategy=${state.agentStrategy}; lens=${state.agentLens}.`,
  ].join('\n');
}

function joinSections(sections: readonly string[]): string {
  return sections
    .map((section) => section.trim())
    .filter(Boolean)
    .join('\n\n');
}
