import type {
  AgentKind,
  AgentLensId,
  AgentMethodId,
  AgentRoleId,
  AgentStrategyId,
  AgentStrategySelection,
  AgentLensSelection,
  AgentThinkingLevel,
  OperationalModeId,
} from './kinds.js';

export type AgentModelPreference = string;

export interface AgentSkillGrant {
  readonly strategies: readonly AgentStrategyId[];
  readonly lenses: readonly AgentLensId[];
  readonly methods: readonly AgentMethodId[];
}

export type AgentBodySource =
  | {
      readonly source: 'file';
      readonly location: string;
    }
  | {
      readonly source: 'markdown';
      readonly systemPrompt: string;
    };

interface AgentManifestBase {
  readonly id: string;
  readonly kind: AgentKind;
  readonly description: string;
  readonly model: AgentModelPreference;
  readonly thinking: AgentThinkingLevel;
  readonly body: AgentBodySource;
  readonly skills: AgentSkillGrant;
  readonly tools: readonly string[];
  readonly canDelegate: readonly string[];
}

export interface ForegroundAgentManifest extends AgentManifestBase {
  readonly kind: 'foreground';
  readonly id: AgentRoleId;
  readonly operationalMode: OperationalModeId;
  readonly defaultStrategy: AgentStrategySelection;
  readonly defaultLens: AgentLensSelection;
  readonly toolAuthority: string;
}

export interface BackgroundAgentManifest extends AgentManifestBase {
  readonly kind: 'background';
}

export type AgentManifest = ForegroundAgentManifest | BackgroundAgentManifest;
