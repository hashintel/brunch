import type { FileEntry } from '@earendil-works/pi-coding-agent';

import {
  assertLinearBrunchSessionEnvelope,
  type BrunchSessionEnvelope,
} from '../../session/brunch-session-envelope.js';
import {
  DEFAULT_BRUNCH_AGENT_STATE,
  latestValidBrunchAgentStateEntryData,
  type AgentGoalSelection,
  type AgentLensSelection,
  type AgentStrategySelection,
  type BrunchAgentState,
  type FileMention,
  type GraphNodeMention,
  type OperationalModeId,
} from '../../session/runtime-state.js';
import {
  AGENT_ROLE_DEFINITIONS,
  OPERATIONAL_MODE_DEFINITIONS,
  type ResolvedBrunchAgentState,
} from './runtime-policy.js';

export type { ResolvedBrunchAgentState } from './runtime-policy.js';
export { AGENT_ROLE_DEFINITIONS, OPERATIONAL_MODE_DEFINITIONS } from './runtime-policy.js';
export { DEFAULT_BRUNCH_AGENT_STATE } from '../../session/runtime-state.js';

export interface RuntimeStateProjection {
  status: 'ready';
  specId: number;
  sessionId: string;
  agent: {
    operationalMode: OperationalModeId;
    role: ResolvedBrunchAgentState['agentRole'];
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === 'string' && allowed.includes(value as T);
}

export function resolveBrunchAgentState(state: BrunchAgentState): ResolvedBrunchAgentState {
  const operationalModeDefinition = OPERATIONAL_MODE_DEFINITIONS[state.operationalMode];
  const agentRole = operationalModeDefinition.defaultRole;
  return {
    ...state,
    agentRole,
    operationalModeDefinition,
    agentRoleDefinition: AGENT_ROLE_DEFINITIONS[agentRole],
  };
}

export function projectBrunchAgentState(
  entries: readonly { type?: unknown; customType?: unknown; data?: unknown }[],
): ResolvedBrunchAgentState {
  return resolveBrunchAgentState(
    latestValidBrunchAgentStateEntryData(entries)?.state ?? DEFAULT_BRUNCH_AGENT_STATE,
  );
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
        const seenLsn = integerField(data.seenLsn);
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
