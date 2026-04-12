import * as z from 'zod/v4';

import { phaseClosureBasisSchema, workflowPhaseSchema } from './phase-close.js';

export const workflowPhaseStatusSchema = z.enum(['unstarted', 'in_progress', 'closed']);
export const readinessBandSchema = z.enum(['low', 'medium', 'high']);

export const projectSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
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

export const projectStateTurnSchema = z.object({
  id: z.number().int().positive(),
  project_id: z.number().int().positive(),
  parent_turn_id: z.number().int().positive().nullable(),
  phase: workflowPhaseSchema,
  question: z.string(),
  why: z.string().nullable(),
  impact: z.enum(['high', 'medium', 'low']).nullable(),
  answer: z.string().nullable(),
  is_resolution: z.boolean(),
  user_parts: z.string().nullable(),
  assistant_parts: z.string().nullable(),
  created_at: z.string(),
  options: z.array(turnOptionSchema).optional(),
});

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
const reviewStatusSchema = z.enum(['approved', 'rejected', 'pending']);

export const knowledgeItemSchema = z.object({
  id: z.number().int().positive(),
  project_id: z.number().int().positive(),
  kind: knowledgeItemKindSchema,
  subtype: z.string().nullable(),
  content: z.string(),
  rationale: z.string().nullable(),
});

export const requirementEntitySchema = z.object({
  id: z.number().int().positive(),
  project_id: z.number().int().positive(),
  kind: knowledgeItemKindSchema,
  subtype: z.string().nullable(),
  content: z.string(),
  rationale: z.string().nullable(),
  reviewStatus: reviewStatusSchema.optional(),
});

export const criterionEntitySchema = z.object({
  id: z.number().int().positive(),
  project_id: z.number().int().positive(),
  kind: knowledgeItemKindSchema,
  subtype: z.string().nullable(),
  content: z.string(),
  rationale: z.string().nullable(),
  reviewStatus: reviewStatusSchema.optional(),
});

export const decisionEntitySchema = z.object({
  id: z.number().int().positive(),
  project_id: z.number().int().positive(),
  content: z.string(),
  rationale: z.string().nullable(),
});

export const assumptionEntitySchema = z.object({
  id: z.number().int().positive(),
  project_id: z.number().int().positive(),
  content: z.string(),
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
  type: z.literal('depends_on'),
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

export const exportLoaderDataSchema = z.object({
  ready: z.boolean(),
  markdown: z.string().optional(),
});

export const mutationErrorResponseSchema = z.object({
  error: z.string().optional(),
});

export const submitTurnResponseRequestSchema = z
  .object({
    positions: z.array(z.number().int().min(0)).optional(),
    freeText: z.string().trim().min(1).optional(),
  })
  .superRefine((value, ctx) => {
    if ((value.positions?.length ?? 0) === 0 && !value.freeText) {
      ctx.addIssue({
        code: 'custom',
        message: 'positions are required unless freeText is provided',
        path: ['positions'],
      });
    }
  });

export const submitTurnResponseResponseSchema = z.object({
  ok: z.literal(true),
});

export type WorkflowPhaseStatus = z.infer<typeof workflowPhaseStatusSchema>;
export type ReadinessBand = z.infer<typeof readinessBandSchema>;
export type Project = z.infer<typeof projectSchema>;
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
export type SubmitTurnResponseRequest = z.infer<typeof submitTurnResponseRequestSchema>;
export type SubmitTurnResponseResponse = z.infer<typeof submitTurnResponseResponseSchema>;
