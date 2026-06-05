import type { FileEntry } from '@earendil-works/pi-coding-agent';

import { assertLinearBrunchSessionEnvelope, type BrunchSessionEnvelope } from './brunch-session-envelope.js';

export const BRUNCH_AGENT_RUNTIME_STATE_CUSTOM_TYPE = 'brunch.agent_runtime_state';

export type OperationalModeId = 'elicit';
export type AgentRoleId = 'elicitor';
export type AutoAxisSelection = 'auto';
export type AgentStrategyId =
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

export interface OperationalModeDefinition {
  id: OperationalModeId;
  defaultRole: AgentRoleId;
  allowedRoles: readonly AgentRoleId[];
  toolPolicyId: ToolPolicyId;
  promptPackIds: readonly PromptPackId[];
}

export interface AgentRoleDefinition {
  id: AgentRoleId;
  operationalMode: OperationalModeId;
  defaultStrategy: AgentStrategySelection;
  allowedStrategies: readonly AgentStrategyId[];
  defaultLens: AgentLensSelection;
  allowedLenses: readonly AgentLensId[];
  defaultGoal: AgentGoalSelection;
  allowedGoals: readonly AgentGoalId[];
  promptPackIds: readonly PromptPackId[];
  modelPreference?: ModelPreference;
  thinkingLevel?: ThinkingLevel;
}

export interface ResolvedBrunchAgentState extends BrunchAgentState {
  agentRole: AgentRoleId;
  operationalModeDefinition: OperationalModeDefinition;
  agentRoleDefinition: AgentRoleDefinition;
}

export interface BrunchAgentStateEntryData {
  schemaVersion: 1;
  reason: 'init' | 'switch';
  state: BrunchAgentState;
  previous?: BrunchAgentState;
  source: 'system' | 'user' | 'agent' | 'extension';
}

export interface RuntimeStateProjection {
  status: 'ready';
  specId: number;
  sessionId: string;
  agent: {
    operationalMode: OperationalModeId;
    role: AgentRoleId;
    strategy: AgentStrategySelection;
    lens: AgentLensSelection;
    goal: AgentGoalSelection;
  };
  mentions: {
    graphNodes: GraphNodeMention[];
    files: FileMention[];
  };
  world: {
    graph: {
      latestLsn: number | null;
    };
    git: {
      head: string | null;
    };
  };
  lifecycle: {
    specOrigin: 'new' | 'existing' | null;
    sessionOrigin: 'new' | 'resumed' | null;
    sessionIndexInSpec: number | null;
    isFirstSessionForSpec: boolean | null;
    isTenthSessionForSpec: boolean | null;
  };
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

export const OPERATIONAL_MODE_DEFINITIONS: Record<OperationalModeId, OperationalModeDefinition> = {
  elicit: {
    id: 'elicit',
    defaultRole: 'elicitor',
    allowedRoles: ['elicitor'],
    toolPolicyId: 'elicit-read-only',
    promptPackIds: ['brunch-base', 'elicit'],
  },
};

export const AGENT_ROLE_DEFINITIONS: Record<AgentRoleId, AgentRoleDefinition> = {
  elicitor: {
    id: 'elicitor',
    operationalMode: 'elicit',
    defaultStrategy: 'auto',
    allowedStrategies: [
      'step-wise-decision-tree',
      'step-wise-disambiguate',
      'propose-graph',
      'project-graph',
    ],
    defaultLens: 'auto',
    allowedLenses: ['intent', 'design', 'oracle'],
    defaultGoal: 'grounding-advance',
    allowedGoals: ['grounding-advance', 'elicit-expand', 'commit-converge', 'capture-posture'],
    promptPackIds: ['elicitor'],
  },
};

interface CustomEntryLike {
  type?: unknown;
  customType?: unknown;
  data?: unknown;
  details?: unknown;
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

function parseBrunchAgentState(value: unknown): BrunchAgentState | undefined {
  if (!isRecord(value)) return undefined;
  const operationalModes = Object.keys(OPERATIONAL_MODE_DEFINITIONS) as OperationalModeId[];

  if (value.schemaVersion !== 1) return undefined;
  if (!isOneOf(value.operationalMode, operationalModes)) return undefined;
  if ('agentRole' in value) return undefined;

  const mode = OPERATIONAL_MODE_DEFINITIONS[value.operationalMode];
  const role = AGENT_ROLE_DEFINITIONS[mode.defaultRole];
  if (!isAxisSelection(value.agentStrategy, role.allowedStrategies)) return undefined;
  if (!isAxisSelection(value.agentLens, role.allowedLenses)) return undefined;
  if (!isAxisSelection(value.agentGoal, role.allowedGoals)) return undefined;

  return {
    schemaVersion: 1,
    operationalMode: value.operationalMode,
    agentStrategy: value.agentStrategy,
    agentLens: value.agentLens,
    agentGoal: value.agentGoal,
  };
}

function parseBrunchAgentStateEntryData(value: unknown): BrunchAgentStateEntryData | undefined {
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

function resolveBrunchAgentState(state: BrunchAgentState): ResolvedBrunchAgentState {
  const operationalModeDefinition = OPERATIONAL_MODE_DEFINITIONS[state.operationalMode];
  const agentRole = operationalModeDefinition.defaultRole;
  return {
    ...state,
    agentRole,
    operationalModeDefinition,
    agentRoleDefinition: AGENT_ROLE_DEFINITIONS[agentRole],
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

export function projectBrunchAgentState(entries: readonly CustomEntryLike[]): ResolvedBrunchAgentState {
  return resolveBrunchAgentState(
    latestValidBrunchAgentStateEntryData(entries)?.state ?? DEFAULT_BRUNCH_AGENT_STATE,
  );
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
  const previous = projectBrunchAgentState(sessionManager.getEntries());

  return sessionManager.appendCustomEntry(BRUNCH_AGENT_RUNTIME_STATE_CUSTOM_TYPE, {
    schemaVersion: 1,
    reason: 'switch',
    state: validState,
    previous: {
      schemaVersion: previous.schemaVersion,
      operationalMode: previous.operationalMode,
      agentStrategy: previous.agentStrategy,
      agentLens: previous.agentLens,
      agentGoal: previous.agentGoal,
    },
    source,
  });
}

export function projectSessionRuntimeState(envelope: BrunchSessionEnvelope): RuntimeStateProjection {
  assertLinearBrunchSessionEnvelope(envelope);
  const agentState = projectBrunchAgentState(envelope.entries);

  return {
    status: 'ready',
    specId: envelope.binding.specId,
    sessionId: envelope.header.id,
    agent: {
      operationalMode: agentState.operationalMode,
      role: agentState.agentRole,
      strategy: agentState.agentStrategy,
      lens: agentState.agentLens,
      goal: agentState.agentGoal,
    },
    mentions: projectMentions(envelope.entries),
    world: projectWorld(envelope.entries),
    lifecycle: projectLifecycle(envelope.entries),
  };
}

function projectMentions(entries: readonly FileEntry[]): RuntimeStateProjection['mentions'] {
  const graphNodes: GraphNodeMention[] = [];
  const files: FileMention[] = [];

  for (const entry of entries) {
    if (!isRecord(entry) || entry.type !== 'custom') continue;
    const customType = entry.customType;
    const data = isRecord(entry.data) ? entry.data : undefined;
    if (customType === 'brunch.mention' && data) {
      const id = stringField(data.entityId) ?? stringField(data.nodeId) ?? stringField(data.id);
      if (id) {
        const handle = stringField(data.handle);
        const title = stringField(data.title);
        const seenLsn = integerField(data.snapshottedLsn);
        graphNodes.push({
          id,
          ...(handle === undefined ? {} : { handle }),
          ...(title === undefined ? {} : { title }),
          ...(seenLsn === undefined ? {} : { seenLsn }),
        });
      }
    }
    if (customType === 'brunch.file_mention' && data) {
      const path = stringField(data.path);
      if (path) {
        const seenGitHead = stringField(data.gitHead);
        files.push({
          path,
          ...(seenGitHead === undefined ? {} : { seenGitHead }),
        });
      }
    }
  }

  return { graphNodes, files };
}

function projectWorld(entries: readonly FileEntry[]): RuntimeStateProjection['world'] {
  let latestGraph: RuntimeStateProjection['world']['graph'] = {
    latestLsn: null,
  };
  let gitHead: string | null = null;

  for (const entry of entries) {
    if (!isRecord(entry) || entry.type !== 'custom') continue;
    if (entry.customType !== 'worldUpdate') continue;
    const details = isRecord(entry.details) ? entry.details : isRecord(entry.data) ? entry.data : undefined;
    if (!details) continue;

    const lsn = integerField(details.currentLsn) ?? integerField(details.changedSinceLsn) ?? null;
    latestGraph = {
      latestLsn: lsn,
    };
    gitHead = stringField(details.gitHead) ?? gitHead;
  }

  return {
    graph: latestGraph,
    git: { head: gitHead },
  };
}

function projectLifecycle(entries: readonly FileEntry[]): RuntimeStateProjection['lifecycle'] {
  let lifecycle: RuntimeStateProjection['lifecycle'] = {
    specOrigin: null,
    sessionOrigin: null,
    sessionIndexInSpec: null,
    isFirstSessionForSpec: null,
    isTenthSessionForSpec: null,
  };

  for (const entry of entries) {
    if (!isRecord(entry) || entry.type !== 'custom') continue;
    if (entry.customType !== 'brunch.session_lifecycle') continue;
    const data = isRecord(entry.data) ? entry.data : undefined;
    if (!data) continue;
    const index = integerField(data.sessionIndexInSpec) ?? lifecycle.sessionIndexInSpec;
    const specOrigin = originField(data.specOrigin, ['new', 'existing'] as const) ?? lifecycle.specOrigin;
    const sessionOrigin =
      originField(data.sessionOrigin, ['new', 'resumed'] as const) ?? lifecycle.sessionOrigin;
    lifecycle = {
      specOrigin,
      sessionOrigin,
      sessionIndexInSpec: index,
      isFirstSessionForSpec:
        booleanField(data.isFirstSessionForSpec) ?? (index === null ? null : index === 1),
      isTenthSessionForSpec:
        booleanField(data.isTenthSessionForSpec) ?? (index === null ? null : index === 10),
    };
  }

  return lifecycle;
}

function stringField(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function integerField(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) ? value : undefined;
}

function booleanField(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function originField<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  return isOneOf(value, allowed) ? value : undefined;
}
