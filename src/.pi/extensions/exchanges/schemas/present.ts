import * as z from 'zod';

import {
  zDisplayBase,
  zGraphNodeRef,
  zMarkdown,
  zPresentCandidatesToolMeta,
  zPresentDetailsHeader,
  zPresentOptionsToolMeta,
  zPresentQuestionToolMeta,
  zPresentReviewSetToolMeta,
} from './shared.js';

export const zPresentDisplay = zDisplayBase.extend({ preface: zMarkdown.optional() }).strict();
export const PresentDisplaySchema = z.toJSONSchema(zPresentDisplay, {
  unrepresentable: 'throw',
});

export const zPresentQuestionDetails = zPresentDetailsHeader
  .extend({
    tool_meta: zPresentQuestionToolMeta,
    display: zPresentDisplay,
  })
  .strict();
export type PresentQuestionDetails = z.infer<typeof zPresentQuestionDetails>;
export const PresentQuestionDetailsSchema = z.toJSONSchema(zPresentQuestionDetails, {
  unrepresentable: 'throw',
});

export const zPresentOption = z
  .object({
    id: z.string().min(1),
    content: zMarkdown,
    rationale: zMarkdown.optional(),
  })
  .strict();
export const PresentOptionSchema = z.toJSONSchema(zPresentOption, {
  unrepresentable: 'throw',
});

export const zPresentOptionsDetails = zPresentDetailsHeader
  .extend({
    tool_meta: zPresentOptionsToolMeta,
    display: zPresentDisplay,
    options: z.array(zPresentOption).min(1),
  })
  .strict();
export type PresentOptionsDetails = z.infer<typeof zPresentOptionsDetails>;
export const PresentOptionsDetailsSchema = z.toJSONSchema(zPresentOptionsDetails, {
  unrepresentable: 'throw',
});

export const zReviewSetEndpointRef = z.union([
  z.object({ draft_id: z.string().min(1) }).strict(),
  z.object({ existing_code: z.string().min(1) }).strict(),
]);
export const ReviewSetEndpointRefSchema = z.toJSONSchema(zReviewSetEndpointRef, {
  unrepresentable: 'throw',
});

export const zReviewSetNodeDraft = z
  .object({
    draft_id: z.string().min(1),
    plane: z.enum(['intent', 'oracle', 'design', 'plan']),
    kind: z.string().min(1),
    title: z.string().min(1),
    body: zMarkdown.optional(),
    detail: z.unknown().optional(),
  })
  .strict();
export const ReviewSetNodeDraftSchema = z.toJSONSchema(zReviewSetNodeDraft, {
  unrepresentable: 'throw',
});

export const zReviewSetEdgeDraft = z
  .object({
    category: z.string().min(1),
    source: zReviewSetEndpointRef,
    target: zReviewSetEndpointRef,
    stance: z.enum(['for', 'against']).optional(),
    rationale: zMarkdown.optional(),
  })
  .strict();
export const ReviewSetEdgeDraftSchema = z.toJSONSchema(zReviewSetEdgeDraft, {
  unrepresentable: 'throw',
});

export const zReviewSetDetailsPayload = z
  .object({
    nodes: z.array(zReviewSetNodeDraft).min(1),
    edges: z.array(zReviewSetEdgeDraft),
  })
  .strict();
export type ReviewSetDetailsPayload = z.infer<typeof zReviewSetDetailsPayload>;
export const ReviewSetDetailsPayloadSchema = z.toJSONSchema(zReviewSetDetailsPayload, {
  unrepresentable: 'throw',
});

export const zPresentReviewSetDetails = zPresentDetailsHeader
  .extend({
    tool_meta: zPresentReviewSetToolMeta,
    display: zDisplayBase,
    review_set: zReviewSetDetailsPayload,
  })
  .strict();
export type PresentReviewSetDetails = z.infer<typeof zPresentReviewSetDetails>;
export const PresentReviewSetDetailsSchema = z.toJSONSchema(zPresentReviewSetDetails, {
  unrepresentable: 'throw',
});

export const zCandidateUserRubric = z
  .object({
    core_bet: zMarkdown,
    best_fit: zMarkdown,
    cost_complexity: zMarkdown,
    covers_well: zMarkdown,
    main_risks: zMarkdown,
    lock_in_constraints: zMarkdown,
    recommendation: zMarkdown.optional(),
  })
  .strict();
export const CandidateUserRubricSchema = z.toJSONSchema(zCandidateUserRubric, {
  unrepresentable: 'throw',
});

export const zCandidateMetaRubric = z
  .object({
    legibility_cost_of_knowing: zMarkdown.optional(),
    failure_modes: zMarkdown.optional(),
    coverage_range: zMarkdown.optional(),
    commitment: zMarkdown.optional(),
  })
  .strict();
export const CandidateMetaRubricSchema = z.toJSONSchema(zCandidateMetaRubric, {
  unrepresentable: 'throw',
});

export const zPresentedCandidate = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    user_rubric: zCandidateUserRubric,
    meta_rubric: zCandidateMetaRubric,
    graph_refs: z.array(zGraphNodeRef),
  })
  .strict();
export const PresentedCandidateSchema = z.toJSONSchema(zPresentedCandidate, {
  unrepresentable: 'throw',
});

export const zPresentCandidatesDetails = zPresentDetailsHeader
  .extend({
    tool_meta: zPresentCandidatesToolMeta,
    display: zDisplayBase,
    candidates: z.array(zPresentedCandidate).min(1),
  })
  .strict();
export const PresentCandidatesDetailsSchema = z.toJSONSchema(zPresentCandidatesDetails, {
  unrepresentable: 'throw',
});

export const zPresentDetails = z.union([
  zPresentQuestionDetails,
  zPresentOptionsDetails,
  zPresentReviewSetDetails,
  zPresentCandidatesDetails,
]);
export type PresentDetails = z.infer<typeof zPresentDetails>;
export const PresentDetailsSchema = z.toJSONSchema(zPresentDetails, {
  unrepresentable: 'throw',
});
