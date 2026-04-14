import { tool, type UIMessage, type UIMessagePart, type UITools } from 'ai';
import * as z from 'zod/v4';

import { createKnowledgeCollectionRecord } from './knowledge.js';
import { dataConfirmationSchema, workflowPhaseSchema, type DataConfirmation } from './phase-close.js';

export const requirementApprovalReviewSchema = z.object({
  kind: z.literal('requirement-approval'),
  requirementId: z.number().int().positive(),
  approveOptionPosition: z.number().int().min(0),
});

export const requirementRejectionReviewSchema = z.object({
  kind: z.literal('requirement-rejection'),
  requirementId: z.number().int().positive(),
  rejectOptionPosition: z.number().int().min(0),
});

export const requirementReviewSchema = z.union([
  requirementApprovalReviewSchema,
  requirementRejectionReviewSchema,
]);

export const criterionApprovalReviewSchema = z.object({
  kind: z.literal('criterion-approval'),
  criterionId: z.number().int().positive(),
  approveOptionPosition: z.number().int().min(0),
});

export const criterionRejectionReviewSchema = z.object({
  kind: z.literal('criterion-rejection'),
  criterionId: z.number().int().positive(),
  rejectOptionPosition: z.number().int().min(0),
});

export const criterionReviewSchema = z.union([criterionApprovalReviewSchema, criterionRejectionReviewSchema]);

function validateReviewOptionPosition(
  review: { approveOptionPosition: number } | { rejectOptionPosition: number },
  field: string,
  optionCount: number,
  ctx: z.RefinementCtx,
): void {
  const isApproval = 'approveOptionPosition' in review;
  const position = isApproval ? review.approveOptionPosition : review.rejectOptionPosition;
  const positionField = isApproval ? 'approveOptionPosition' : 'rejectOptionPosition';

  if (position >= optionCount) {
    ctx.addIssue({
      code: 'custom',
      message: `${field}.${positionField} must reference an existing option`,
      path: [field, positionField],
    });
  }
}

export const structuredQuestionSchema = z
  .object({
    question: z.string().min(1),
    why: z.string().min(1),
    impact: z.enum(['high', 'medium', 'low']),
    options: z
      .array(
        z.object({
          content: z.string().min(1),
          is_recommended: z.boolean(),
        }),
      )
      .min(2),
    requirementReview: requirementReviewSchema.optional(),
    criterionReview: criterionReviewSchema.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.requirementReview) {
      validateReviewOptionPosition(value.requirementReview, 'requirementReview', value.options.length, ctx);
    }
    if (value.criterionReview) {
      validateReviewOptionPosition(value.criterionReview, 'criterionReview', value.options.length, ctx);
    }
  });

export const askQuestionToolOutputSchema = z.object({
  ok: z.literal(true),
  turnId: z.number(),
  optionCount: z.number(),
});

export const observerResultSchema = z.object({
  turnId: z.number().int().positive().optional(),
  entityIds: z.object(createKnowledgeCollectionRecord(() => z.array(z.number()))),
});

export const dataTurnResponseSchema = z
  .object({
    turnId: z.number(),
    selectedOptionIds: z.array(z.number()),
    freeText: z.string().trim().min(1).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.selectedOptionIds.length === 0 && !value.freeText) {
      ctx.addIssue({
        code: 'custom',
        message: 'freeText is required when no options are selected',
        path: ['freeText'],
      });
    }
  });

export const dataPhaseSummarySchema = z.object({
  turnId: z.number(),
  phase: workflowPhaseSchema,
  summary: z.string(),
});

export const phaseClosureProposalSchema = z.object({
  phase: workflowPhaseSchema,
  summary: z.string().min(1),
});

export const proposePhaseClosureToolOutputSchema = z.object({
  ok: z.literal(true),
  turnId: z.number(),
  phase: workflowPhaseSchema,
});

export { dataConfirmationSchema };
export type RequirementApprovalReview = z.infer<typeof requirementApprovalReviewSchema>;
export type RequirementRejectionReview = z.infer<typeof requirementRejectionReviewSchema>;
export type RequirementReview = z.infer<typeof requirementReviewSchema>;
export type CriterionApprovalReview = z.infer<typeof criterionApprovalReviewSchema>;
export type CriterionRejectionReview = z.infer<typeof criterionRejectionReviewSchema>;
export type CriterionReview = z.infer<typeof criterionReviewSchema>;
export type StructuredQuestion = z.infer<typeof structuredQuestionSchema>;
export type AskQuestionToolOutput = z.infer<typeof askQuestionToolOutputSchema>;
export type ObserverResultData = z.infer<typeof observerResultSchema>;
export type ObserverEntityIds = ObserverResultData['entityIds'];
export type DataTurnResponse = z.infer<typeof dataTurnResponseSchema>;
export type { DataConfirmation };
export type DataPhaseSummary = z.infer<typeof dataPhaseSummarySchema>;
export type PhaseClosureProposal = z.infer<typeof phaseClosureProposalSchema>;
export type ProposePhaseClosureToolOutput = z.infer<typeof proposePhaseClosureToolOutputSchema>;

export type BrunchMessageMetadata = {
  turnId?: number;
};

export type BrunchDataParts = {
  'observer-result': ObserverResultData;
  'turn-response': DataTurnResponse;
  confirmation: DataConfirmation;
  'phase-summary': DataPhaseSummary;
};

export type BrunchUITools = {
  ask_question: {
    input: StructuredQuestion;
    output: AskQuestionToolOutput;
  };
  propose_phase_closure: {
    input: PhaseClosureProposal;
    output: ProposePhaseClosureToolOutput;
  };
};

export type BrunchUIMessage = UIMessage<BrunchMessageMetadata, BrunchDataParts, BrunchUITools>;
export type BrunchUIMessagePart = UIMessagePart<BrunchDataParts, BrunchUITools>;
export type BrunchAssistantPart =
  | Extract<BrunchUIMessagePart, { type: 'reasoning' | 'text' | 'step-start' }>
  | Extract<
      BrunchUIMessagePart,
      {
        type:
          | 'tool-ask_question'
          | 'tool-propose_phase_closure'
          | 'data-observer-result'
          | 'data-phase-summary';
      }
    >;
export type BrunchUserPart = Extract<
  BrunchUIMessagePart,
  { type: 'text' | 'data-turn-response' | 'data-confirmation' }
>;
export type AskQuestionUIPart = Extract<BrunchUIMessagePart, { type: 'tool-ask_question' }>;
export type ObserverResultUIPart = Extract<BrunchUIMessagePart, { type: 'data-observer-result' }>;

export const askQuestionValidationTool = tool({
  description:
    'Ask the user a structured interview question with options, strategic grounding, and impact signal.',
  inputSchema: structuredQuestionSchema,
  outputSchema: askQuestionToolOutputSchema,
});

export const proposePhaseClosureValidationTool = tool({
  description: 'Propose closing the current workflow phase with a concise summary for user confirmation.',
  inputSchema: phaseClosureProposalSchema,
  outputSchema: proposePhaseClosureToolOutputSchema,
});

export const brunchValidationTools = {
  ask_question: askQuestionValidationTool,
  propose_phase_closure: proposePhaseClosureValidationTool,
} as const;

export const brunchDataPartSchemas = {
  'observer-result': observerResultSchema,
  'turn-response': dataTurnResponseSchema,
  confirmation: dataConfirmationSchema,
  'phase-summary': dataPhaseSummarySchema,
} as const;

/** Part types that brunch persists for assistant turns. */
const ASSISTANT_PART_TYPES: ReadonlySet<BrunchAssistantPart['type']> = new Set([
  'text',
  'reasoning',
  'step-start',
  'tool-ask_question',
  'tool-propose_phase_closure',
  'data-observer-result',
  'data-phase-summary',
] as const satisfies BrunchAssistantPart['type'][]);

// Compile-time exhaustiveness: fails if BrunchAssistantPart gains a type not listed above.
type _AssertComplete = [
  Exclude<BrunchAssistantPart['type'], typeof ASSISTANT_PART_TYPES extends ReadonlySet<infer T> ? T : never>,
] extends [never]
  ? true
  : 'ASSISTANT_PART_TYPES is missing a BrunchAssistantPart type';
const _exhaustive: _AssertComplete = true;

/** Filter SDK message parts to only those brunch persists for assistant turns. */
export function filterAssistantParts(parts: readonly BrunchUIMessagePart[]): BrunchAssistantPart[] {
  return parts.filter((part): part is BrunchAssistantPart =>
    ASSISTANT_PART_TYPES.has(part.type as BrunchAssistantPart['type']),
  );
}

export function isAskQuestionUIPart(part: BrunchUIMessagePart): part is AskQuestionUIPart {
  return part.type === 'tool-ask_question';
}

export function isObserverResultUIPart(part: BrunchUIMessagePart): part is ObserverResultUIPart {
  return part.type === 'data-observer-result';
}

export function extractTextFromMessage(message: Pick<BrunchUIMessage, 'parts'>): string {
  return message.parts
    .filter((part): part is Extract<BrunchUIMessagePart, { type: 'text' }> => part.type === 'text')
    .map((part) => part.text)
    .join('');
}

export function formatTurnResponseText({
  selectedOptionContents,
  freeText,
}: {
  selectedOptionContents: string[];
  freeText?: string | null;
}): string {
  const trimmedFreeText = freeText?.trim();
  const optionSummary = selectedOptionContents.join(', ');
  return [optionSummary, trimmedFreeText].filter(Boolean).join(' — ');
}

export function isToolOfType<TOOLS extends UITools, NAME extends keyof TOOLS & string>(
  part: UIMessagePart<BrunchDataParts, TOOLS>,
  toolName: NAME,
): part is Extract<UIMessagePart<BrunchDataParts, TOOLS>, { type: `tool-${NAME}` }> {
  return part.type === `tool-${toolName}`;
}
