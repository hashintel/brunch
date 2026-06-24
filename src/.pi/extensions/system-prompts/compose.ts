import { selectElicitationGap } from '../../../graph/elicitation-driver.js';
import type { ElicitationGap } from '../../../graph/schema/elicitation-gaps.js';
import type { ResolvedBrunchAgentState } from '../../../projections/session/runtime-state.js';
import { renderSoftReadinessEstimate } from '../../../renderers/session/readiness-estimate.js';
import type {
  AgentPromptSpecContext,
  AgentPromptWorkspaceContext,
} from '../../../session/agent-context-seed.js';
import { manifestsForState, type PromptManifests } from '../runtime/state.js';

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
    renderElicitationRecommendation(input),
    renderPushedContext(input.context),
    renderBrunchSkills(manifests),
    renderRouterRules(input.sessionState),
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
    `- strategy: ${input.sessionState.agentStrategy}`,
    `- lens: ${input.sessionState.agentLens}`,
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

function renderBrunchSkills(manifests: PromptManifests): string {
  const entries = [
    ...manifests.strategies.map((entry) => ({ kind: 'strategy', entry })),
    ...manifests.lenses.map((entry) => ({ kind: 'lens', entry })),
    ...manifests.methods.map((entry) => ({ kind: 'method', entry })),
  ] as const;
  if (entries.length === 0) return '';
  return [
    'The following Brunch skills provide specialized instructions for prompt-resource posture.',
    "Use the read tool to load a skill's file when the selected strategy, lens, or method matches its description.",
    'When a skill file references a relative path, resolve it against the skill directory (parent of SKILL.md / dirname of the path) and use that absolute path in tool commands.',
    '',
    '<brunch-skills>',
    ...entries.flatMap(({ kind, entry }) => [
      '  <skill>',
      `    <kind>${kind}</kind>`,
      `    <name>${escapeXml(entry.name)}</name>`,
      `    <description>${escapeXml(entry.description)}</description>`,
      `    <location>${escapeXml(entry.location)}</location>`,
      '  </skill>',
    ]),
    '</brunch-skills>',
  ].join('\n');
}

function renderRouterRules(state: ResolvedBrunchAgentState): string {
  return [
    '[Brunch prompt-resource routing]',
    '- Use only resources advertised in <brunch-skills>; do not infer availability from the filesystem.',
    '- Strategy and lens are AUTO/pinnable axes: choose at most one advertised strategy and at most one advertised lens, then read the selected resource before applying detailed behavior.',
    '- Methods compose freely when advertised; read a method skill when that mechanism is relevant to the next turn.',
    '- For pinned axes, the singleton skill of that kind is the selected resource.',
    `- Current pins: strategy=${state.agentStrategy}; lens=${state.agentLens}.`,
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
