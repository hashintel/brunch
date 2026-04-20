import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { EdgeRelation, Impact, ReviewAction, TurnKind } from '@/shared/api-types.js';
import {
  formatTurnResponseText,
  type BrunchAssistantPart,
  type BrunchUserPart,
  type ReviewActionOption,
} from '@/shared/chat.js';
import {
  createKnowledgeCollectionRecord,
  knowledgeCollectionKeyByKind,
  type KnowledgeKind,
} from '@/shared/knowledge.js';
import {
  createConfirmProposedPhaseClosureCommand,
  getPhaseClosureCommandText,
  type WorkflowPhase,
} from '@/shared/phase-close.js';

import {
  advanceHead,
  confirmPhaseOutcome,
  createKnowledgeItem,
  createOption,
  createPhaseOutcome,
  createProject,
  createTurn,
  linkKnowledgeItemToTurn,
  applyTurnResponseSelections,
  updateTurn,
  type DB,
} from '../db.js';
import { serializeParts } from '../parts.js';
import * as schema from '../schema.js';
import { isProjectedControlTurnKind } from './durable-manifest-contract.js';
import type { ScenarioFn } from './scenarios.js';

// ---------------------------------------------------------------------------
// Manifest types
// ---------------------------------------------------------------------------

export interface ManifestOption {
  content: string;
  is_recommended: boolean;
}

export interface ManifestTurn {
  phase: WorkflowPhase;
  turnKind?: TurnKind;
  question: string;
  answer?: string | null;
  why?: string | null;
  impact?: Impact | null;
  options?: ManifestOption[];
  selectedOptionPositions?: number[];
  freeText?: string | null;
  reviewAction?: ReviewAction;
  reviewActions?: ReviewActionOption[];
  isProposal?: boolean;
  isConfirmation?: boolean;
}

export interface ManifestKnowledgeItem {
  kind: KnowledgeKind;
  content: string;
  rationale?: string | null;
  capturedAtTurn: number;
  reviewAction?: 'reviewed' | 'rejected';
  reviewedAtTurn?: number;
}

export interface ManifestEdge {
  fromItemIndex: number;
  toItemIndex: number;
  relation: EdgeRelation;
}

export interface ManifestScenario {
  turns: ManifestTurn[];
  knowledgeItems: ManifestKnowledgeItem[];
  edges: ManifestEdge[];
}

export interface Manifest {
  name: string;
  description: string;
  scenarios: Record<string, ManifestScenario>;
}

type ObserverEntityIds = ReturnType<typeof createKnowledgeCollectionRecord<number[]>>;

type CompiledQuestionTurn = {
  kind: 'question';
  phase: WorkflowPhase;
  question: string;
  why: string;
  impact: Impact;
  options: ManifestOption[];
  selectedOptionPositions: number[];
  freeText?: string;
  reviewAction?: ReviewAction;
  reviewActions?: ReviewActionOption[];
  responseText?: string;
};

type CompiledProposalTurn = {
  kind: 'proposal';
  phase: WorkflowPhase;
  summary: string;
};

type CompiledConfirmationTurn = {
  kind: 'confirmation';
  phase: WorkflowPhase;
  proposalIndex: number;
};

type CompiledManifestTurn = CompiledQuestionTurn | CompiledProposalTurn | CompiledConfirmationTurn;

interface CompiledManifestScenario {
  turns: CompiledManifestTurn[];
  knowledgeItems: ManifestKnowledgeItem[];
  edges: ManifestEdge[];
}

function normalizeOptionalText(value: string | null | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function createEmptyObserverEntityIds(): ObserverEntityIds {
  return createKnowledgeCollectionRecord(() => [] as number[]);
}

function getObserverEntityIdsForTurn(
  observerEntityIdsByTurn: Map<number, ObserverEntityIds>,
  turnIndex: number,
): ObserverEntityIds {
  let entityIds = observerEntityIdsByTurn.get(turnIndex);
  if (!entityIds) {
    entityIds = createEmptyObserverEntityIds();
    observerEntityIdsByTurn.set(turnIndex, entityIds);
  }
  return entityIds;
}

function compileQuestionTurn(turn: ManifestTurn, turnIndex: number): CompiledQuestionTurn {
  const question = normalizeOptionalText(turn.question);
  if (!question) {
    throw new Error(`Manifest turn ${turnIndex} must include a non-empty question`);
  }

  const options = turn.options ?? [];
  const selectedOptionPositions = [...new Set(turn.selectedOptionPositions ?? [])];
  for (const position of selectedOptionPositions) {
    if (position < 0 || position >= options.length) {
      throw new Error(
        `Manifest turn ${turnIndex} selected option position ${position} is out of range for ${options.length} options`,
      );
    }
  }

  const selectedOptionContents = selectedOptionPositions.map((position) => options[position]!.content);
  const selectedOnlyText = formatTurnResponseText({ selectedOptionContents });
  const explicitFreeText = normalizeOptionalText(turn.freeText);
  const normalizedAnswer = normalizeOptionalText(turn.answer ?? undefined);
  const freeText =
    explicitFreeText ??
    (selectedOptionPositions.length === 0
      ? normalizedAnswer
      : normalizedAnswer && normalizedAnswer !== selectedOnlyText
        ? normalizedAnswer
        : undefined);
  const responseText = formatTurnResponseText({ selectedOptionContents, freeText }) ?? undefined;

  return {
    kind: 'question',
    phase: turn.phase,
    question,
    why: normalizeOptionalText(turn.why) ?? 'Fixture-authored question rationale.',
    impact: turn.impact ?? 'medium',
    options,
    selectedOptionPositions,
    ...(freeText ? { freeText } : {}),
    ...(turn.reviewAction ? { reviewAction: turn.reviewAction } : {}),
    ...(turn.reviewActions ? { reviewActions: turn.reviewActions } : {}),
    ...(responseText ? { responseText } : {}),
  };
}

function compileProposalTurn(turn: ManifestTurn, turnIndex: number): CompiledProposalTurn {
  const summary = normalizeOptionalText(turn.answer);
  if (!summary) {
    throw new Error(`Manifest proposal turn ${turnIndex} must include a non-empty summary`);
  }

  return {
    kind: 'proposal',
    phase: turn.phase,
    summary,
  };
}

function compileConfirmationTurn(
  turn: ManifestTurn,
  turnIndex: number,
  compiledTurns: CompiledManifestTurn[],
): CompiledConfirmationTurn {
  const proposalIndex = [...compiledTurns.keys()]
    .reverse()
    .find((index) => compiledTurns[index]?.kind === 'proposal' && compiledTurns[index]?.phase === turn.phase);
  if (proposalIndex == null) {
    throw new Error(
      `Manifest confirmation turn ${turnIndex} has no preceding proposal turn for phase "${turn.phase}"`,
    );
  }

  return {
    kind: 'confirmation',
    phase: turn.phase,
    proposalIndex,
  };
}

function compileManifestScenario(scenario: ManifestScenario): CompiledManifestScenario {
  const compiledTurns: CompiledManifestTurn[] = [];

  for (let index = 0; index < scenario.turns.length; index++) {
    const turn = scenario.turns[index]!;

    if (turn.isProposal && turn.isConfirmation) {
      throw new Error(`Manifest turn ${index} cannot be both a proposal and a confirmation`);
    }
    if (isProjectedControlTurnKind(turn.turnKind)) {
      throw new Error(
        `Manifest turn ${index} cannot seed control turnKind ${turn.turnKind}; seed durable authority and derive landing instead`,
      );
    }

    const compiledTurn = turn.isConfirmation
      ? compileConfirmationTurn(turn, index, compiledTurns)
      : turn.isProposal
        ? compileProposalTurn(turn, index)
        : compileQuestionTurn(turn, index);
    compiledTurns.push(compiledTurn);
  }

  for (let index = 0; index < scenario.knowledgeItems.length; index++) {
    const item = scenario.knowledgeItems[index]!;
    if (item.capturedAtTurn < 0 || item.capturedAtTurn >= compiledTurns.length) {
      throw new Error(
        `Manifest knowledge item ${index} references missing capturedAtTurn ${item.capturedAtTurn}`,
      );
    }
    if ((item.reviewAction == null) !== (item.reviewedAtTurn == null)) {
      throw new Error(
        `Manifest knowledge item ${index} must provide both reviewAction and reviewedAtTurn together`,
      );
    }
    if (
      item.reviewedAtTurn != null &&
      (item.reviewedAtTurn < 0 || item.reviewedAtTurn >= compiledTurns.length)
    ) {
      throw new Error(
        `Manifest knowledge item ${index} references missing reviewedAtTurn ${item.reviewedAtTurn}`,
      );
    }
  }

  for (let index = 0; index < scenario.edges.length; index++) {
    const edge = scenario.edges[index]!;
    if (edge.fromItemIndex < 0 || edge.fromItemIndex >= scenario.knowledgeItems.length) {
      throw new Error(`Manifest edge ${index} references missing fromItemIndex ${edge.fromItemIndex}`);
    }
    if (edge.toItemIndex < 0 || edge.toItemIndex >= scenario.knowledgeItems.length) {
      throw new Error(`Manifest edge ${index} references missing toItemIndex ${edge.toItemIndex}`);
    }
  }

  return {
    turns: compiledTurns,
    knowledgeItems: scenario.knowledgeItems,
    edges: scenario.edges,
  };
}

function buildQuestionAssistantParts(
  turnId: number,
  turn: CompiledQuestionTurn,
  entityIds: ObserverEntityIds,
): BrunchAssistantPart[] {
  return [
    {
      type: 'tool-ask_question',
      toolCallId: `fixture-turn-${turnId}-ask-question`,
      state: 'output-available',
      input: {
        question: turn.question,
        why: turn.why,
        impact: turn.impact,
        options: turn.options,
        ...(turn.reviewActions ? { reviewActions: turn.reviewActions } : {}),
      },
      output: {
        ok: true,
        turnId,
        optionCount: turn.options.length,
      },
    },
    {
      type: 'data-observer-result',
      data: { entityIds },
    },
  ];
}

function buildProposalAssistantParts(
  turnId: number,
  turn: CompiledProposalTurn,
  entityIds: ObserverEntityIds,
): BrunchAssistantPart[] {
  return [
    {
      type: 'tool-propose_phase_closure',
      toolCallId: `fixture-turn-${turnId}-propose-phase-closure`,
      state: 'output-available',
      input: {
        phase: turn.phase,
        summary: turn.summary,
      },
      output: {
        ok: true,
        turnId,
        phase: turn.phase,
      },
    },
    {
      type: 'data-phase-summary',
      data: {
        turnId,
        phase: turn.phase,
        summary: turn.summary,
      },
    },
    {
      type: 'data-observer-result',
      data: { entityIds },
    },
  ];
}

// ---------------------------------------------------------------------------
// Seeder
// ---------------------------------------------------------------------------

export function seedFromManifest(db: DB, scenario: ManifestScenario, projectName: string): number {
  const compiledScenario = compileManifestScenario(scenario);
  return seedCompiledManifestScenario(db, compiledScenario, projectName);
}

function seedCompiledManifestScenario(
  db: DB,
  scenario: CompiledManifestScenario,
  projectName: string,
): number {
  const project = createProject(db, projectName);
  const projectId = project.id;

  // Track manifest turn index → actual turn ID
  const turnIdMap = new Map<number, number>();
  const phaseOutcomeIdByProposalTurnIndex = new Map<number, number>();
  const confirmationTurnIdByPhase = new Map<WorkflowPhase, number>();
  const observerEntityIdsByTurn = new Map<number, ObserverEntityIds>();
  let prevTurnId: number | null = null;

  for (let i = 0; i < scenario.turns.length; i++) {
    const turnDefinition = scenario.turns[i]!;

    if (turnDefinition.kind === 'confirmation') {
      const proposalTurnId = turnIdMap.get(turnDefinition.proposalIndex);
      const phaseOutcomeId = phaseOutcomeIdByProposalTurnIndex.get(turnDefinition.proposalIndex);
      if (proposalTurnId == null || phaseOutcomeId == null) {
        throw new Error(
          `Compiled manifest confirmation turn ${i} could not resolve proposal turn ${turnDefinition.proposalIndex}`,
        );
      }

      const confirmationCommand = createConfirmProposedPhaseClosureCommand(
        turnDefinition.phase,
        proposalTurnId,
      );
      const commandText = getPhaseClosureCommandText(confirmationCommand);
      const userParts = serializeParts([
        { type: 'text', text: commandText },
        {
          type: 'data-confirmation',
          data: confirmationCommand,
        },
      ] satisfies BrunchUserPart[]);

      const turn = createTurn(db, projectId, {
        phase: turnDefinition.phase,
        parent_turn_id: prevTurnId,
        question: '',
        answer: commandText,
        user_parts: userParts,
      });
      turnIdMap.set(i, turn.id);
      confirmPhaseOutcome(db, phaseOutcomeId, turn.id);
      confirmationTurnIdByPhase.set(turnDefinition.phase, turn.id);

      advanceHead(db, projectId, turn.id);
      prevTurnId = turn.id;
      continue;
    }

    if (turnDefinition.kind === 'proposal') {
      const turn = createTurn(db, projectId, {
        phase: turnDefinition.phase,
        parent_turn_id: prevTurnId,
        question: '',
        answer: turnDefinition.summary,
      });
      turnIdMap.set(i, turn.id);

      const outcome = createPhaseOutcome(db, {
        projectId,
        phase: turnDefinition.phase,
        proposal_turn_id: turn.id,
        summary: turnDefinition.summary,
      });
      phaseOutcomeIdByProposalTurnIndex.set(i, outcome.id);

      advanceHead(db, projectId, turn.id);
      prevTurnId = turn.id;
      continue;
    }

    const options = turnDefinition.options;
    const turn = createTurn(db, projectId, {
      phase: turnDefinition.phase,
      parent_turn_id: prevTurnId,
      turn_kind: 'question',
      question: turnDefinition.question,
      why: turnDefinition.why,
      impact: turnDefinition.impact,
      answer: turnDefinition.responseText ?? null,
    });
    turnIdMap.set(i, turn.id);

    const optionIdsByPosition = new Map<number, number>();
    for (let p = 0; p < options.length; p++) {
      const opt = options[p]!;
      const createdOption = createOption(db, turn.id, {
        position: p,
        content: opt.content,
        is_recommended: opt.is_recommended,
      });
      optionIdsByPosition.set(p, createdOption.id);
    }

    if (turnDefinition.selectedOptionPositions.length > 0) {
      applyTurnResponseSelections(db, turn.id, turnDefinition.selectedOptionPositions);
    }

    if (turnDefinition.responseText) {
      const selectedIds = turnDefinition.selectedOptionPositions
        .map((position) => optionIdsByPosition.get(position))
        .filter((optionId): optionId is number => optionId != null);
      const userParts = serializeParts([
        { type: 'text', text: turnDefinition.responseText },
        {
          type: 'data-turn-response',
          data: {
            turnId: turn.id,
            selectedOptionIds: selectedIds,
            ...(turnDefinition.freeText ? { freeText: turnDefinition.freeText } : {}),
            ...(turnDefinition.reviewAction ? { reviewAction: turnDefinition.reviewAction } : {}),
          },
        },
      ] satisfies BrunchUserPart[]);
      updateTurn(db, turn.id, { user_parts: userParts });
    }

    advanceHead(db, projectId, turn.id);
    prevTurnId = turn.id;
  }

  const itemIdMap = new Map<number, number>();

  for (let k = 0; k < scenario.knowledgeItems.length; k++) {
    const mi = scenario.knowledgeItems[k]!;
    const item = createKnowledgeItem(db, projectId, mi.kind, mi.content, {
      rationale: mi.rationale ?? null,
    });
    itemIdMap.set(k, item.id);

    const captureTurnId = turnIdMap.get(mi.capturedAtTurn);
    if (captureTurnId == null) {
      throw new Error(
        `Compiled manifest knowledge item ${k} could not resolve capture turn ${mi.capturedAtTurn}`,
      );
    }
    linkKnowledgeItemToTurn(db, item.id, captureTurnId, 'captured');

    const observerEntityIds = getObserverEntityIdsForTurn(observerEntityIdsByTurn, mi.capturedAtTurn);
    const collectionKey = knowledgeCollectionKeyByKind[mi.kind];
    if (!collectionKey) {
      throw new Error(`Unsupported knowledge kind "${mi.kind}" in manifest item ${k}`);
    }
    observerEntityIds[collectionKey].push(item.id);

    if (mi.reviewAction && mi.reviewedAtTurn != null) {
      const reviewTurnId = turnIdMap.get(mi.reviewedAtTurn);
      if (reviewTurnId == null) {
        throw new Error(
          `Compiled manifest knowledge item ${k} could not resolve review turn ${mi.reviewedAtTurn}`,
        );
      }
      linkKnowledgeItemToTurn(db, item.id, reviewTurnId, mi.reviewAction);

      // Legacy manifest scenarios still record per-item review outcomes before the
      // final phase confirmation. Mirror accepted requirements/criteria onto the
      // confirmation turn so active-path projections can derive the surviving set
      // from the same confirmed-phase seam used at runtime.
      const confirmationPhase =
        mi.kind === 'requirement' ? 'requirements' : mi.kind === 'criterion' ? 'criteria' : null;
      if (mi.reviewAction === 'reviewed' && confirmationPhase) {
        const confirmationTurnId = confirmationTurnIdByPhase.get(confirmationPhase);
        if (confirmationTurnId != null) {
          linkKnowledgeItemToTurn(db, item.id, confirmationTurnId, 'reviewed');
        }
      }
    }
  }

  for (const edge of scenario.edges) {
    const fromId = itemIdMap.get(edge.fromItemIndex);
    const toId = itemIdMap.get(edge.toItemIndex);
    if (fromId == null || toId == null) {
      throw new Error(
        `Compiled manifest edge could not resolve item references ${edge.fromItemIndex} -> ${edge.toItemIndex}`,
      );
    }
    db.insert(schema.knowledgeEdge)
      .values({ from_item_id: fromId, to_item_id: toId, relation: edge.relation })
      .run();
  }

  for (let i = 0; i < scenario.turns.length; i++) {
    const turnId = turnIdMap.get(i);
    if (turnId == null) {
      continue;
    }

    const entityIds = observerEntityIdsByTurn.get(i) ?? createEmptyObserverEntityIds();
    const turnDefinition = scenario.turns[i]!;
    if (turnDefinition.kind === 'question') {
      updateTurn(db, turnId, {
        assistant_parts: serializeParts(buildQuestionAssistantParts(turnId, turnDefinition, entityIds)),
      });
      continue;
    }

    if (turnDefinition.kind === 'proposal') {
      updateTurn(db, turnId, {
        assistant_parts: serializeParts(buildProposalAssistantParts(turnId, turnDefinition, entityIds)),
      });
    }
  }

  return projectId;
}

// ---------------------------------------------------------------------------
// Manifest loader
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));

export function loadManifest(manifestName: string): Manifest {
  const filePath = join(__dirname, 'manifests', `${manifestName}.json`);
  const raw = readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as Manifest;
}

export function buildManifestScenarioCatalog(
  manifestName: string,
  manifest: Manifest,
): Record<string, ScenarioFn> {
  const result: Record<string, ScenarioFn> = {};

  for (const scenarioKey of Object.keys(manifest.scenarios)) {
    const scenario = manifest.scenarios[scenarioKey]!;
    const compiledScenario = compileManifestScenario(scenario);
    const fullKey = `${manifestName}-${scenarioKey}`;
    const defaultName = `${manifest.name} (${scenarioKey})`;

    result[fullKey] = (db: DB, projectName?: string) => {
      return seedCompiledManifestScenario(db, compiledScenario, projectName ?? defaultName);
    };
  }

  return result;
}

export function loadManifestScenarios(manifestName: string): Record<string, ScenarioFn> {
  const manifest = loadManifest(manifestName);
  return buildManifestScenarioCatalog(manifestName, manifest);
}
