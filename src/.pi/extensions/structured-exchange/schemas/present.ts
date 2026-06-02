import * as z from 'zod';

import { zGraphNodeRef, zMarkdown, zPresentDetailsHeader } from './shared.js';

export const zPresentDisplay = z
  .object({
    heading: z.string().min(1),
    body: zMarkdown.optional(),
    preface: zMarkdown.optional(),
  })
  .strict();
export type PresentDisplay = z.infer<typeof zPresentDisplay>;
export const PresentDisplaySchema = z.toJSONSchema(zPresentDisplay, {
  unrepresentable: 'throw',
});

export const zPresentQuestionDetails = zPresentDetailsHeader
  .extend({
    tool_meta: z
      .object({
        curr: z.literal('present_question'),
        next: z.literal('request_answer'),
      })
      .strict(),
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
export type PresentOption = z.infer<typeof zPresentOption>;
export const PresentOptionSchema = z.toJSONSchema(zPresentOption, {
  unrepresentable: 'throw',
});

export const zPresentOptionsDetails = zPresentDetailsHeader
  .extend({
    tool_meta: z
      .object({
        curr: z.literal('present_options'),
        next: z.enum(['request_choice', 'request_choices']),
      })
      .strict(),
    display: zPresentDisplay,
    options: z.array(zPresentOption).min(1),
  })
  .strict();
export type PresentOptionsDetails = z.infer<typeof zPresentOptionsDetails>;
export const PresentOptionsDetailsSchema = z.toJSONSchema(zPresentOptionsDetails, {
  unrepresentable: 'throw',
});

export const zPresentReviewSetDetails = zPresentDetailsHeader
  .extend({
    tool_meta: z
      .object({
        curr: z.literal('present_review_set'),
        next: z.literal('request_review'),
      })
      .strict(),
    display: zPresentDisplay,
    review_set: z
      .object({
        proposal_entry_id: z.string().min(1),
      })
      .strict(),
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
export type CandidateUserRubric = z.infer<typeof zCandidateUserRubric>;
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
export type CandidateMetaRubric = z.infer<typeof zCandidateMetaRubric>;
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
export type PresentedCandidate = z.infer<typeof zPresentedCandidate>;
export const PresentedCandidateSchema = z.toJSONSchema(zPresentedCandidate, {
  unrepresentable: 'throw',
});

export const zPresentCandidatesDetails = zPresentDetailsHeader
  .extend({
    tool_meta: z
      .object({
        curr: z.literal('present_candidates'),
        next: z.literal('request_choice'),
      })
      .strict(),
    display: z
      .object({
        heading: z.string().min(1),
        body: zMarkdown.optional(),
      })
      .strict(),
    candidates: z.array(zPresentedCandidate).min(1),
  })
  .strict();
export type PresentCandidatesDetails = z.infer<typeof zPresentCandidatesDetails>;
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
