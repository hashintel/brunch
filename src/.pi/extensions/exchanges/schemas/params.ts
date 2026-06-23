import * as z from 'zod';

export const zPresentedOptionParam = z
  .object({
    id: z.string().min(1).describe('Stable option id for the later request_response result details.'),
    content: z.string().describe('Markdown-readable option content.'),
    rationale: z.string().describe('Why this option is plausible or recommended.').optional(),
  })
  .strict();

export const zPresentQuestionParams = z
  .object({
    exchangeId: z
      .string()
      .min(1)
      .describe('Stable id tying this question to the later request_response call.'),
    heading: z.string().describe('Question or offer heading.'),
    body: z.string().describe('Markdown body for context before the response.').optional(),
    options: z
      .array(zPresentedOptionParam)
      .min(1)
      .describe('Finite response options. Omit this field for a free-text answer.')
      .optional(),
    multiple: z
      .boolean()
      .describe('When options are present, collect one-or-more choices instead of a single choice.')
      .optional(),
    allowOther: z.boolean().describe('Whether the user may choose Other for option responses.').optional(),
    allowNone: z
      .boolean()
      .describe('Whether the user may choose None for multi-choice responses.')
      .optional(),
    commentPrompt: z.string().describe('Prompt for an optional comment after choosing options.').optional(),
  })
  .strict();
export type PresentQuestionParams = z.infer<typeof zPresentQuestionParams>;

export const zPresentReviewSetParams = z
  .object({
    exchangeId: z
      .string()
      .min(1)
      .describe('Stable id tying this review-set proposal to the later request_response review.'),
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

export const zRequestResponseParams = z
  .object({
    exchangeId: z.string().min(1).describe('The structured exchange id from the pending present_* entry.'),
  })
  .strict();
export type RequestResponseParams = z.infer<typeof zRequestResponseParams>;

export function toStructuredExchangeJsonSchema(schema: z.ZodType): unknown {
  return z.toJSONSchema(schema, { unrepresentable: 'throw' });
}
