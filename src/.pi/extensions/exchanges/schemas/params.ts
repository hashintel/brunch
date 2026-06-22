import * as z from 'zod';

export const zPresentQuestionParams = z
  .object({
    exchangeId: z
      .string()
      .min(1)
      .describe('Stable id tying this question to the later request_answer response.'),
    heading: z.string().describe('Question heading.'),
    body: z.string().describe('Markdown body for context before the answer request.').optional(),
  })
  .strict();
export type PresentQuestionParams = z.infer<typeof zPresentQuestionParams>;

export const zPresentedOptionParam = z
  .object({
    id: z.string().min(1).describe('Stable option id for later request_* response correlation.'),
    content: z.string().describe('Markdown-readable option content.'),
    rationale: z.string().describe('Why this option is plausible or recommended.').optional(),
  })
  .strict();

export const zPresentOptionsParams = z
  .object({
    exchangeId: z
      .string()
      .min(1)
      .describe('Stable id tying this presented offer to the later request_* response.'),
    heading: z.string().describe('Heading for the presented options.'),
    body: z.string().describe('Markdown body shown before the options.').optional(),
    options: z.array(zPresentedOptionParam).describe('Options to display.'),
    expectedRequestTool: z.enum(['request_choice', 'request_choices']).optional(),
  })
  .strict();
export type PresentOptionsParams = z.infer<typeof zPresentOptionsParams>;

export const zPresentReviewSetParams = z
  .object({
    exchangeId: z
      .string()
      .min(1)
      .describe('Stable id tying this review-set proposal to the later request_review response.'),
    proposalEntryId: z
      .string()
      .describe('Optional transcript/proposal entry id to carry into later acceptance audit.')
      .optional(),
    // Boundary shape only: reject a JSON string or the wrong tool's shape
    // (e.g. mutate_graph's {createBasis, ops}) before the deep validator runs.
    // The full nested proposal shape is owned by validateReviewSetPayloadShape
    // in graph/review-set.ts (single owner); this loose object requires just the
    // review-set discriminator so a non-object or mismatched payload fails here
    // with a named field error instead of deep in the command executor.
    payload: z
      .looseObject({ schemaVersion: z.literal(1) })
      .describe(
        'Canonical review-set proposal payload object (schemaVersion: 1, lens, grounding, pitch, entityDrafts, edgeDrafts).',
      ),
  })
  .strict();
export type PresentReviewSetParams = z.infer<typeof zPresentReviewSetParams>;

export const zRequestAnswerParams = z
  .object({
    exchangeId: z
      .string()
      .min(1)
      .describe('The structured exchange id from the corresponding present_question entry.'),
    respondsToPresentTool: z
      .literal('present_question')
      .optional()
      .describe(
        'The present_* tool that opened this exchange. request_answer follows present_question only; it must reuse the matching exchangeId.',
      ),
    prompt: z.string().describe('Short live-input prompt. Do not repeat the presented question body.'),
  })
  .strict();
export type RequestAnswerParams = z.infer<typeof zRequestAnswerParams>;

export const zRequestChoiceParam = z
  .object({
    id: z.string().min(1).describe('Stable choice id from the corresponding present_* entry.'),
    label: z.string().min(1).describe('Short choice label shown in the live selection UI.'),
  })
  .strict();
export type RequestChoiceParam = z.infer<typeof zRequestChoiceParam>;

export const zRequestChoiceParams = z
  .object({
    exchangeId: z
      .string()
      .min(1)
      .describe('The structured exchange id from the corresponding present_* entry.'),
    respondsToPresentTool: z
      .enum(['present_options', 'present_candidates'])
      .describe(
        'The present_* tool that opened this exchange. request_choice follows present_options or present_candidates only (never present_question — use request_answer for that); it must reuse the matching exchangeId.',
      ),
    prompt: z.string().describe('Short live-input prompt. Do not repeat the presented content.'),
    choices: z.array(zRequestChoiceParam).describe('Choices available for this response.'),
    allowOther: z.boolean().describe('Whether the user may choose Other.').optional(),
    commentPrompt: z.string().describe('Prompt for optional comment after a listed choice.').optional(),
  })
  .strict();
export type RequestChoiceParams = z.infer<typeof zRequestChoiceParams>;

export const zRequestChoicesParams = z
  .object({
    exchangeId: z
      .string()
      .min(1)
      .describe('The structured exchange id from the corresponding present_options entry.'),
    respondsToPresentTool: z
      .literal('present_options')
      .describe(
        'The present_* tool that opened this exchange. request_choices (multi-select) follows present_options only; it must reuse the matching exchangeId.',
      ),
    prompt: z.string().describe('Short live-input prompt. Do not repeat the presented content.'),
    choices: z
      .array(zRequestChoiceParam)
      .describe('Listed choices available for this multi-choice response.'),
    allowOther: z.boolean().describe('Whether the user may choose Other.').optional(),
    allowNone: z.boolean().describe('Whether the user may choose None.').optional(),
    commentPrompt: z
      .string()
      .describe('Prompt for an optional comment. Required when Other or None is selected.')
      .optional(),
  })
  .strict();
export type RequestChoicesParams = z.infer<typeof zRequestChoicesParams>;

export const zRequestReviewParams = z
  .object({
    exchangeId: z
      .string()
      .min(1)
      .describe('The structured exchange id from the corresponding present_review_set entry.'),
    prompt: z.string().describe('Short live-input prompt. Do not repeat the review set.').optional(),
  })
  .strict();
export type RequestReviewParams = z.infer<typeof zRequestReviewParams>;

export function toStructuredExchangeJsonSchema(schema: z.ZodType): unknown {
  return z.toJSONSchema(schema, { unrepresentable: 'throw' });
}
