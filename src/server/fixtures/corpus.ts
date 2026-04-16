import type { KnowledgeCollectionKey } from '@/shared/knowledge.js';
import { createKnowledgeCollectionRecord } from '@/shared/knowledge.js';

import type { TurnWithOptions } from '../core.js';
import { loadActivePathWithOptions } from '../core.js';
import { createDb, findPhaseOutcomeForTurn, getEntitiesForProject, type DB } from '../db.js';
import { runObserver, type ObserverOutput } from '../observer.js';
import { safeDeserializeUserParts } from '../parts.js';
import { projectTurnResponse } from '../turn-response.js';
import {
  loadManifest,
  seedFromManifest,
  type ManifestEdge,
  type ManifestKnowledgeItem,
  type ManifestScenario,
} from './manifest.js';

type ManifestPhase = ManifestScenario['turns'][number]['phase'];
type ObserverCollectionKey = Exclude<KnowledgeCollectionKey, never>;
type DependencyKind = 'decision' | 'assumption';

export interface ObservedKnowledgeItem {
  content: string;
  rationale?: string | null;
  subtype?: string | null;
}

export interface ObservedDependency {
  sourceKind: DependencyKind;
  sourceContent: string;
  targetKind: DependencyKind;
  targetContent: string;
}

export interface ObservedTurnCapture {
  goals: ObservedKnowledgeItem[];
  terms: ObservedKnowledgeItem[];
  contexts: ObservedKnowledgeItem[];
  constraints: ObservedKnowledgeItem[];
  requirements: ObservedKnowledgeItem[];
  criteria: ObservedKnowledgeItem[];
  decisions: ObservedKnowledgeItem[];
  assumptions: ObservedKnowledgeItem[];
  dependencies: ObservedDependency[];
}

export interface ObserveTurnInput {
  db: DB;
  turn: TurnWithOptions;
  projectId: number;
  turnIndex: number;
}

export type ObserveTurnFn = (input: ObserveTurnInput) => Promise<ObservedTurnCapture>;

export interface ObserverProbeMismatch {
  turnIndex: number;
  phase: ManifestPhase;
  expected: ObservedTurnCapture;
  actual: ObservedTurnCapture;
}

export interface ObserverProbeResult {
  probedTurns: number;
  mismatches: ObserverProbeMismatch[];
}

export interface GoldenCorpusEntry {
  description: string;
  provenance: string;
  scenario: ManifestScenario;
}

export interface GoldenCorpus {
  name: string;
  description: string;
  entries: Record<string, GoldenCorpusEntry>;
}

type LinkRow = {
  itemId: number;
  kind: ManifestKnowledgeItem['kind'];
  subtype: string | null;
  content: string;
  rationale: string | null;
  turnId: number;
  relation: 'captured' | 'reviewed' | 'rejected';
};

type EdgeRow = {
  fromItemId: number;
  toItemId: number;
  relation: ManifestEdge['relation'];
};

const issueTrackerManifest = loadManifest('issue-tracker');

export const curatedGoldenCorpus: GoldenCorpus = {
  name: 'Observer Golden Corpus',
  description:
    'Curated hybrid corpus for observer regression probes. Each entry reuses the trusted runtime-shaped manifest seam so captured sessions normalize into the same fixture format used by seeding.',
  entries: {
    'issue-tracker-scope': {
      description:
        'Scope-heavy issue-tracker session focused on goal / term / context / constraint discrimination.',
      provenance:
        'Bootstrap hybrid entry: normalized into the trusted manifest format so future confirmed-good captures can replace the source without changing the probe seam.',
      scenario: issueTrackerManifest.scenarios['scope-closed']!,
    },
    'issue-tracker-requirements': {
      description:
        'Multi-phase issue-tracker session that reaches requirements review and exercises observer handoff across scope, design, and requirements.',
      provenance:
        'Bootstrap hybrid entry: normalized into the trusted manifest format so future confirmed-good captures can replace the source without changing the probe seam.',
      scenario: issueTrackerManifest.scenarios['requirements-ready']!,
    },
  },
};

function makePlaceholders(count: number): string {
  return Array.from({ length: count }, () => '?').join(', ');
}

function sortObservedItems(items: ObservedKnowledgeItem[]): ObservedKnowledgeItem[] {
  return [...items].sort((left, right) =>
    JSON.stringify([left.content, left.rationale ?? null, left.subtype ?? null]).localeCompare(
      JSON.stringify([right.content, right.rationale ?? null, right.subtype ?? null]),
    ),
  );
}

function normalizeObservedItem(item: ObservedKnowledgeItem): ObservedKnowledgeItem {
  return {
    content: item.content,
    rationale: item.rationale ?? null,
    ...(item.subtype ? { subtype: item.subtype } : {}),
  };
}

function sortDependencies(dependencies: ObservedDependency[]): ObservedDependency[] {
  return [...dependencies].sort((left, right) =>
    JSON.stringify([left.sourceKind, left.sourceContent, left.targetKind, left.targetContent]).localeCompare(
      JSON.stringify([right.sourceKind, right.sourceContent, right.targetKind, right.targetContent]),
    ),
  );
}

export function createEmptyObservedTurnCapture(): ObservedTurnCapture {
  return {
    ...createKnowledgeCollectionRecord(() => [] as ObservedKnowledgeItem[]),
    dependencies: [],
  };
}

function normalizeObservedTurnCapture(capture: ObservedTurnCapture): ObservedTurnCapture {
  return {
    goals: sortObservedItems(capture.goals.map(normalizeObservedItem)),
    terms: sortObservedItems(capture.terms.map(normalizeObservedItem)),
    contexts: sortObservedItems(capture.contexts.map(normalizeObservedItem)),
    constraints: sortObservedItems(capture.constraints.map(normalizeObservedItem)),
    requirements: sortObservedItems(capture.requirements.map(normalizeObservedItem)),
    criteria: sortObservedItems(capture.criteria.map(normalizeObservedItem)),
    decisions: sortObservedItems(capture.decisions.map(normalizeObservedItem)),
    assumptions: sortObservedItems(capture.assumptions.map(normalizeObservedItem)),
    dependencies: sortDependencies(capture.dependencies),
  };
}

function getActivePathLinkRows(db: DB, projectId: number, activeTurnIds: number[]): LinkRow[] {
  if (activeTurnIds.length === 0) {
    return [];
  }

  const placeholders = makePlaceholders(activeTurnIds.length);
  return db.$client
    .prepare(
      `
        SELECT
          ki.id AS itemId,
          ki.kind AS kind,
          ki.subtype AS subtype,
          ki.content AS content,
          ki.rationale AS rationale,
          tki.turn_id AS turnId,
          tki.relation AS relation
        FROM turn_knowledge_item tki
        JOIN knowledge_item ki ON ki.id = tki.item_id
        WHERE
          ki.project_id = ?
          AND tki.turn_id IN (${placeholders})
          AND tki.relation IN ('captured', 'reviewed', 'rejected')
        ORDER BY ki.id ASC, tki.turn_id ASC
      `,
    )
    .all(projectId, ...activeTurnIds) as LinkRow[];
}

function getEdgesForItemIds(db: DB, itemIds: number[]): EdgeRow[] {
  if (itemIds.length === 0) {
    return [];
  }

  const placeholders = makePlaceholders(itemIds.length);
  return db.$client
    .prepare(
      `
        SELECT
          from_item_id AS fromItemId,
          to_item_id AS toItemId,
          relation
        FROM knowledge_edge
        WHERE from_item_id IN (${placeholders}) AND to_item_id IN (${placeholders})
        ORDER BY from_item_id ASC, to_item_id ASC, relation ASC
      `,
    )
    .all(...itemIds, ...itemIds) as EdgeRow[];
}

export function captureProjectToManifestScenario(db: DB, projectId: number): ManifestScenario {
  const turns = loadActivePathWithOptions(db, projectId);
  const turnIndexById = new Map(turns.map((turn, index) => [turn.id, index]));

  const manifestTurns = turns.flatMap((turn) => {
    if (turn.question) {
      const response = projectTurnResponse(turn);
      if (!response) {
        throw new Error(
          `Turn ${turn.id} is missing the structured response data required for trusted capture`,
        );
      }

      const options = turn.options ?? [];

      return {
        phase: turn.phase,
        question: turn.question,
        answer: turn.answer ?? '',
        why: turn.why ?? null,
        impact: turn.impact ?? null,
        options: options.map((option) => ({
          content: option.content,
          is_recommended: option.is_recommended,
        })),
        selectedOptionPositions: options
          .filter((option) => option.is_selected)
          .sort((left, right) => left.position - right.position)
          .map((option) => option.position),
        freeText: response.freeText ?? null,
      };
    }

    const isConfirmation = safeDeserializeUserParts(turn.user_parts).some(
      (part) => part.type === 'data-confirmation',
    );
    const isClosureProposal = Boolean(findPhaseOutcomeForTurn(db, projectId, turn.id));

    if (!isConfirmation && !isClosureProposal) {
      return [];
    }

    return {
      phase: turn.phase,
      question: '',
      answer: turn.answer ?? '',
      ...(isConfirmation ? { isConfirmation: true } : { isProposal: true }),
    };
  });

  const activeTurnIds = turns.map((turn) => turn.id);
  const linkRows = getActivePathLinkRows(db, projectId, activeTurnIds);
  const rowsByItemId = new Map<number, LinkRow[]>();
  for (const row of linkRows) {
    const rows = rowsByItemId.get(row.itemId) ?? [];
    rows.push(row);
    rowsByItemId.set(row.itemId, rows);
  }

  const itemIds = [...rowsByItemId.keys()].sort((left, right) => left - right);
  const itemIndexById = new Map<number, number>();
  const knowledgeItems = itemIds.map((itemId, index) => {
    itemIndexById.set(itemId, index);
    const rows = rowsByItemId.get(itemId) ?? [];
    const capturedRow = rows.find((row) => row.relation === 'captured');
    if (!capturedRow) {
      throw new Error(`Knowledge item ${itemId} is missing captured provenance on the active path`);
    }

    const reviewRows = rows.filter(
      (row): row is LinkRow & { relation: 'reviewed' | 'rejected' } =>
        row.relation === 'reviewed' || row.relation === 'rejected',
    );
    const latestReviewRow = reviewRows.at(-1);

    return {
      kind: capturedRow.kind,
      content: capturedRow.content,
      rationale: capturedRow.rationale,
      capturedAtTurn: turnIndexById.get(capturedRow.turnId)!,
      ...(latestReviewRow
        ? {
            reviewAction: latestReviewRow.relation,
            reviewedAtTurn: turnIndexById.get(latestReviewRow.turnId)!,
          }
        : {}),
    };
  });

  const edges = getEdgesForItemIds(db, itemIds)
    .map((edge) => ({
      fromItemIndex: itemIndexById.get(edge.fromItemId),
      toItemIndex: itemIndexById.get(edge.toItemId),
      relation: edge.relation,
    }))
    .filter(
      (
        edge,
      ): edge is {
        fromItemIndex: number;
        toItemIndex: number;
        relation: ManifestEdge['relation'];
      } => edge.fromItemIndex != null && edge.toItemIndex != null,
    );

  return {
    turns: manifestTurns,
    knowledgeItems,
    edges,
  };
}

function buildObserverProbePrefixScenario(scenario: ManifestScenario, turnIndex: number): ManifestScenario {
  const includedTurns = scenario.turns.slice(0, turnIndex + 1);
  const itemIndexMap = new Map<number, number>();

  const knowledgeItems = scenario.knowledgeItems.flatMap((item, itemIndex) => {
    if (item.capturedAtTurn >= turnIndex) {
      return [];
    }

    const normalizedItem: ManifestKnowledgeItem = {
      kind: item.kind,
      content: item.content,
      rationale: item.rationale ?? null,
      capturedAtTurn: item.capturedAtTurn,
      ...(item.reviewAction && item.reviewedAtTurn != null && item.reviewedAtTurn < turnIndex
        ? {
            reviewAction: item.reviewAction,
            reviewedAtTurn: item.reviewedAtTurn,
          }
        : {}),
    };
    itemIndexMap.set(itemIndex, itemIndexMap.size);
    return [normalizedItem];
  });

  const edges = scenario.edges.flatMap((edge) => {
    const fromItemIndex = itemIndexMap.get(edge.fromItemIndex);
    const toItemIndex = itemIndexMap.get(edge.toItemIndex);
    if (fromItemIndex == null || toItemIndex == null) {
      return [];
    }

    return [
      {
        fromItemIndex,
        toItemIndex,
        relation: edge.relation,
      },
    ];
  });

  return {
    turns: includedTurns,
    knowledgeItems,
    edges,
  };
}

function getCollectionKeyForKind(kind: ManifestKnowledgeItem['kind']): ObserverCollectionKey {
  if (kind === 'goal') return 'goals';
  if (kind === 'term') return 'terms';
  if (kind === 'context') return 'contexts';
  if (kind === 'constraint') return 'constraints';
  if (kind === 'requirement') return 'requirements';
  if (kind === 'criterion') return 'criteria';
  if (kind === 'decision') return 'decisions';
  return 'assumptions';
}

function buildExpectedTurnCapture(scenario: ManifestScenario, turnIndex: number): ObservedTurnCapture {
  const capture = createEmptyObservedTurnCapture();

  for (const item of scenario.knowledgeItems) {
    if (item.capturedAtTurn !== turnIndex) {
      continue;
    }

    capture[getCollectionKeyForKind(item.kind)].push({
      content: item.content,
      rationale: item.rationale ?? null,
    });
  }

  for (const edge of scenario.edges) {
    const source = scenario.knowledgeItems[edge.fromItemIndex];
    const target = scenario.knowledgeItems[edge.toItemIndex];
    if (!source || !target || edge.relation !== 'depends_on') {
      continue;
    }
    if (source.capturedAtTurn !== turnIndex) {
      continue;
    }
    if (
      (source.kind !== 'decision' && source.kind !== 'assumption') ||
      (target.kind !== 'decision' && target.kind !== 'assumption')
    ) {
      continue;
    }

    capture.dependencies.push({
      sourceKind: source.kind,
      sourceContent: source.content,
      targetKind: target.kind,
      targetContent: target.content,
    });
  }

  return normalizeObservedTurnCapture(capture);
}

function getAllEntityContentById(db: DB, projectId: number): Map<number, string> {
  const entities = getEntitiesForProject(db, projectId);
  const contentById = new Map<number, string>();

  for (const item of entities.goals) contentById.set(item.id, item.content);
  for (const item of entities.terms) contentById.set(item.id, item.content);
  for (const item of entities.contexts) contentById.set(item.id, item.content);
  for (const item of entities.constraints) contentById.set(item.id, item.content);
  for (const item of entities.requirements) contentById.set(item.id, item.content);
  for (const item of entities.criteria) contentById.set(item.id, item.content);
  for (const item of entities.decisions) contentById.set(item.id, item.content);
  for (const item of entities.assumptions) contentById.set(item.id, item.content);

  return contentById;
}

function getEntityIdByKindAndContent(
  db: DB,
  projectId: number,
  kind: DependencyKind,
  content: string,
): number {
  const entities = getEntitiesForProject(db, projectId);
  const collection = kind === 'decision' ? entities.decisions : entities.assumptions;
  const match = collection.find((item) => item.content === content);
  if (!match) {
    throw new Error(`Could not resolve ${kind} "${content}" while building observer probe output`);
  }
  return match.id;
}

export function buildExpectedObserverOutputForTurn(
  scenario: ManifestScenario,
  turnIndex: number,
  db: DB,
  projectId: number,
): ObserverOutput {
  const expectedCapture = buildExpectedTurnCapture(scenario, turnIndex);

  return {
    goals: expectedCapture.goals.map((item) => ({
      content: item.content,
      rationale: item.rationale ?? null,
    })),
    terms: expectedCapture.terms.map((item) => ({
      content: item.content,
      rationale: item.rationale ?? null,
    })),
    contexts: expectedCapture.contexts.map((item) => ({
      content: item.content,
      rationale: item.rationale ?? null,
    })),
    constraints: expectedCapture.constraints.map((item) => ({
      content: item.content,
      rationale: item.rationale ?? null,
      subtype: item.subtype ?? null,
    })),
    requirements: expectedCapture.requirements.map((item) => ({
      content: item.content,
      rationale: item.rationale ?? null,
    })),
    criteria: expectedCapture.criteria.map((item) => ({
      content: item.content,
      rationale: item.rationale ?? null,
    })),
    decisions: expectedCapture.decisions.map((item) => {
      const dependencies = expectedCapture.dependencies.filter(
        (dependency) => dependency.sourceKind === 'decision' && dependency.sourceContent === item.content,
      );
      return {
        content: item.content,
        rationale: item.rationale ?? null,
        parentDecisionIds: dependencies
          .filter((dependency) => dependency.targetKind === 'decision')
          .map((dependency) =>
            getEntityIdByKindAndContent(db, projectId, dependency.targetKind, dependency.targetContent),
          ),
        parentAssumptionIds: dependencies
          .filter((dependency) => dependency.targetKind === 'assumption')
          .map((dependency) =>
            getEntityIdByKindAndContent(db, projectId, dependency.targetKind, dependency.targetContent),
          ),
      };
    }),
    assumptions: expectedCapture.assumptions.map((item) => ({
      content: item.content,
      parentAssumptionIds: expectedCapture.dependencies
        .filter(
          (dependency) =>
            dependency.sourceKind === 'assumption' &&
            dependency.sourceContent === item.content &&
            dependency.targetKind === 'assumption',
        )
        .map((dependency) =>
          getEntityIdByKindAndContent(db, projectId, dependency.targetKind, dependency.targetContent),
        ),
    })),
  };
}

function collectObservedTurnCapture(
  db: DB,
  projectId: number,
  createdIds: Awaited<ReturnType<typeof runObserver>>,
): ObservedTurnCapture {
  const entities = getEntitiesForProject(db, projectId);
  const createdIdSet = new Set<number>([
    ...createdIds.goals,
    ...createdIds.terms,
    ...createdIds.contexts,
    ...createdIds.constraints,
    ...createdIds.requirements,
    ...createdIds.criteria,
    ...createdIds.decisions,
    ...createdIds.assumptions,
  ]);
  const contentById = getAllEntityContentById(db, projectId);

  const capture = createEmptyObservedTurnCapture();
  capture.goals = entities.goals
    .filter((item) => createdIdSet.has(item.id))
    .map((item) => ({ content: item.content, rationale: item.rationale ?? null }));
  capture.terms = entities.terms
    .filter((item) => createdIdSet.has(item.id))
    .map((item) => ({ content: item.content, rationale: item.rationale ?? null }));
  capture.contexts = entities.contexts
    .filter((item) => createdIdSet.has(item.id))
    .map((item) => ({ content: item.content, rationale: item.rationale ?? null }));
  capture.constraints = entities.constraints
    .filter((item) => createdIdSet.has(item.id))
    .map((item) => ({
      content: item.content,
      rationale: item.rationale ?? null,
      subtype: item.subtype ?? null,
    }));
  capture.requirements = entities.requirements
    .filter((item) => createdIdSet.has(item.id))
    .map((item) => ({ content: item.content, rationale: item.rationale ?? null }));
  capture.criteria = entities.criteria
    .filter((item) => createdIdSet.has(item.id))
    .map((item) => ({ content: item.content, rationale: item.rationale ?? null }));
  capture.decisions = entities.decisions
    .filter((item) => createdIdSet.has(item.id))
    .map((item) => ({ content: item.content, rationale: item.rationale ?? null }));
  capture.assumptions = entities.assumptions
    .filter((item) => createdIdSet.has(item.id))
    .map((item) => ({ content: item.content, rationale: null }));
  capture.dependencies = entities.relationships
    .filter(
      (relationship) =>
        relationship.type === 'depends_on' &&
        createdIdSet.has(relationship.source.id) &&
        (relationship.source.kind === 'decision' || relationship.source.kind === 'assumption') &&
        (relationship.target.kind === 'decision' || relationship.target.kind === 'assumption'),
    )
    .map((relationship) => {
      const source = contentById.get(relationship.source.id);
      const target = contentById.get(relationship.target.id);
      if (!source || !target) {
        throw new Error('Missing relationship endpoint while collecting observed turn capture');
      }

      return {
        sourceKind: relationship.source.kind as DependencyKind,
        sourceContent: source,
        targetKind: relationship.target.kind as DependencyKind,
        targetContent: target,
      };
    });

  return normalizeObservedTurnCapture(capture);
}

export async function observeTurnWithRunObserver(input: ObserveTurnInput): Promise<ObservedTurnCapture> {
  const createdIds = await runObserver(input.db, input.turn, input.projectId);
  return collectObservedTurnCapture(input.db, input.projectId, createdIds);
}

export async function probeObserverScenario(
  scenario: ManifestScenario,
  observeTurn: ObserveTurnFn = observeTurnWithRunObserver,
): Promise<ObserverProbeResult> {
  const questionTurnIndexes = scenario.turns.flatMap((turn, turnIndex) => (turn.question ? [turnIndex] : []));
  const mismatches: ObserverProbeMismatch[] = [];

  for (const turnIndex of questionTurnIndexes) {
    const probeDb = createDb();
    try {
      const probeScenario = buildObserverProbePrefixScenario(scenario, turnIndex);
      const projectId = seedFromManifest(probeDb, probeScenario, `Observer Probe ${turnIndex}`);
      const turn = loadActivePathWithOptions(probeDb, projectId).at(-1);
      if (!turn) {
        throw new Error(`Observer probe for turn ${turnIndex} could not load the active path turn`);
      }

      const actual = normalizeObservedTurnCapture(
        await observeTurn({
          db: probeDb,
          turn,
          projectId,
          turnIndex,
        }),
      );
      const expected = buildExpectedTurnCapture(scenario, turnIndex);

      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        mismatches.push({
          turnIndex,
          phase: scenario.turns[turnIndex]!.phase,
          expected,
          actual,
        });
      }
    } finally {
      probeDb.$client.close();
    }
  }

  return {
    probedTurns: questionTurnIndexes.length,
    mismatches,
  };
}
