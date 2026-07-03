import * as z from 'zod';

export const STRUCTURED_EXCHANGE_PRESENT_DETAILS_SCHEMA = 'brunch.structured_exchange.present' as const;
export const STRUCTURED_EXCHANGE_REQUEST_DETAILS_SCHEMA = 'brunch.structured_exchange.request' as const;
export const STRUCTURED_EXCHANGE_CAPTURE_DETAILS_SCHEMA = 'brunch.structured_exchange.capture' as const;
export const STRUCTURED_EXCHANGE_DETAILS_VERSION = 1 as const;

export const zMarkdown = z.string();
export const MarkdownSchema = z.toJSONSchema(zMarkdown, { unrepresentable: 'throw' });

export const zGraphNodeRef = z.object({ node_id: z.string().min(1) }).strict();
export const GraphNodeRefSchema = z.toJSONSchema(zGraphNodeRef, { unrepresentable: 'throw' });

export const zPresentToolName = z.enum(['present_question', 'present_review_set', 'present_candidates']);
export const PresentToolNameSchema = z.toJSONSchema(zPresentToolName, { unrepresentable: 'throw' });

export const zRequestToolName = z.enum([
  'request_answer',
  'request_choice',
  'request_choices',
  'request_review',
]);
export const RequestToolNameSchema = z.toJSONSchema(zRequestToolName, { unrepresentable: 'throw' });

export const zCaptureToolName = z.enum([
  'capture_answer',
  'capture_choice',
  'capture_choices',
  'capture_review',
  'capture_candidate',
]);
export const CaptureToolNameSchema = z.toJSONSchema(zCaptureToolName, { unrepresentable: 'throw' });

const zDetailsHeaderFields = {
  v: z.literal(STRUCTURED_EXCHANGE_DETAILS_VERSION),
  exchange_id: z.string().min(1),
} as const;

export const zPresentDetailsHeader = z
  .object({ schema: z.literal(STRUCTURED_EXCHANGE_PRESENT_DETAILS_SCHEMA), ...zDetailsHeaderFields })
  .strict();
export const PresentDetailsHeaderSchema = z.toJSONSchema(zPresentDetailsHeader, { unrepresentable: 'throw' });

export const zRequestDetailsHeader = z
  .object({ schema: z.literal(STRUCTURED_EXCHANGE_REQUEST_DETAILS_SCHEMA), ...zDetailsHeaderFields })
  .strict();
export const RequestDetailsHeaderSchema = z.toJSONSchema(zRequestDetailsHeader, { unrepresentable: 'throw' });

export const zCaptureDetailsHeader = z
  .object({ schema: z.literal(STRUCTURED_EXCHANGE_CAPTURE_DETAILS_SCHEMA), ...zDetailsHeaderFields })
  .strict();
export const CaptureDetailsHeaderSchema = z.toJSONSchema(zCaptureDetailsHeader, { unrepresentable: 'throw' });

export const zDisplayBase = z.object({ heading: z.string().min(1), body: zMarkdown.optional() }).strict();
export const DisplayBaseSchema = z.toJSONSchema(zDisplayBase, { unrepresentable: 'throw' });

export const zPresentQuestionToolMeta = z
  .object({ curr: z.literal('present_question'), next: z.literal('request_response') })
  .strict();
export const zPresentReviewSetToolMeta = z
  .object({ curr: z.literal('present_review_set'), next: z.literal('request_response') })
  .strict();
export const zPresentCandidatesToolMeta = z
  .object({ curr: z.literal('present_candidates'), next: z.literal('request_response') })
  .strict();

export const zPresentToolMeta = z.discriminatedUnion('curr', [
  zPresentQuestionToolMeta,
  zPresentReviewSetToolMeta,
  zPresentCandidatesToolMeta,
]);
export const PresentToolMetaSchema = z.toJSONSchema(zPresentToolMeta, { unrepresentable: 'throw' });

export const zRequestAnswerToolMeta = z
  .object({
    prev: z.literal('present_question'),
    curr: z.literal('request_answer'),
    next: z.literal('capture_answer').optional(),
  })
  .strict();
export const zRequestChoiceFromOptionsToolMeta = z
  .object({
    prev: z.literal('present_question'),
    curr: z.literal('request_choice'),
    next: z.literal('capture_choice').optional(),
  })
  .strict();
export const zRequestChoiceFromCandidatesToolMeta = z
  .object({
    prev: z.literal('present_candidates'),
    curr: z.literal('request_choice'),
    next: z.literal('capture_candidate').optional(),
  })
  .strict();
export const zRequestChoicesToolMeta = z
  .object({
    prev: z.literal('present_question'),
    curr: z.literal('request_choices'),
    next: z.literal('capture_choices').optional(),
  })
  .strict();
export const zRequestReviewToolMeta = z
  .object({
    prev: z.literal('present_review_set'),
    curr: z.literal('request_review'),
    next: z.literal('capture_review').optional(),
  })
  .strict();

export const zRequestChoiceToolMeta = z.union([
  zRequestChoiceFromOptionsToolMeta,
  zRequestChoiceFromCandidatesToolMeta,
]);
export const zRequestToolMeta = z.union([
  zRequestAnswerToolMeta,
  zRequestChoiceFromOptionsToolMeta,
  zRequestChoiceFromCandidatesToolMeta,
  zRequestChoicesToolMeta,
  zRequestReviewToolMeta,
]);
export const RequestToolMetaSchema = z.toJSONSchema(zRequestToolMeta, { unrepresentable: 'throw' });

export const zCaptureAnswerToolMeta = z
  .object({ prev: z.literal('request_answer'), curr: z.literal('capture_answer') })
  .strict();
export const zCaptureChoiceToolMeta = z
  .object({ prev: z.literal('request_choice'), curr: z.literal('capture_choice') })
  .strict();
export const zCaptureChoicesToolMeta = z
  .object({ prev: z.literal('request_choices'), curr: z.literal('capture_choices') })
  .strict();
export const zCaptureReviewToolMeta = z
  .object({ prev: z.literal('request_review'), curr: z.literal('capture_review') })
  .strict();
export const zCaptureCandidateToolMeta = z
  .object({ prev: z.literal('request_choice'), curr: z.literal('capture_candidate') })
  .strict();

export const zCaptureToolMeta = z.union([
  zCaptureAnswerToolMeta,
  zCaptureChoiceToolMeta,
  zCaptureChoicesToolMeta,
  zCaptureReviewToolMeta,
  zCaptureCandidateToolMeta,
]);
export const CaptureToolMetaSchema = z.toJSONSchema(zCaptureToolMeta, { unrepresentable: 'throw' });
