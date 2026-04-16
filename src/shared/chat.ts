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

export const reviewActionSchema = z.enum(['accept', 'request-changes']);

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

export const activitySummarySchema = z.object({
  seconds: z.number().int().positive().optional(),
  tools: z.array(z.string()),
});

export const dataTurnResponseSchema = z
  .object({
    turnId: z.number(),
    selectedOptionIds: z.array(z.number()),
    freeText: z.string().trim().min(1).optional(),
    reviewAction: reviewActionSchema.optional(),
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
export type ReviewAction = z.infer<typeof reviewActionSchema>;
export type AskQuestionToolOutput = z.infer<typeof askQuestionToolOutputSchema>;
export type ObserverResultData = z.infer<typeof observerResultSchema>;
export type ObserverEntityIds = ObserverResultData['entityIds'];
export type ActivitySummary = z.infer<typeof activitySummarySchema>;
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
  'activity-summary': ActivitySummary;
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
          | 'data-activity-summary'
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
  'activity-summary': activitySummarySchema,
  'turn-response': dataTurnResponseSchema,
  confirmation: dataConfirmationSchema,
  'phase-summary': dataPhaseSummarySchema,
} as const;

export type PersistedBrunchAssistantPart = Extract<
  BrunchAssistantPart,
  { type: 'text' | 'data-observer-result' | 'data-phase-summary' | 'data-activity-summary' }
>;

/** Part types that brunch persists for assistant turns. */
const ASSISTANT_PART_TYPES: ReadonlySet<PersistedBrunchAssistantPart['type']> = new Set([
  'text',
  'data-observer-result',
  'data-phase-summary',
  'data-activity-summary',
] as const satisfies PersistedBrunchAssistantPart['type'][]);

function getToolSummaryLabel(toolName: string): string {
  switch (toolName) {
    case 'ask_question':
      return 'structured question';
    case 'propose_phase_closure':
      return 'phase closure proposal';
    default:
      return toolName.replaceAll(/[_-]+/g, ' ').trim();
  }
}

function getActivityToolLabel(part: BrunchUIMessagePart): string | null {
  if (part.type === 'tool-ask_question') {
    return getToolSummaryLabel('ask_question');
  }

  if (part.type === 'tool-propose_phase_closure') {
    return getToolSummaryLabel('propose_phase_closure');
  }

  if (part.type === 'dynamic-tool') {
    return getToolSummaryLabel(part.toolName);
  }

  return null;
}

export function summarizeAssistantActivity(
  parts: readonly BrunchUIMessagePart[],
  elapsedMs?: number,
): ActivitySummary | null {
  let sawReasoning = false;
  const tools = new Set<string>();

  for (const part of parts) {
    if (part.type === 'reasoning') {
      sawReasoning = true;
      continue;
    }

    const toolLabel = getActivityToolLabel(part);
    if (toolLabel) {
      tools.add(toolLabel);
    }
  }

  if (!sawReasoning && tools.size === 0) {
    return null;
  }

  return {
    ...(sawReasoning && elapsedMs !== undefined ? { seconds: Math.max(1, Math.ceil(elapsedMs / 1000)) } : {}),
    tools: [...tools],
  };
}

/** Filter SDK message parts to only those brunch persists for assistant turns. */
export function filterAssistantParts(
  parts: readonly BrunchUIMessagePart[],
  options?: { elapsedMs?: number },
): BrunchAssistantPart[] {
  const activitySummary = summarizeAssistantActivity(parts, options?.elapsedMs);
  const persistedParts = parts.filter((part): part is PersistedBrunchAssistantPart =>
    ASSISTANT_PART_TYPES.has(part.type as PersistedBrunchAssistantPart['type']),
  );

  return activitySummary
    ? ([
        { type: 'data-activity-summary', data: activitySummary },
        ...persistedParts,
      ] satisfies BrunchAssistantPart[])
    : persistedParts;
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
