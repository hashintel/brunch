import { tool, type UIMessage, type UIMessagePart, type UITools } from 'ai';
import * as z from 'zod/v4';

import { createKnowledgeCollectionRecord } from './knowledge.js';
import { dataConfirmationSchema, workflowPhaseSchema, type DataConfirmation } from './phase-close.js';
import { phaseIntentRequestSchema, type PhaseIntentRequest } from './phase-intents.js';

export const reviewActionSchema = z.enum(['accept', 'request-changes']);
export const reviewActionOptionSchema = z.object({
  action: reviewActionSchema,
  optionPosition: z.number().int().min(0),
});

export const reviewSetGroundingRefSchema = z.object({
  code: z.string().min(1),
});

export const reviewItemIdentitySchema = z.string().min(1);

export const reviewSetItemSchema = z.object({
  reviewItemId: reviewItemIdentitySchema,
  content: z.string().min(1),
  referenceCode: z.string().min(1).optional(),
  rationale: z.string().min(1).nullable().optional(),
  grounding: z.array(reviewSetGroundingRefSchema).optional(),
  isUserCreated: z.boolean().optional(),
  isRevised: z.boolean().optional(),
});

export const reviewSetSchema = z
  .object({
    phase: workflowPhaseSchema,
    title: z.string().min(1),
    items: z.array(reviewSetItemSchema),
  })
  .superRefine((value, ctx) => {
    const seenReviewItemIds = new Set<string>();

    for (let index = 0; index < value.items.length; index += 1) {
      const reviewItemId = value.items[index]!.reviewItemId;
      if (seenReviewItemIds.has(reviewItemId)) {
        ctx.addIssue({
          code: 'custom',
          message: 'reviewSet items must not repeat the same reviewItemId',
          path: ['items', index, 'reviewItemId'],
        });
      }
      seenReviewItemIds.add(reviewItemId);
    }
  });

export const groundingCardSchema = z.object({
  observation: z.string().min(1),
  elaboration: z.string().min(1).nullable().optional(),
});

function validateReviewActionOptionPosition(
  reviewAction: z.infer<typeof reviewActionOptionSchema>,
  field: string,
  optionCount: number,
  ctx: z.RefinementCtx,
): void {
  if (reviewAction.optionPosition >= optionCount) {
    ctx.addIssue({
      code: 'custom',
      message: `${field}.optionPosition must reference an existing option`,
      path: [field, 'optionPosition'],
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
      .check((ctx) => {
        if (ctx.value.length === 1) {
          ctx.issues.push({
            code: 'too_small',
            minimum: 2,
            input: ctx.value,
            origin: 'array',
            inclusive: true,
          });
        }
      }),
    reviewActions: z.array(reviewActionOptionSchema).optional(),
    reviewSet: reviewSetSchema.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.reviewActions) {
      const seenActions = new Set<string>();
      const seenPositions = new Set<number>();

      for (let index = 0; index < value.reviewActions.length; index++) {
        const reviewAction = value.reviewActions[index]!;
        validateReviewActionOptionPosition(reviewAction, `reviewActions.${index}`, value.options.length, ctx);

        if (seenActions.has(reviewAction.action)) {
          ctx.addIssue({
            code: 'custom',
            message: 'reviewActions must not repeat the same action',
            path: ['reviewActions', index, 'action'],
          });
        }
        if (seenPositions.has(reviewAction.optionPosition)) {
          ctx.addIssue({
            code: 'custom',
            message: 'reviewActions must not repeat the same optionPosition',
            path: ['reviewActions', index, 'optionPosition'],
          });
        }

        seenActions.add(reviewAction.action);
        seenPositions.add(reviewAction.optionPosition);
      }
    }
  });

export const askQuestionToolOutputSchema = z.object({
  ok: z.literal(true),
  turnId: z.number(),
  optionCount: z.number(),
});

export const presentGroundingCardToolOutputSchema = z.object({
  ok: z.literal(true),
  turnId: z.number(),
});

export const observerResultSchema = z.object({
  turnId: z.number().int().positive().optional(),
  entityIds: z.object(createKnowledgeCollectionRecord(() => z.array(z.number()))),
});

export const activitySummarySchema = z.object({
  seconds: z.number().int().positive().optional(),
  tools: z.array(z.string()),
});

export const reviewItemCommentSchema = z.object({
  reviewItemId: reviewItemIdentitySchema,
  comment: z.string().trim().min(1),
});

export const dataTurnResponseSchema = z
  .object({
    turnId: z.number(),
    selectedOptionIds: z.array(z.number()),
    freeText: z.string().trim().min(1).optional(),
    reviewAction: reviewActionSchema.optional(),
    itemComments: z.array(reviewItemCommentSchema).optional(),
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
export type StructuredQuestion = z.infer<typeof structuredQuestionSchema>;
export type ReviewAction = z.infer<typeof reviewActionSchema>;
export type ReviewActionOption = z.infer<typeof reviewActionOptionSchema>;
export type AskQuestionToolOutput = z.infer<typeof askQuestionToolOutputSchema>;
export type PresentGroundingCardToolOutput = z.infer<typeof presentGroundingCardToolOutputSchema>;
export type ObserverResultData = z.infer<typeof observerResultSchema>;
export type ObserverEntityIds = ObserverResultData['entityIds'];
export type ReviewSetData = z.infer<typeof reviewSetSchema>;
export type GroundingCardData = z.infer<typeof groundingCardSchema>;
export type ActivitySummary = z.infer<typeof activitySummarySchema>;
export type ReviewItemComment = z.infer<typeof reviewItemCommentSchema>;
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
  'review-set': ReviewSetData;
  'grounding-card': GroundingCardData;
  'activity-summary': ActivitySummary;
  'turn-response': DataTurnResponse;
  confirmation: DataConfirmation;
  'phase-intent': PhaseIntentRequest;
  'phase-summary': DataPhaseSummary;
};

export type BrunchUITools = {
  ask_question: {
    input: StructuredQuestion;
    output: AskQuestionToolOutput;
  };
  present_grounding_card: {
    input: GroundingCardData;
    output: PresentGroundingCardToolOutput;
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
          | 'tool-present_grounding_card'
          | 'tool-propose_phase_closure'
          | 'data-observer-result'
          | 'data-review-set'
          | 'data-grounding-card'
          | 'data-activity-summary'
          | 'data-phase-summary';
      }
    >;
export type BrunchUserPart = Extract<
  BrunchUIMessagePart,
  { type: 'text' | 'data-turn-response' | 'data-confirmation' | 'data-phase-intent' }
>;
export type AskQuestionUIPart = Extract<BrunchUIMessagePart, { type: 'tool-ask_question' }>;
export type ObserverResultUIPart = Extract<BrunchUIMessagePart, { type: 'data-observer-result' }>;

const persistedAssistantPartSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('reasoning'), text: z.string() }).loose(),
  z.object({ type: z.literal('step-start') }).loose(),
  z.object({ type: z.literal('text'), text: z.string() }).loose(),
  z.object({ type: z.literal('tool-ask_question'), input: structuredQuestionSchema }).loose(),
  z.object({ type: z.literal('tool-present_grounding_card'), input: groundingCardSchema }).loose(),
  z
    .object({ type: z.literal('tool-propose_phase_closure'), input: phaseClosureProposalSchema.optional() })
    .loose(),
  z.object({ type: z.literal('data-observer-result'), data: observerResultSchema }).loose(),
  z.object({ type: z.literal('data-review-set'), data: reviewSetSchema }).loose(),
  z.object({ type: z.literal('data-grounding-card'), data: groundingCardSchema }).loose(),
  z.object({ type: z.literal('data-activity-summary'), data: activitySummarySchema }).loose(),
  z.object({ type: z.literal('data-phase-summary'), data: dataPhaseSummarySchema }).loose(),
]);

const persistedUserPartSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), text: z.string() }).loose(),
  z.object({ type: z.literal('data-turn-response'), data: dataTurnResponseSchema }).loose(),
  z.object({ type: z.literal('data-confirmation'), data: dataConfirmationSchema }).loose(),
  z.object({ type: z.literal('data-phase-intent'), data: phaseIntentRequestSchema }).loose(),
]);

function safeDecodePersistedParts<PART>(
  json: string | null | undefined,
  partSchema: z.ZodType<PART>,
): PART[] {
  if (!json) {
    return [];
  }

  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) {
      return [];
    }

    const decodedParts: PART[] = [];
    for (const part of parsed) {
      const decoded = partSchema.safeParse(part);
      if (decoded.success) {
        decodedParts.push(decoded.data);
      }
    }
    return decodedParts;
  } catch {
    return [];
  }
}

export function safeDecodePersistedAssistantParts(json: string | null | undefined): BrunchAssistantPart[] {
  return safeDecodePersistedParts(json, persistedAssistantPartSchema as z.ZodType<BrunchAssistantPart>);
}

export function safeDecodePersistedUserParts(json: string | null | undefined): BrunchUserPart[] {
  return safeDecodePersistedParts(json, persistedUserPartSchema as z.ZodType<BrunchUserPart>);
}

export const askQuestionValidationTool = tool({
  description:
    'Ask the user a structured interview question with options, strategic grounding, and impact signal.',
  inputSchema: structuredQuestionSchema,
  outputSchema: askQuestionToolOutputSchema,
});

export const presentGroundingCardValidationTool = tool({
  description: 'Present a provisional grounding card before the next substantive interview move.',
  inputSchema: groundingCardSchema,
  outputSchema: presentGroundingCardToolOutputSchema,
});

export const proposePhaseClosureValidationTool = tool({
  description: 'Propose closing the current workflow phase with a concise summary for user confirmation.',
  inputSchema: phaseClosureProposalSchema,
  outputSchema: proposePhaseClosureToolOutputSchema,
});

export const brunchValidationTools = {
  ask_question: askQuestionValidationTool,
  present_grounding_card: presentGroundingCardValidationTool,
  propose_phase_closure: proposePhaseClosureValidationTool,
} as const;

export const brunchDataPartSchemas = {
  'observer-result': observerResultSchema,
  'review-set': reviewSetSchema,
  'grounding-card': groundingCardSchema,
  'activity-summary': activitySummarySchema,
  'turn-response': dataTurnResponseSchema,
  confirmation: dataConfirmationSchema,
  'phase-intent': phaseIntentRequestSchema,
  'phase-summary': dataPhaseSummarySchema,
} as const;

export type PersistedBrunchAssistantPart = Extract<
  BrunchAssistantPart,
  {
    type:
      | 'text'
      | 'data-observer-result'
      | 'data-review-set'
      | 'data-grounding-card'
      | 'data-phase-summary'
      | 'data-activity-summary';
  }
>;

/** Part types that brunch persists for assistant turns. */
const ASSISTANT_PART_TYPES: ReadonlySet<PersistedBrunchAssistantPart['type']> = new Set([
  'text',
  'data-observer-result',
  'data-review-set',
  'data-grounding-card',
  'data-phase-summary',
  'data-activity-summary',
] as const satisfies PersistedBrunchAssistantPart['type'][]);

/**
 * Internal tool part types — these are brunch's own orchestration tools
 * and should never appear in user-facing activity summaries.
 * Only external/dynamic tools (file system, web search, etc.) are interesting to users.
 */
type InternalToolPartType = `tool-${keyof BrunchUITools}`;

const INTERNAL_TOOL_PART_TYPES: ReadonlySet<InternalToolPartType> = new Set<InternalToolPartType>([
  'tool-ask_question',
  'tool-present_grounding_card',
  'tool-propose_phase_closure',
]);

function getActivityToolLabel(part: BrunchUIMessagePart): string | null {
  if (INTERNAL_TOOL_PART_TYPES.has(part.type as InternalToolPartType)) {
    return null;
  }

  if (part.type === 'dynamic-tool') {
    return part.toolName.replaceAll(/[_-]+/g, ' ').trim();
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
