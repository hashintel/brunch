import { createKnowledgeCollectionRecord } from '@/shared/knowledge.js';

import type { TurnWithOptions } from '../core.js';
import { loadActivePathWithOptions } from '../core.js';
import { advanceHead, createDb, createProject, createTurn, getEntitiesForProject, type DB } from '../db.js';
import { runObserver, type ObserverOutput } from '../observer.js';
import { projectRuntimeTurnToManifestTurn } from './durable-manifest-contract.js';
import { type ManifestEdge, type ManifestKnowledgeItem, type ManifestScenario } from './manifest.js';
import { seedRequirementsReady, type ScenarioFn } from './scenarios.js';

type ObserverProbePhase = TurnWithOptions['phase'];
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
  phase: ObserverProbePhase;
  expected: ObservedTurnCapture;
  actual: ObservedTurnCapture;
}

export interface ObserverProbeResult {
  probedTurns: number;
  mismatches: ObserverProbeMismatch[];
}

export interface ObserverProbeScenario {
  phase: ObserverProbePhase;
  seedProject: ScenarioFn;
  expectedCapture: ObservedTurnCapture;
}

export interface GoldenCorpusEntry {
  description: string;
  provenance: string;
  scenario: ObserverProbeScenario;
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

const seedIssueTrackerScopeProbe: ScenarioFn = (db, projectName = 'Observer scope probe') => {
  const project = createProject(db, projectName);
  const turn = createTurn(db, project.id, {
    phase: 'scope',
    question: 'What is the primary goal of this issue tracker?',
    answer:
      'Replace our spreadsheet with a simple tracker that keeps ownership visible and records status-change history.',
  });
  advanceHead(db, project.id, turn.id);
  return project.id;
};

const seedIssueTrackerRequirementsProbe: ScenarioFn = (db, projectName = 'Observer requirements probe') => {
  const project = createProject(db, projectName);
  const { designConfirmationTurn } = seedRequirementsReady(db, project.id);
  const turn = createTurn(db, project.id, {
    phase: 'requirements',
    parent_turn_id: designConfirmationTurn.id,
    question: 'Which requirements are still missing from the first release?',
    answer:
      'Create tickets with title, description, priority, and assignee, plus preserve a visible audit trail for every status change.',
  });
  advanceHead(db, project.id, turn.id);
  return project.id;
};

export const curatedGoldenCorpus: GoldenCorpus = {
  name: 'Observer Golden Corpus',
  description:
    'Curated TypeScript-native observer probes that seed projects directly through fixture builders or direct DB setup.',
  entries: {
    'issue-tracker-scope': {
      description:
        'Issue-tracker grounding probe focused on goal / term / context / constraint discrimination from one answered scope turn.',
      provenance: 'Direct TypeScript seed setup for the current observer probe seam.',
      scenario: {
        phase: 'scope',
        seedProject: seedIssueTrackerScopeProbe,
        expectedCapture: {
          goals: [{ content: 'Replace spreadsheet issue tracking with a durable workflow', rationale: null }],
          terms: [{ content: 'ticket', rationale: 'Trackable work item with visible ownership and status.' }],
          contexts: [
            { content: 'The team currently uses a spreadsheet to manage issue status', rationale: null },
          ],
          constraints: [
            {
              content: 'Keep the first release simple enough for a small team to adopt quickly',
              rationale: null,
            },
          ],
          requirements: [],
          criteria: [],
          decisions: [],
          assumptions: [],
          dependencies: [],
        },
      },
    },
    'issue-tracker-requirements': {
      description:
        'Issue-tracker requirements probe that keeps review-mode observer coverage without relying on manifest-shaped setup.',
      provenance: 'Direct TypeScript seed setup for the current observer probe seam.',
      scenario: {
        phase: 'requirements',
        seedProject: seedIssueTrackerRequirementsProbe,
        expectedCapture: {
          goals: [],
          terms: [],
          contexts: [],
          constraints: [],
          requirements: [
            {
              content:
                'Create, edit, and close tickets with title, description, priority, and assignee fields',
              rationale: 'Captures the core ticket workflow the first release must support.',
            },
            {
              content: 'Record every status change with actor identity and timestamp in an audit trail',
              rationale: 'Preserves the compliance-sensitive audit behavior described in grounding.',
            },
          ],
          criteria: [],
          decisions: [],
          assumptions: [],
          dependencies: [],
        },
      },
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
  const authorityTurns = turns.flatMap((turn) => {
    const manifestTurn = projectRuntimeTurnToManifestTurn({ db, projectId, turn });
    return manifestTurn ? [{ turnId: turn.id, manifestTurn }] : [];
  });
  const turnIndexById = new Map(authorityTurns.map(({ turnId }, index) => [turnId, index]));
  const manifestTurns = authorityTurns.map(({ manifestTurn }) => manifestTurn);

  const activeTurnIds = authorityTurns.map(({ turnId }) => turnId);
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

function buildExpectedTurnCapture(scenario: ObserverProbeScenario): ObservedTurnCapture {
  return normalizeObservedTurnCapture(scenario.expectedCapture);
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
  scenario: ObserverProbeScenario,
  turnIndex: number,
  db: DB,
  projectId: number,
): ObserverOutput {
  if (turnIndex !== 0) {
    throw new Error(
      `Observer probe scenarios currently expose a single probe turn, received index ${turnIndex}`,
    );
  }

  const expectedCapture = buildExpectedTurnCapture(scenario);

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
    ...createdIds.entityIds.goals,
    ...createdIds.entityIds.terms,
    ...createdIds.entityIds.contexts,
    ...createdIds.entityIds.constraints,
    ...createdIds.entityIds.requirements,
    ...createdIds.entityIds.criteria,
    ...createdIds.entityIds.decisions,
    ...createdIds.entityIds.assumptions,
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
  capture.requirements =
    createdIds.draftReviewItems.requirements.length > 0
      ? createdIds.draftReviewItems.requirements.map((item) => ({
          content: item.content,
          rationale: item.rationale ?? null,
        }))
      : entities.requirements
          .filter((item) => createdIdSet.has(item.id))
          .map((item) => ({ content: item.content, rationale: item.rationale ?? null }));
  capture.criteria =
    createdIds.draftReviewItems.criteria.length > 0
      ? createdIds.draftReviewItems.criteria.map((item) => ({
          content: item.content,
          rationale: item.rationale ?? null,
        }))
      : entities.criteria
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
  const createdIds = await runObserver(input.db, input.turn as import('../db.js').Turn, input.projectId);
  return collectObservedTurnCapture(input.db, input.projectId, createdIds);
}

export async function probeObserverScenario(
  scenario: ObserverProbeScenario,
  observeTurn: ObserveTurnFn = observeTurnWithRunObserver,
): Promise<ObserverProbeResult> {
  const probeDb = createDb();

  try {
    const turnIndex = 0;
    const projectId = scenario.seedProject(probeDb, `Observer Probe ${scenario.phase}`);
    const turn = loadActivePathWithOptions(probeDb, projectId).at(-1);
    if (!turn) {
      throw new Error(`Observer probe for phase ${scenario.phase} could not load the active path turn`);
    }

    const actual = normalizeObservedTurnCapture(
      await observeTurn({
        db: probeDb,
        turn,
        projectId,
        turnIndex,
      }),
    );
    const expected = buildExpectedTurnCapture(scenario);

    return {
      probedTurns: 1,
      mismatches:
        JSON.stringify(actual) === JSON.stringify(expected)
          ? []
          : [
              {
                turnIndex,
                phase: scenario.phase,
                expected,
                actual,
              },
            ],
    };
  } finally {
    probeDb.$client.close();
  }
}
