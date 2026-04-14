import * as z from 'zod/v4';

import { phaseClosureBasisSchema, workflowPhaseSchema, type WorkflowPhase } from './phase-close.js';

export type { WorkflowPhase };

export const workflowPhaseStatusSchema = z.enum(['unstarted', 'in_progress', 'closed']);
export const readinessBandSchema = z.enum(['low', 'medium', 'high']);
export const impactSchema = z.enum(['high', 'medium', 'low']);
export const edgeRelationSchema = z.enum(['depends_on', 'derived_from', 'constrains', 'verifies', 'refines']);

export const projectModeSchema = z.enum(['greenfield', 'brownfield']);

export const projectSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  mode: projectModeSchema,
  cwd: z.string().nullable(),
  active_turn_id: z.number().int().positive().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const workflowSummarySchema = z.object({
  scope: workflowPhaseStatusSchema,
  design: workflowPhaseStatusSchema,
  requirements: workflowPhaseStatusSchema,
  criteria: workflowPhaseStatusSchema,
});

export const workflowPhaseStateSchema = z.object({
  status: workflowPhaseStatusSchema,
  closeability: z.boolean(),
  readiness: readinessBandSchema,
  closureBasis: phaseClosureBasisSchema.nullable(),
  proposalPending: z.boolean(),
  turnId: z.number().int().positive().nullable(),
  summary: z.string().nullable(),
});

export const workflowStateSchema = z.object({
  phases: z.object({
    scope: workflowPhaseStateSchema,
    design: workflowPhaseStateSchema,
    requirements: workflowPhaseStateSchema,
    criteria: workflowPhaseStateSchema,
  }),
});

export const turnOptionSchema = z.object({
  id: z.number().int().positive(),
  position: z.number().int().min(0),
  content: z.string(),
  is_recommended: z.boolean(),
  is_selected: z.boolean(),
});

const capturedTurnItemSchema = z.object({
  collection: z.enum(['knowledge_item', 'decision', 'assumption']),
  kind: z.enum([
    'goal',
    'term',
    'context',
    'constraint',
    'requirement',
    'criterion',
    'decision',
    'assumption',
  ]),
  id: z.number().int().positive(),
  content: z.string(),
  referenceCode: z.string().optional(),
});

export const projectStateTurnSchema = z.object({
  id: z.number().int().positive(),
  project_id: z.number().int().positive(),
  parent_turn_id: z.number().int().positive().nullable(),
  phase: workflowPhaseSchema,
  question: z.string(),
  why: z.string().nullable(),
  impact: impactSchema.nullable(),
  answer: z.string().nullable(),
  is_resolution: z.boolean(),
  user_parts: z.string().nullable(),
  assistant_parts: z.string().nullable(),
  created_at: z.string(),
  options: z.array(turnOptionSchema).optional(),
  captured_items: z.array(capturedTurnItemSchema).optional(),
});

export const createProjectRequestSchema = z
  .object({
    name: z.string().trim().min(1),
    mode: projectModeSchema.optional(),
  })
  .strict();

export const createProjectResponseSchema = projectSchema;

export const projectListItemSchema = projectSchema.extend({
  workflowSummary: workflowSummarySchema,
});

export const projectListItemsSchema = z.array(projectListItemSchema);

export const projectStateSchema = z.object({
  project: projectSchema,
  workflow: workflowStateSchema,
  turns: z.array(projectStateTurnSchema),
});

const knowledgeItemKindSchema = z.enum([
  'goal',
  'term',
  'context',
  'constraint',
  'requirement',
  'criterion',
  'decision',
  'assumption',
]);
export const reviewStatusSchema = z.enum(['approved', 'rejected', 'pending']);

export const knowledgeItemSchema = z.object({
  id: z.number().int().positive(),
  project_id: z.number().int().positive(),
  kind: knowledgeItemKindSchema,
  subtype: z.string().nullable(),
  content: z.string(),
  rationale: z.string().nullable(),
  referenceCode: z.string().optional(),
});

export const requirementEntitySchema = z.object({
  id: z.number().int().positive(),
  project_id: z.number().int().positive(),
  kind: z.literal('requirement'),
  subtype: z.string().nullable(),
  content: z.string(),
  rationale: z.string().nullable(),
  reviewStatus: reviewStatusSchema.optional(),
  referenceCode: z.string().optional(),
});

export const criterionEntitySchema = z.object({
  id: z.number().int().positive(),
  project_id: z.number().int().positive(),
  kind: z.literal('criterion'),
  subtype: z.string().nullable(),
  content: z.string(),
  rationale: z.string().nullable(),
  reviewStatus: reviewStatusSchema.optional(),
  referenceCode: z.string().optional(),
});

export const decisionEntitySchema = z.object({
  id: z.number().int().positive(),
  project_id: z.number().int().positive(),
  content: z.string(),
  rationale: z.string().nullable(),
  referenceCode: z.string().optional(),
});

export const assumptionEntitySchema = z.object({
  id: z.number().int().positive(),
  project_id: z.number().int().positive(),
  content: z.string(),
  referenceCode: z.string().optional(),
});

export const entityReferenceSchema = z.object({
  collection: z.enum(['knowledge_item', 'decision', 'assumption']),
  kind: z.enum([
    'goal',
    'term',
    'context',
    'constraint',
    'requirement',
    'criterion',
    'decision',
    'assumption',
  ]),
  id: z.number().int().positive(),
});

export const entityRelationshipSchema = z.object({
  type: edgeRelationSchema,
  source: entityReferenceSchema,
  target: entityReferenceSchema,
});

export const entitiesDataSchema = z.object({
  goals: z.array(knowledgeItemSchema),
  terms: z.array(knowledgeItemSchema),
  contexts: z.array(knowledgeItemSchema),
  constraints: z.array(knowledgeItemSchema),
  requirements: z.array(requirementEntitySchema),
  criteria: z.array(criterionEntitySchema),
  decisions: z.array(decisionEntitySchema),
  assumptions: z.array(assumptionEntitySchema),
  relationships: z.array(entityRelationshipSchema),
});

export const exportLoaderDataSchema = z.discriminatedUnion('ready', [
  z.object({
    ready: z.literal(false),
  }),
  z.object({
    ready: z.literal(true),
    markdown: z.string(),
  }),
]);

export const mutationErrorResponseSchema = z.object({
  error: z.string().optional(),
});

export const submitTurnResponseSelectionRequestSchema = z.object({
  kind: z.literal('select-options'),
  positions: z.array(z.number().int().min(0)).min(1),
  freeText: z.string().trim().min(1).optional(),
});

export const submitTurnResponseFreeTextRequestSchema = z.object({
  kind: z.literal('free-text'),
  freeText: z.string().trim().min(1),
});

export const submitTurnResponseRequestSchema = z.discriminatedUnion('kind', [
  submitTurnResponseSelectionRequestSchema,
  submitTurnResponseFreeTextRequestSchema,
]);

export const submitTurnResponseResponseSchema = z.object({
  ok: z.literal(true),
});

export type ProjectMode = z.infer<typeof projectModeSchema>;
export type Impact = z.infer<typeof impactSchema>;
export type ReviewStatus = z.infer<typeof reviewStatusSchema>;
export type EdgeRelation = z.infer<typeof edgeRelationSchema>;
export type WorkflowPhaseStatus = z.infer<typeof workflowPhaseStatusSchema>;
export type ReadinessBand = z.infer<typeof readinessBandSchema>;
export type Project = z.infer<typeof projectSchema>;
export type CreateProjectRequest = z.infer<typeof createProjectRequestSchema>;
export type CreateProjectResponse = z.infer<typeof createProjectResponseSchema>;
export type WorkflowSummary = z.infer<typeof workflowSummarySchema>;
export type WorkflowPhaseState = z.infer<typeof workflowPhaseStateSchema>;
export type WorkflowState = z.infer<typeof workflowStateSchema>;
export type TurnOption = z.infer<typeof turnOptionSchema>;
export type ProjectStateTurn = z.infer<typeof projectStateTurnSchema>;
export type ProjectListItem = z.infer<typeof projectListItemSchema>;
export type ProjectState = z.infer<typeof projectStateSchema>;
export type KnowledgeItem = z.infer<typeof knowledgeItemSchema>;
export type RequirementEntity = z.infer<typeof requirementEntitySchema>;
export type CriterionEntity = z.infer<typeof criterionEntitySchema>;
export type DecisionEntity = z.infer<typeof decisionEntitySchema>;
export type AssumptionEntity = z.infer<typeof assumptionEntitySchema>;
export type EntityReference = z.infer<typeof entityReferenceSchema>;
export type EntityRelationship = z.infer<typeof entityRelationshipSchema>;
export type EntitiesData = z.infer<typeof entitiesDataSchema>;
export type ExportLoaderData = z.infer<typeof exportLoaderDataSchema>;
export type MutationErrorResponse = z.infer<typeof mutationErrorResponseSchema>;
export type SubmitTurnResponseSelectionRequest = z.infer<typeof submitTurnResponseSelectionRequestSchema>;
export type SubmitTurnResponseFreeTextRequest = z.infer<typeof submitTurnResponseFreeTextRequestSchema>;
export type SubmitTurnResponseRequest = z.infer<typeof submitTurnResponseRequestSchema>;
export type SubmitTurnResponseResponse = z.infer<typeof submitTurnResponseResponseSchema>;
