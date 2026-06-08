export const BRUNCH_AGENT_RUNTIME_STATE_CUSTOM_TYPE = 'brunch.agent_runtime_state';

export type OperationalModeId = 'elicit';
export type AgentRoleId = 'elicitor';
type AutoAxisSelection = 'auto';
export type AgentStrategyId =
  | 'freestyle'
  | 'step-wise-decision-tree'
  | 'step-wise-disambiguate'
  | 'propose-graph'
  | 'project-graph';
export type AgentStrategySelection = AutoAxisSelection | AgentStrategyId;
export type AgentLensId = 'intent' | 'design' | 'oracle';
export type AgentLensSelection = AutoAxisSelection | AgentLensId;
export type AgentGoalId = 'grounding-advance' | 'elicit-expand' | 'commit-converge' | 'capture-posture';
export type AgentGoalSelection = AutoAxisSelection | AgentGoalId;
export type ToolPolicyId = 'elicit-read-only';
export type PromptPackId = 'brunch-base' | 'elicit' | 'elicitor';
export type ModelPreference = 'default';
export type ThinkingLevel = 'low' | 'medium' | 'high';

export interface BrunchAgentState {
  schemaVersion: 1;
  operationalMode: OperationalModeId;
  agentStrategy: AgentStrategySelection;
  agentLens: AgentLensSelection;
  agentGoal: AgentGoalSelection;
}

export interface BrunchAgentStateEntryData {
  schemaVersion: 1;
  reason: 'init' | 'switch';
  state: BrunchAgentState;
  previous?: BrunchAgentState;
  source: 'system' | 'user' | 'agent' | 'extension';
}

export interface GraphNodeMention {
  id: string;
  handle?: string;
  title?: string;
  seenLsn?: number;
}

export interface FileMention {
  path: string;
  seenGitHead?: string;
}

export const DEFAULT_BRUNCH_AGENT_STATE: BrunchAgentState = {
  schemaVersion: 1,
  operationalMode: 'elicit',
  agentStrategy: 'auto',
  agentLens: 'auto',
  agentGoal: 'grounding-advance',
};

const OPERATIONAL_MODE_IDS: readonly OperationalModeId[] = ['elicit'];
export const AGENT_STRATEGY_IDS: readonly AgentStrategyId[] = [
  'freestyle',
  'step-wise-decision-tree',
  'step-wise-disambiguate',
  'propose-graph',
  'project-graph',
];
const AGENT_LENS_IDS: readonly AgentLensId[] = ['intent', 'design', 'oracle'];
const AGENT_GOAL_IDS: readonly AgentGoalId[] = [
  'grounding-advance',
  'elicit-expand',
  'commit-converge',
  'capture-posture',
];

interface CustomEntryLike {
  type?: unknown;
  customType?: unknown;
  data?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === 'string' && allowed.includes(value as T);
}

function isAxisSelection<T extends string>(
  value: unknown,
  allowed: readonly T[],
): value is AutoAxisSelection | T {
  return value === 'auto' || isOneOf(value, allowed);
}

export function parseBrunchAgentState(value: unknown): BrunchAgentState | undefined {
  if (!isRecord(value)) return undefined;
  if (value.schemaVersion !== 1) return undefined;
  if (!isOneOf(value.operationalMode, OPERATIONAL_MODE_IDS)) return undefined;
  if ('agentRole' in value) return undefined;
  if (!isAxisSelection(value.agentStrategy, AGENT_STRATEGY_IDS)) return undefined;
  if (!isAxisSelection(value.agentLens, AGENT_LENS_IDS)) return undefined;
  if (!isAxisSelection(value.agentGoal, AGENT_GOAL_IDS)) return undefined;

  return {
    schemaVersion: 1,
    operationalMode: value.operationalMode,
    agentStrategy: value.agentStrategy,
    agentLens: value.agentLens,
    agentGoal: value.agentGoal,
  };
}

export function parseBrunchAgentStateEntryData(value: unknown): BrunchAgentStateEntryData | undefined {
  if (!isRecord(value)) return undefined;
  if (value.schemaVersion !== 1) return undefined;
  if (value.reason !== 'init' && value.reason !== 'switch') return undefined;
  if (
    value.source !== 'system' &&
    value.source !== 'user' &&
    value.source !== 'agent' &&
    value.source !== 'extension'
  ) {
    return undefined;
  }
  const state = parseBrunchAgentState(value.state);
  if (!state) return undefined;
  const previous = value.previous === undefined ? undefined : parseBrunchAgentState(value.previous);
  if (value.previous !== undefined && !previous) return undefined;

  return {
    schemaVersion: 1,
    reason: value.reason,
    state,
    ...(previous ? { previous } : {}),
    source: value.source,
  };
}

export function latestValidBrunchAgentStateEntryData(
  entries: readonly CustomEntryLike[],
): BrunchAgentStateEntryData | undefined {
  let latest: BrunchAgentStateEntryData | undefined;

  for (const entry of entries) {
    if (entry.type !== 'custom' || entry.customType !== BRUNCH_AGENT_RUNTIME_STATE_CUSTOM_TYPE) {
      continue;
    }
    const data = parseBrunchAgentStateEntryData(entry.data);
    if (data) latest = data;
  }

  return latest;
}

export interface BrunchAgentStateEntrySessionManager {
  getEntries(): readonly CustomEntryLike[];
  appendCustomEntry(customType: string, data: BrunchAgentStateEntryData): string;
}

function requireValidBrunchAgentState(state: BrunchAgentState): BrunchAgentState {
  const valid = parseBrunchAgentState(state);
  if (!valid) {
    throw new Error('Invalid BrunchAgentState runtime selection.');
  }
  return valid;
}

export function appendBrunchAgentRuntimeInit(
  sessionManager: BrunchAgentStateEntrySessionManager,
  source: BrunchAgentStateEntryData['source'] = 'extension',
): string | undefined {
  if (latestValidBrunchAgentStateEntryData(sessionManager.getEntries())) {
    return undefined;
  }

  return sessionManager.appendCustomEntry(BRUNCH_AGENT_RUNTIME_STATE_CUSTOM_TYPE, {
    schemaVersion: 1,
    reason: 'init',
    state: DEFAULT_BRUNCH_AGENT_STATE,
    source,
  });
}

export function appendBrunchAgentRuntimeSwitch(
  sessionManager: BrunchAgentStateEntrySessionManager,
  state: BrunchAgentState,
  source: BrunchAgentStateEntryData['source'] = 'user',
): string {
  const validState = requireValidBrunchAgentState(state);
  const previous =
    latestValidBrunchAgentStateEntryData(sessionManager.getEntries())?.state ?? DEFAULT_BRUNCH_AGENT_STATE;

  return sessionManager.appendCustomEntry(BRUNCH_AGENT_RUNTIME_STATE_CUSTOM_TYPE, {
    schemaVersion: 1,
    reason: 'switch',
    state: validState,
    previous,
    source,
  });
}
