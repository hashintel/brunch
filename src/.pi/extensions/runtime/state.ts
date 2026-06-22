import { basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadSkills, type Skill } from '@earendil-works/pi-coding-agent';

import type { ElicitationGap } from '../../../graph/schema/elicitation-gaps.js';
import type { CapabilityId } from '../../../projections/session/capability-readiness.js';
import {
  AUTO_EXCLUDED_STRATEGIES,
  axisOptionsForRuntimeState,
  isCapabilityLegalForGaps,
  toolPolicyForRuntimeState,
  type ResolvedBrunchAgentState,
} from '../../../projections/session/runtime-policy.js';
import type { AgentLensId, AgentRoleId, AgentStrategyId } from '../../../session/schema/kinds.js';
type PromptResourceFamily = 'strategies' | 'lenses' | 'methods';
export type MethodId =
  | 'run-structured-exchange'
  | 'capture'
  | 'commit-graph'
  | 'elicit-by-question'
  | 'ingest-paste'
  | 'read-referenced-documents'
  | 'explore-and-characterize'
  | 'read-context'
  | 'generate-proposal'
  | 'review-for-gaps';

export interface PromptResourceManifestEntry {
  name: string;
  description: string;
  location: string;
}

export interface AgentPromptDefinition {
  id: AgentRoleId;
  description: string;
  model: string;
  thinking: 'low' | 'medium' | 'high';
  toolAuthority: string;
  allowedStrategies: readonly AgentStrategyId[];
  allowedLenses: readonly AgentLensId[];
  allowedMethods: readonly MethodId[];
}

export interface PromptManifests {
  strategies: readonly PromptResourceManifestEntry[];
  lenses: readonly PromptResourceManifestEntry[];
  methods: readonly PromptResourceManifestEntry[];
}

export interface BrunchPostureToolPolicyInput {
  registeredToolNames: readonly string[];
  state: ResolvedBrunchAgentState;
  gaps: readonly ElicitationGap[];
  devAllowedToolNames?: readonly string[] | undefined;
}

const METHOD_CAPABILITY: Partial<Record<MethodId, CapabilityId>> = {
  'commit-graph': 'propose-graph',
  'generate-proposal': 'project-graph',
  'review-for-gaps': 'commitment-review',
};

const METHOD_TOOL_NAMES: Partial<Record<MethodId, readonly string[]>> = {
  'run-structured-exchange': [
    'present_question',
    'present_options',
    'request_answer',
    'request_choice',
    'request_choices',
  ],
  capture: ['update_elicitation_gaps', 'update_reconciliation_needs'],
  'read-context': [
    'read_graph',
    'read_session_context',
    'read_elicitation_gaps',
    'read_reconciliation_needs',
  ],
  'commit-graph': ['mutate_graph'],
  'generate-proposal': ['present_review_set', 'request_review'],
};

export const AGENT_PROMPT_DEFINITIONS: Record<AgentRoleId, AgentPromptDefinition> = {
  elicitor: {
    id: 'elicitor',
    description:
      'Foreground Brunch session agent that elicits, disambiguates, and captures selected-spec intent.',
    model: 'default',
    thinking: 'medium',
    toolAuthority:
      'elicit read-only; graph writes only through Brunch graph tools when legal methods allow them',
    allowedStrategies: ['freestyle', 'step-wise-decision-tree', 'step-wise-disambiguate'],
    allowedLenses: ['intent', 'design', 'oracle'],
    allowedMethods: [
      'run-structured-exchange',
      'capture',
      'commit-graph',
      'elicit-by-question',
      'ingest-paste',
      'read-referenced-documents',
      'explore-and-characterize',
      'read-context',
      'generate-proposal',
      'review-for-gaps',
    ],
  },
};

const STRATEGY_IDS = [
  'freestyle',
  'step-wise-decision-tree',
  'step-wise-disambiguate',
] as const satisfies readonly AgentStrategyId[];
const LENS_IDS = ['intent', 'design', 'oracle'] as const satisfies readonly AgentLensId[];
const METHOD_IDS = [
  'run-structured-exchange',
  'capture',
  'commit-graph',
  'elicit-by-question',
  'ingest-paste',
  'read-referenced-documents',
  'explore-and-characterize',
  'read-context',
  'generate-proposal',
  'review-for-gaps',
] as const satisfies readonly MethodId[];

export const STRATEGY_RESOURCES = loadPromptResourceManifestEntries('strategies', STRATEGY_IDS);
export const LENS_RESOURCES = loadPromptResourceManifestEntries('lenses', LENS_IDS);
export const METHOD_RESOURCES = loadPromptResourceManifestEntries('methods', METHOD_IDS);

export function manifestsForState(
  state: ResolvedBrunchAgentState,
  gaps: readonly ElicitationGap[],
): PromptManifests {
  const definition = AGENT_PROMPT_DEFINITIONS[state.agentRole];
  if (!definition) {
    throw new Error(`Unknown Brunch agent "${state.agentRole}".`);
  }
  if (definition.id !== state.agentRole || state.operationalMode !== 'elicit') {
    throw new Error(
      `Agent "${state.agentRole}" is not legal in operational mode "${state.operationalMode}".`,
    );
  }

  return {
    strategies: selectAxisResources({
      label: 'strategy',
      selection: state.agentStrategy,
      allowed: definition.allowedStrategies,
      resources: STRATEGY_RESOURCES,
      legalIds: axisOptionsForRuntimeState('strategy', state, gaps),
      state,
      autoExcluded: AUTO_EXCLUDED_STRATEGIES,
    }),
    lenses: selectAxisResources({
      label: 'lens',
      selection: state.agentLens,
      allowed: definition.allowedLenses,
      resources: LENS_RESOURCES,
      legalIds: axisOptionsForRuntimeState('lens', state, gaps),
      state,
    }),
    methods: methodIdsForState(state, gaps).map((method) => METHOD_RESOURCES[method]),
  };
}

export function methodIdsForState(
  state: ResolvedBrunchAgentState,
  gaps: readonly ElicitationGap[],
): readonly MethodId[] {
  const definition = AGENT_PROMPT_DEFINITIONS[state.agentRole];
  if (
    !definition ||
    definition.id !== state.agentRole ||
    state.operationalMode !== 'elicit' ||
    gaps.length === 0
  )
    return [];
  return definition.allowedMethods.filter((method) =>
    isCapabilityLegalForGaps(METHOD_CAPABILITY[method], gaps),
  );
}

export function activeToolNamesForPosture({
  registeredToolNames,
  state,
  gaps,
  devAllowedToolNames = [],
}: BrunchPostureToolPolicyInput): string[] {
  const toolPolicy = toolPolicyForRuntimeState(state);
  const legalTools = new Set<string>(toolPolicy.baseAllowedToolNames);
  for (const method of methodIdsForState(state, gaps)) {
    for (const toolName of METHOD_TOOL_NAMES[method] ?? []) {
      legalTools.add(toolName);
    }
  }
  for (const toolName of devAllowedToolNames) {
    legalTools.add(toolName);
  }

  const blockedTools = new Set<string>(toolPolicy.blockedToolNames);

  return registeredToolNames.filter((toolName) => legalTools.has(toolName) && !blockedTools.has(toolName));
}

function selectAxisResources<TId extends string>({
  label,
  selection,
  allowed,
  resources,
  legalIds,
  state,
  autoExcluded,
}: {
  label: 'strategy' | 'lens';
  selection: 'auto' | TId;
  allowed: readonly TId[];
  resources: Record<TId, PromptResourceManifestEntry>;
  legalIds: readonly TId[];
  state: ResolvedBrunchAgentState;
  autoExcluded?: ReadonlySet<TId>;
}): readonly PromptResourceManifestEntry[] {
  const legal = allowed.filter((id) => legalIds.includes(id));
  if (selection === 'auto') {
    return legal.filter((id) => !autoExcluded?.has(id)).map((id) => resources[id]);
  }
  if (!allowed.includes(selection)) {
    throw new Error(
      `Pinned ${label} "${selection}" is not allowed for ${state.agentRole} in ${state.operationalMode}.`,
    );
  }
  // User/system pins are authority signals. When readiness negotiates, keep the
  // pinned axis visible and let method/tool legality carry the negotiation
  // boundary instead of crashing prompt assembly.
  return [resources[selection]];
}

export function agentBodyResourceLocation(agentId: AgentRoleId): string {
  return fileURLToPath(new URL(`../../agents/${agentId}/SYSTEM.md`, import.meta.url));
}

function promptResourceLocation(family: PromptResourceFamily, id: string): string {
  return fileURLToPath(new URL(`../../skills/${family}/${id}/SKILL.md`, import.meta.url));
}

function loadPromptResourceManifestEntries<TId extends string>(
  family: PromptResourceFamily,
  ids: readonly TId[],
): Record<TId, PromptResourceManifestEntry> {
  const skillPaths = ids.map((id) => promptResourceLocation(family, id));
  const result = loadSkills({
    cwd: process.cwd(),
    agentDir: fileURLToPath(new URL('../../', import.meta.url)),
    skillPaths,
    includeDefaults: false,
  });

  const warnings = result.diagnostics.map((diagnostic) => `${diagnostic.path}: ${diagnostic.message}`);
  if (warnings.length > 0) {
    throw new Error(`Invalid Brunch prompt-resource skill metadata:\n${warnings.join('\n')}`);
  }

  const byName = new Map(result.skills.map((skill) => [skill.name, skill]));
  return Object.fromEntries(
    ids.map((id) => [id, skillToPromptResourceManifestEntry(family, id, byName.get(id))]),
  ) as Record<TId, PromptResourceManifestEntry>;
}

function skillToPromptResourceManifestEntry(
  family: PromptResourceFamily,
  expectedId: string,
  skill: Skill | undefined,
): PromptResourceManifestEntry {
  if (!skill) {
    throw new Error(`Missing Brunch prompt-resource skill metadata for ${family}/${expectedId}.`);
  }
  const parentDir = basename(dirname(skill.filePath));
  if (skill.name !== expectedId || parentDir !== expectedId) {
    throw new Error(
      `Brunch prompt-resource skill ${family}/${expectedId} must have name == parent directory; got name=${skill.name}, dir=${parentDir}.`,
    );
  }
  return {
    name: skill.name,
    description: skill.description,
    location: skill.filePath,
  };
}
