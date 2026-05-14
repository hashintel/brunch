import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_FOLDER = join(__dirname, '..', '..', 'drizzle');

import * as schema from './schema.js';

export {
  createAnnotation,
  deleteAnnotation,
  getAnnotation,
  getAnnotationsForSpecification,
} from './db/annotation-store.js';
export type { Annotation, CreateAnnotationInput } from './db/annotation-store.js';

export { getDownstreamEdges, getDownstreamItems, isItemInActiveReviewSet } from './db/edit-impact-store.js';
export type { DownstreamEdge, DownstreamItem } from './db/edit-impact-store.js';

import {
  addKnowledgeRelationship,
  createKnowledgeItem,
  linkKnowledgeItemToTurn,
} from './db/intent-graph-store.js';
import type { Assumption, Decision, KnowledgeItem, KnowledgeKind } from './db/intent-graph-store.js';
export {
  addAssumptionParentAssumption,
  addDecisionParentAssumption,
  addDecisionParentDecision,
  addKnowledgeRelationship,
  createAssumption,
  createDecision,
  createKnowledgeItem,
  getKnowledgeItem,
  linkAssumptionToTurn,
  linkDecisionToTurn,
  linkKnowledgeItemToTurn,
  removeKnowledgeRelationship,
  updateKnowledgeItemContent,
} from './db/intent-graph-store.js';
export type { Assumption, Decision, KnowledgeItem, KnowledgeKind } from './db/intent-graph-store.js';

export {
  materializeAcceptedCriteriaReviewSet,
  materializeAcceptedRequirementsReviewSet,
} from './db/review-materialization-store.js';

export {
  getAcceptedCriterionEntitiesForSpecification,
  getAcceptedKnowledgeItemIdsForPhase,
  getAcceptedRequirementEntitiesForSpecification,
  getCapturedItemsForTurns,
  getEntitiesForSpecification,
  getEntitiesForSpecificationByMode,
  getEntitiesForSpecificationOnActivePath,
  getGroundingBundleForSpecification,
} from './db/entity-projection-store.js';
export type {
  CriterionEntity,
  EntitiesForSpecification,
  EntityCollection,
  EntityProjectionMode,
  EntityReference,
  EntityRelationship,
  RequirementEntity,
} from './db/entity-projection-store.js';

export {
  confirmPhaseOutcome,
  createConfirmedPhaseOutcome,
  createPhaseOutcome,
  findPhaseOutcomeForTurn,
  findProposedPhaseOutcomeByTurn,
  getCurrentPhase,
  getCurrentWorkflowState,
  getStructuralArtifactTurnIds,
  listPhaseOutcomesForSpecification,
  readWorkflowProjectionSnapshot,
  supersedePhaseOutcome,
} from './db/workflow-store.js';
export type {
  ClosureBasis,
  CreatePhaseOutcomeInput,
  PhaseOutcome,
  PhaseOutcomeStatus,
  ReadinessBand,
  WorkflowPhaseState,
  WorkflowPhaseStatus,
  WorkflowState,
} from './db/workflow-store.js';

export {
  claimReconciliationNeedForClassification,
  getCascadeRelationBetween,
  getReconciliationNeed,
  listOpenReconciliationNeeds,
  listOpenReconciliationNeedsAwaitingClassification,
  openReconciliationNeed,
  openReconciliationNeedIfAbsent,
  resolveReconciliationNeed,
  updateReconciliationNeedAgentFields,
} from './db/reconciliation-store.js';
export type {
  OpenReconciliationNeedInput,
  ReconciliationNeed,
  ReconciliationNeedAgentClassification,
  ReconciliationNeedAgentStatus,
  ReconciliationNeedKind,
} from './db/reconciliation-store.js';

export {
  advanceHead,
  applyTurnResponseSelections,
  createOption,
  createSpecification,
  createTurn,
  getActivePath,
  getOptionsForTurn,
  getOrCreateSpecification,
  getSpecification,
  getTurn,
  listSpecifications,
  updateSpecificationMode,
  updateTurn,
} from './db/specification-store.js';
export type {
  CreateOptionInput,
  CreateSpecificationOptions,
  CreateTurnInput,
  Impact,
  Option,
  Phase,
  Specification,
  Turn,
  UpdateTurnInput,
} from './db/specification-store.js';

export type DB = ReturnType<typeof drizzle<typeof schema>>;
export function createDb(path: string = ':memory:'): DB {
  const sqlite = new Database(path);
  sqlite.pragma('journal_mode = WAL');
  // Foreign keys OFF during migration so table-recreation migrations
  // (DROP TABLE + rename) don't hit FK constraint errors. The PRAGMA
  // is a no-op inside a transaction, so it must be set before migrate().
  sqlite.pragma('foreign_keys = OFF');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  sqlite.pragma('foreign_keys = ON');
  return db;
}
