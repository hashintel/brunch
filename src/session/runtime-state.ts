import { OPERATIONAL_MODE_IDS, type OperationalModeId } from './schema/kinds.js';

export const BRUNCH_AGENT_RUNTIME_STATE_CUSTOM_TYPE = 'brunch.agent_runtime_state';

export type ToolPolicyId = 'specify-read-only' | 'execute-executor';
export type PromptPackId = 'brunch-base' | 'specify' | 'elicitor';
export type ModelPreference = 'default';
export type ThinkingLevel = 'low' | 'medium' | 'high';

export interface BrunchAgentState {
  schemaVersion: 1;
  operationalMode: OperationalModeId;
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
  operationalMode: 'specify',
};

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

export function parseBrunchAgentState(value: unknown): BrunchAgentState | undefined {
  if (!isRecord(value)) return undefined;
  if (value.schemaVersion !== 1) return undefined;
  if (!isOneOf(value.operationalMode, OPERATIONAL_MODE_IDS)) return undefined;
  if ('agentRole' in value) return undefined;

  return {
    schemaVersion: 1,
    operationalMode: value.operationalMode,
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
  getBranch(): readonly CustomEntryLike[];
  appendCustomEntry(customType: string, data: BrunchAgentStateEntryData): void;
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
): boolean {
  if (latestValidBrunchAgentStateEntryData(sessionManager.getBranch())) {
    return false;
  }

  sessionManager.appendCustomEntry(BRUNCH_AGENT_RUNTIME_STATE_CUSTOM_TYPE, {
    schemaVersion: 1,
    reason: 'init',
    state: DEFAULT_BRUNCH_AGENT_STATE,
    source,
  });
  return true;
}

export function appendBrunchAgentRuntimeSwitch(
  sessionManager: BrunchAgentStateEntrySessionManager,
  state: BrunchAgentState,
  source: BrunchAgentStateEntryData['source'] = 'user',
): void {
  const validState = requireValidBrunchAgentState(state);
  const previous =
    latestValidBrunchAgentStateEntryData(sessionManager.getBranch())?.state ?? DEFAULT_BRUNCH_AGENT_STATE;

  sessionManager.appendCustomEntry(BRUNCH_AGENT_RUNTIME_STATE_CUSTOM_TYPE, {
    schemaVersion: 1,
    reason: 'switch',
    state: validState,
    previous,
    source,
  });
}
