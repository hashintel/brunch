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
import {
  AGENT_LENS_IDS,
  AGENT_METHOD_IDS,
  AGENT_STRATEGY_IDS,
  type AgentMethodId,
  type AgentRoleId,
} from '../../../session/schema/kinds.js';
type PromptResourceFamily = 'strategies' | 'lenses' | 'methods';
export type MethodId = AgentMethodId;

export interface PromptResourceManifestEntry {
  name: string;
  description: string;
  location: string;
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
  // D86-L: graph-write methods are NOT readiness-gated. `mutate_graph` (commit-graph)
  // and the review-set tools (generate-proposal) are floor capabilities in elicit mode
  // whenever gaps exist; readiness is advisory (epistemic scaling + establishment offer),
  // never a tool gate. Gating them created a bootstrap deadlock (a fresh/foundation-light
  // spec could never write its context/thesis/goal/constraint frame). `review-for-gaps`
  // (deliberate audit, grants no graph-write tool) stays gated by commitment-review.
  'review-for-gaps': 'commitment-review',
};

const METHOD_TOOL_NAMES: Partial<Record<MethodId, readonly string[]>> = {
  'run-structured-exchange': ['present_question', 'request_response'],
  capture: ['update_elicitation_gaps', 'update_reconciliation_needs'],
  'read-context': [
    'read_graph',
    'read_session_context',
    'read_elicitation_gaps',
    'read_reconciliation_needs',
  ],
  'commit-graph': ['mutate_graph'],
  'generate-proposal': ['present_review_set', 'request_response'],
};

export const STRATEGY_RESOURCES = loadPromptResourceManifestEntries('strategies', AGENT_STRATEGY_IDS);
export const LENS_RESOURCES = loadPromptResourceManifestEntries('lenses', AGENT_LENS_IDS);
export const METHOD_RESOURCES = loadPromptResourceManifestEntries('methods', AGENT_METHOD_IDS);

export function manifestsForState(
  state: ResolvedBrunchAgentState,
  gaps: readonly ElicitationGap[],
): PromptManifests {
  const definition = state.agentRoleDefinition;
  if (
    definition.kind !== 'foreground' ||
    definition.id !== state.agentRole ||
    definition.operationalMode !== state.operationalMode
  ) {
    throw new Error(
      `Agent "${state.agentRole}" is not legal in operational mode "${state.operationalMode}".`,
    );
  }

  return {
    strategies: selectAxisResources({
      label: 'strategy',
      selection: state.agentStrategy,
      allowed: definition.skills.strategies,
      resources: STRATEGY_RESOURCES,
      legalIds: axisOptionsForRuntimeState('strategy', state, gaps),
      state,
      autoExcluded: AUTO_EXCLUDED_STRATEGIES,
    }),
    lenses: selectAxisResources({
      label: 'lens',
      selection: state.agentLens,
      allowed: definition.skills.lenses,
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
  const definition = state.agentRoleDefinition;
  if (
    definition.kind !== 'foreground' ||
    definition.id !== state.agentRole ||
    definition.operationalMode !== state.operationalMode ||
    gaps.length === 0
  )
    return [];
  return definition.skills.methods.filter((method) =>
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
