import * as z from 'zod/v4';

import { reviewActionSchema, reviewItemCommentSchema } from './chat.js';
import { knowledgeEntityCollections, knowledgeKinds } from './knowledge.js';
import { phaseClosureBasisSchema, workflowPhaseSchema, type WorkflowPhase } from './phase-close.js';
import { phaseIntentRequestSchema } from './phase-intents.js';

export type { WorkflowPhase };

export const workflowPhaseStatusSchema = z.enum(['unstarted', 'in_progress', 'closed']);
export const readinessBandSchema = z.enum(['low', 'medium', 'high']);
export const impactSchema = z.enum(['high', 'medium', 'low']);
export const turnKindSchema = z.enum(['question', 'kickoff', 'recovery']);
export const edgeRelationSchema = z.enum(['depends_on', 'derived_from', 'constrains', 'verifies', 'refines']);

export const specificationModeSchema = z.enum(['greenfield', 'brownfield']);

export const specificationSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  mode: specificationModeSchema,
  active_turn_id: z.number().int().positive().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const workflowSummarySchema = z.object({
  grounding: workflowPhaseStatusSchema,
  design: workflowPhaseStatusSchema,
  requirements: workflowPhaseStatusSchema,
  criteria: workflowPhaseStatusSchema,
  currentReadiness: readinessBandSchema.nullable(),
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
    grounding: workflowPhaseStateSchema,
    design: workflowPhaseStateSchema,
    requirements: workflowPhaseStateSchema,
    criteria: workflowPhaseStateSchema,
  }),
});

export const kickoffLandingModeSchema = z.enum(['start', 'continue']);
export const specificationLandingSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('kickoff'),
    phase: workflowPhaseSchema,
    mode: kickoffLandingModeSchema,
  }),
  z.object({
    kind: z.literal('frontier-turn'),
    phase: workflowPhaseSchema,
    turnId: z.number().int().positive(),
  }),
  z.object({
    kind: z.literal('recovery'),
    phase: workflowPhaseSchema,
  }),
]);

export const turnOptionSchema = z.object({
  id: z.number().int().positive(),
  position: z.number().int().min(0),
  content: z.string(),
  is_recommended: z.boolean(),
  is_selected: z.boolean(),
});

const capturedTurnItemSchema = z.object({
  collection: z.enum(knowledgeEntityCollections),
  kind: z.enum(knowledgeKinds),
  id: z.number().int().positive(),
  content: z.string(),
  referenceCode: z.string().optional(),
});

export const specificationStateTurnSchema = z.object({
  id: z.number().int().positive(),
  specification_id: z.number().int().positive(),
  parent_turn_id: z.number().int().positive().nullable(),
  phase: workflowPhaseSchema,
  turn_kind: turnKindSchema.optional(),
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

export const createSpecificationRequestSchema = z
  .object({
    name: z.string().trim().min(1),
    mode: specificationModeSchema.optional(),
  })
  .strict();

export const createSpecificationResponseSchema = specificationSchema;

export const specificationListItemSchema = specificationSchema.extend({
  workflowSummary: workflowSummarySchema,
});

export const specificationListItemsSchema = z.array(specificationListItemSchema);

export const secondaryChatStateSchema = z.object({
  chat: z.object({
    id: z.number().int().positive(),
    specification_id: z.number().int().positive(),
    kind: z.string(),
    parent_chat_id: z.number().int().positive().nullable(),
    invoked_in_turn_id: z.number().int().positive().nullable(),
    pinned_item_id: z.number().int().positive().nullable(),
    pinned_span_hint: z.string().nullable(),
  }),
  kickoffTurn: specificationStateTurnSchema.nullable(),
});

export const specificationStateSchema = z.object({
  specification: specificationSchema,
  workflow: workflowStateSchema,
  landing: specificationLandingSchema.nullable().optional(),
  turns: z.array(specificationStateTurnSchema),
  structuralArtifactTurnIds: z.array(z.number().int().positive()).optional(),
  secondaryChats: z.array(secondaryChatStateSchema).optional(),
});

const knowledgeItemKindSchema = z.enum(knowledgeKinds);

function specificationOwnedSchema<T extends z.ZodRawShape>(shape: T) {
  return z.object({
    specification_id: z.number().int().positive(),
    ...shape,
  });
}

export const knowledgeItemSchema = specificationOwnedSchema({
  id: z.number().int().positive(),
  kind: knowledgeItemKindSchema,
  subtype: z.string().nullable(),
  content: z.string(),
  rationale: z.string().nullable(),
  referenceCode: z.string().optional(),
});

export const requirementEntitySchema = specificationOwnedSchema({
  id: z.number().int().positive(),
  kind: z.literal('requirement'),
  subtype: z.string().nullable(),
  content: z.string(),
  rationale: z.string().nullable(),
  referenceCode: z.string().optional(),
});

export const criterionEntitySchema = specificationOwnedSchema({
  id: z.number().int().positive(),
  kind: z.literal('criterion'),
  subtype: z.string().nullable(),
  content: z.string(),
  rationale: z.string().nullable(),
  referenceCode: z.string().optional(),
});

export const decisionEntitySchema = specificationOwnedSchema({
  id: z.number().int().positive(),
  content: z.string(),
  rationale: z.string().nullable(),
  referenceCode: z.string().optional(),
});

export const assumptionEntitySchema = specificationOwnedSchema({
  id: z.number().int().positive(),
  content: z.string(),
  referenceCode: z.string().optional(),
});

export const entityReferenceSchema = z.object({
  collection: z.enum(knowledgeEntityCollections),
  kind: z.enum(knowledgeKinds),
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
  reviewAction: reviewActionSchema.optional(),
  itemComments: z.array(reviewItemCommentSchema).optional(),
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
  advancedToPhase: workflowPhaseSchema.optional(),
  workflowCompleted: z.literal(true).optional(),
});

export const submitPhaseIntentRequestSchema = phaseIntentRequestSchema;

export const submitPhaseIntentResponseSchema = z.object({
  ok: z.literal(true),
});

export const submitObserverCaptureResponseSchema = z.object({
  ok: z.literal(true),
  turnId: z.number().int().positive(),
  status: z.enum(['captured', 'already-captured']),
});

export type SpecificationMode = z.infer<typeof specificationModeSchema>;
export type Impact = z.infer<typeof impactSchema>;
export type TurnKind = z.infer<typeof turnKindSchema>;
export type ReviewAction = z.infer<typeof reviewActionSchema>;
export type SubmitPhaseIntentRequest = z.infer<typeof submitPhaseIntentRequestSchema>;
export type SubmitPhaseIntentResponse = z.infer<typeof submitPhaseIntentResponseSchema>;
export type SubmitObserverCaptureResponse = z.infer<typeof submitObserverCaptureResponseSchema>;
export type EdgeRelation = z.infer<typeof edgeRelationSchema>;
export type WorkflowPhaseStatus = z.infer<typeof workflowPhaseStatusSchema>;
export type ReadinessBand = z.infer<typeof readinessBandSchema>;
export type Specification = z.infer<typeof specificationSchema>;
export type CreateSpecificationRequest = z.infer<typeof createSpecificationRequestSchema>;
export type CreateSpecificationResponse = z.infer<typeof createSpecificationResponseSchema>;
export type WorkflowSummary = z.infer<typeof workflowSummarySchema>;
export type WorkflowPhaseState = z.infer<typeof workflowPhaseStateSchema>;
export type WorkflowState = z.infer<typeof workflowStateSchema>;
export type KickoffLandingMode = z.infer<typeof kickoffLandingModeSchema>;
export type SpecificationLanding = z.infer<typeof specificationLandingSchema>;
export type TurnOption = z.infer<typeof turnOptionSchema>;
export type SpecificationStateTurn = z.infer<typeof specificationStateTurnSchema>;
export type SpecificationListItem = z.infer<typeof specificationListItemSchema>;
export type SpecificationState = z.infer<typeof specificationStateSchema>;
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
