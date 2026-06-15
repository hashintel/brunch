import { selectElicitationGap } from '../../../graph/elicitation-driver.js';
import type { ElicitationGap } from '../../../graph/schema/elicitation-gaps.js';
import { READINESS_BANDS } from '../../../graph/schema/kinds.js';
import { readinessEstimate } from '../../../projections/session/readiness-estimate.js';
import type { ResolvedBrunchAgentState } from '../../../projections/session/runtime-state.js';
import type { WorkspacePostureState } from '../../../session/workspace-session-coordinator.js';
import { AGENT_PROMPT_DEFINITIONS, manifestsForState, type PromptManifests } from '../runtime/state.js';

export interface AgentPromptSpecContext {
  id: number;
  name: string;
}

export interface AgentPromptWorkspaceContext {
  cwd: string;
  posture?: Partial<WorkspacePostureState>;
}

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

  const definition = AGENT_PROMPT_DEFINITIONS[input.agentId];
  const manifests = manifestsForState(input.sessionState, input.gaps);
  const prompt = joinSections([
    renderAgentControl(input, definition),
    renderRuntimeState(input),
    renderElicitationRecommendation(input),
    renderPushedContext(input.context),
    renderManifestFamily('available_goals', manifests.goals),
    renderManifestFamily('available_strategies', manifests.strategies),
    renderManifestFamily('available_lenses', manifests.lenses),
    renderManifestFamily('available_methods', manifests.methods),
    renderRouterRules(input.sessionState),
  ]);

  return { prompt, manifests };
}

function renderAgentControl(
  input: ComposeAgentPromptInput,
  definition: (typeof AGENT_PROMPT_DEFINITIONS)[ComposeAgentPromptInput['agentId']],
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
    `- goal: ${input.sessionState.agentGoal}`,
    `- strategy: ${input.sessionState.agentStrategy}`,
    `- lens: ${input.sessionState.agentLens}`,
    `- spec: ${input.spec.name} (#${input.spec.id}), ${renderSoftReadinessEstimate(input.gaps)}`,
    `- workspace: ${input.workspace.cwd}`,
    `- workspace posture: ${renderPosture(input.workspace.posture)}`,
  ].join('\n');
}

export function renderSoftReadinessEstimate(gaps: readonly ElicitationGap[]): string {
  const estimate = readinessEstimate(gaps);
  const coverage = READINESS_BANDS.map((band) => `${band}=${estimate.coverage[band].toFixed(2)}`).join(', ');
  return `readiness estimate (soft; gates nothing): ${coverage}`;
}

function renderPosture(posture: AgentPromptWorkspaceContext['posture']): string {
  if (!posture) return 'unrecorded';
  const entries = Object.entries(posture).filter((entry): entry is [string, string] =>
    Boolean(entry[1]?.trim()),
  );
  return entries.length > 0 ? entries.map(([key, value]) => `${key}=${value}`).join('; ') : 'unrecorded';
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

function renderManifestFamily(tag: string, entries: PromptManifests[keyof PromptManifests]): string {
  return [
    `<${tag}>`,
    ...entries.map(
      (entry) =>
        `  <resource name="${escapeXml(entry.name)}" description="${escapeXml(entry.description)}" location="${escapeXml(entry.location)}" />`,
    ),
    `</${tag}>`,
  ].join('\n');
}

function renderRouterRules(state: ResolvedBrunchAgentState): string {
  return [
    '[Brunch prompt-resource routing]',
    '- Use only resources advertised in the manifests above; do not infer availability from the filesystem.',
    '- For AUTO axes, choose from the current manifest and read the selected resource before applying detailed behavior.',
    '- For pinned axes, the singleton manifest entry is the selected resource.',
    `- Current pins: goal=${state.agentGoal}; strategy=${state.agentStrategy}; lens=${state.agentLens}.`,
  ].join('\n');
}

function joinSections(sections: readonly string[]): string {
  return sections
    .map((section) => section.trim())
    .filter(Boolean)
    .join('\n\n');
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}
