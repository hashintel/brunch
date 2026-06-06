import type { ResolvedBrunchAgentState } from '../../session/runtime-state.js';
import type { WorkspacePostureState } from '../../session/workspace-session-coordinator.js';
import {
  AGENT_PROMPT_DEFINITIONS,
  manifestsForState,
  type PromptManifests,
  type ReadinessGrade,
} from './state.js';

export interface AgentPromptSpecContext {
  id: number;
  name: string;
  readinessGrade: ReadinessGrade;
}

export interface AgentPromptWorkspaceContext {
  cwd: string;
  posture?: Partial<WorkspacePostureState>;
}

export interface AgentPromptSnapshotContext {
  contextHandles?: readonly string[];
  renderedContexts?: readonly string[];
}

export interface ComposeAgentPromptInput {
  agentId: ResolvedBrunchAgentState['agentRole'];
  sessionState: ResolvedBrunchAgentState;
  spec: AgentPromptSpecContext;
  workspace: AgentPromptWorkspaceContext;
  snapshots?: AgentPromptSnapshotContext;
  activeTools?: readonly string[];
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
  const manifests = manifestsForState(input.sessionState, input.spec.readinessGrade);
  const prompt = joinSections([
    renderAgentControl(input, definition),
    renderRuntimeState(input),
    renderPushedContext(input.snapshots),
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
    `- spec: ${input.spec.name} (#${input.spec.id}), readiness_grade=${input.spec.readinessGrade}`,
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

function renderPushedContext(snapshots: AgentPromptSnapshotContext | undefined): string {
  const handles = snapshots?.contextHandles ?? [];
  const renderedContexts = snapshots?.renderedContexts ?? [];
  return [
    '[Brunch pushed context]',
    ...(handles.length ? handles.map((handle) => `- handle: ${handle}`) : ['- handles: none pushed']),
    ...(renderedContexts.length
      ? ['- rendered snapshots:', ...renderedContexts.map(indentBlock)]
      : ['- rendered snapshots: none pushed']),
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
