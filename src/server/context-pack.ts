import type { SpecificationMode } from '@/shared/api-types.js';
import { knowledgeKindRegistry } from '@/shared/knowledge.js';

import type { TurnWithOptions } from './core.js';
export {
  buildCandidateSpecContextPack,
  renderCandidateSpecContextPack,
} from './context-pack/candidate-spec.js';
export {
  buildObserverCaptureContextPack,
  renderObserverCaptureContextPack,
} from './context-pack/observer-capture.js';
export {
  buildReconciliationContextPack,
  renderReconciliationContextPack,
} from './context-pack/reconciliation.js';
export { buildWebResearchContextPack, renderWebResearchContextPack } from './context-pack/web-research.js';
export type { IntentAnchor } from './context-pack/anchors.js';
import type { IntentAnchor } from './context-pack/anchors.js';

export type ContextPackScenarioId = 'observer-capture' | 'web-research' | 'candidate-spec' | 'reconciliation';

export interface ContextPack<TScenario extends ContextPackScenarioId, TData> {
  scenario: TScenario;
  data: TData;
}

export interface ObserverCurrentTurnEvidence {
  id: number;
  phase: TurnWithOptions['phase'];
  preface?: {
    observation: string;
    elaboration?: string;
  };
  question?: string;
  why?: string;
  impact?: TurnWithOptions['impact'];
  response?: string;
}

export interface ObserverCaptureContextPackData {
  specification?: {
    mode?: SpecificationMode;
    workspaceDirectory?: string | null;
  };
  existingKnowledgeAnchors: IntentAnchor[];
  activePathSummary?: string;
  currentTurn: ObserverCurrentTurnEvidence;
}

export type ObserverCaptureContextPack = ContextPack<'observer-capture', ObserverCaptureContextPackData>;

export interface WebResearchContextPackData {
  researchObjective: string;
  triggeringQuestion?: string;
  knownIntentAnchors: IntentAnchor[];
  constraints: string[];
}

export type WebResearchContextPack = ContextPack<'web-research', WebResearchContextPackData>;

export interface CandidateSpecContextPackData {
  objective: string;
  requestedCandidateCount: number;
  knownIntentAnchors: IntentAnchor[];
  constraints: IntentAnchor[];
  assumptions: IntentAnchor[];
  decisions: IntentAnchor[];
}

export type CandidateSpecContextPack = ContextPack<'candidate-spec', CandidateSpecContextPackData>;

export interface ReconciliationNeedContext {
  id: number;
  kind: 'supersedes' | 'needs_confirmation';
  status: 'open' | 'resolved';
  reason?: string;
  source: IntentAnchor;
  target: IntentAnchor;
}

export interface ReconciliationContextPackData {
  objective: string;
  knownIntentAnchors: IntentAnchor[];
  openNeeds: ReconciliationNeedContext[];
}

export type ReconciliationContextPack = ContextPack<'reconciliation', ReconciliationContextPackData>;

export interface CandidateSpecContextPackInput {
  objective: string;
  requestedCandidateCount: number;
  entities: ObserverContextPackInput['entities'];
}

export interface WebResearchContextPackInput {
  researchObjective: string;
  triggeringQuestion?: string;
  constraints?: string[];
  entities: ObserverContextPackInput['entities'];
}

export interface ReconciliationContextPackInput {
  objective: string;
  openNeeds: Array<{
    id: number;
    sourceItemId: number;
    targetItemId: number;
    kind: 'supersedes' | 'needs_confirmation';
    status: 'open' | 'resolved';
    reason?: string | null;
  }>;
  entities: ObserverContextPackInput['entities'];
}

export interface ObserverContextPackInput {
  turn: TurnWithOptions;
  activePathSummary: string;
  specificationMode?: SpecificationMode;
  workspaceDirectory?: string | null;
  entities: Record<
    (typeof knowledgeKindRegistry)[number]['collectionKey'],
    Array<{ id: number; content: string }>
  >;
}
