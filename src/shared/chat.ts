import { tool, type UIMessage, type UIMessagePart, type UITools } from 'ai';
import * as z from 'zod/v4';

import { createKnowledgeCollectionRecord } from './knowledge.js';
import { dataConfirmationSchema, workflowPhaseSchema, type DataConfirmation } from './phase-close.js';

export const requirementApprovalReviewSchema = z.object({
  kind: z.literal('requirement-approval'),
  requirementId: z.number().int().positive(),
  approveOptionPosition: z.number().int().min(0),
});

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
    review: requirementApprovalReviewSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.review && !value.options[value.review.approveOptionPosition]) {
      ctx.addIssue({
        code: 'custom',
        message: 'review.approveOptionPosition must reference an existing option',
        path: ['review', 'approveOptionPosition'],
      });
    }
  });

export const askQuestionToolOutputSchema = z.object({
  ok: z.literal(true),
  turnId: z.number(),
  optionCount: z.number(),
});

export const observerResultSchema = z.object({
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
      { type: 'tool-ask_question' | 'data-observer-result' | 'data-phase-summary' }
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

const textPartSchema = z
  .object({
    type: z.literal('text'),
    text: z.string(),
    state: z.enum(['streaming', 'done']).optional(),
  })
  .loose();

const reasoningPartSchema = z
  .object({
    type: z.literal('reasoning'),
    text: z.string(),
    state: z.enum(['streaming', 'done']).optional(),
  })
  .loose();

const stepStartPartSchema = z
  .object({
    type: z.literal('step-start'),
  })
  .loose();

const observerResultPartSchema = z
  .object({
    type: z.literal('data-observer-result'),
    id: z.string().optional(),
    data: observerResultSchema,
  })
  .loose();

const phaseSummaryPartSchema = z
  .object({
    type: z.literal('data-phase-summary'),
    id: z.string().optional(),
    data: dataPhaseSummarySchema,
  })
  .loose();

const turnResponsePartSchema = z
  .object({
    type: z.literal('data-turn-response'),
    id: z.string().optional(),
    data: dataTurnResponseSchema,
  })
  .loose();

const confirmationPartSchema = z
  .object({
    type: z.literal('data-confirmation'),
    id: z.string().optional(),
    data: dataConfirmationSchema,
  })
  .loose();

const approvalRequestedSchema = z.object({
  id: z.string(),
});

const approvalRespondedSchema = z.object({
  id: z.string(),
  approved: z.boolean(),
  reason: z.string().optional(),
});

const askQuestionToolBaseSchema = z
  .object({
    type: z.literal('tool-ask_question'),
    toolCallId: z.string(),
    title: z.string().optional(),
    providerExecuted: z.boolean().optional(),
  })
  .loose();

const askQuestionToolPartSchema = z.union([
  askQuestionToolBaseSchema.extend({
    state: z.literal('input-streaming'),
    input: z.unknown().optional(),
  }),
  askQuestionToolBaseSchema.extend({
    state: z.literal('input-available'),
    input: structuredQuestionSchema,
  }),
  askQuestionToolBaseSchema.extend({
    state: z.literal('approval-requested'),
    input: structuredQuestionSchema,
    approval: approvalRequestedSchema,
  }),
  askQuestionToolBaseSchema.extend({
    state: z.literal('approval-responded'),
    input: structuredQuestionSchema,
    approval: approvalRespondedSchema,
  }),
  askQuestionToolBaseSchema.extend({
    state: z.literal('output-available'),
    input: structuredQuestionSchema,
    output: askQuestionToolOutputSchema,
    preliminary: z.boolean().optional(),
    approval: approvalRespondedSchema.optional(),
  }),
  askQuestionToolBaseSchema.extend({
    state: z.literal('output-error'),
    input: structuredQuestionSchema.optional(),
    rawInput: z.unknown().optional(),
    errorText: z.string(),
    approval: approvalRespondedSchema.optional(),
  }),
  askQuestionToolBaseSchema.extend({
    state: z.literal('output-denied'),
    input: structuredQuestionSchema,
    approval: approvalRespondedSchema.extend({
      approved: z.literal(false),
    }),
  }),
]);

export const proposePhaseClosureToolBaseSchema = z
  .object({
    type: z.literal('tool-propose_phase_closure'),
    toolCallId: z.string(),
    title: z.string().optional(),
    providerExecuted: z.boolean().optional(),
  })
  .loose();

const proposePhaseClosureToolPartSchema = z.union([
  proposePhaseClosureToolBaseSchema.extend({
    state: z.literal('input-streaming'),
    input: z.unknown().optional(),
  }),
  proposePhaseClosureToolBaseSchema.extend({
    state: z.literal('input-available'),
    input: phaseClosureProposalSchema,
  }),
  proposePhaseClosureToolBaseSchema.extend({
    state: z.literal('output-available'),
    input: phaseClosureProposalSchema,
    output: proposePhaseClosureToolOutputSchema,
    preliminary: z.boolean().optional(),
  }),
  proposePhaseClosureToolBaseSchema.extend({
    state: z.literal('output-error'),
    input: phaseClosureProposalSchema.optional(),
    rawInput: z.unknown().optional(),
    errorText: z.string(),
  }),
]);

export const assistantPartsSchema = z.array(
  z.union([
    textPartSchema,
    reasoningPartSchema,
    stepStartPartSchema,
    observerResultPartSchema,
    phaseSummaryPartSchema,
    askQuestionToolPartSchema,
    proposePhaseClosureToolPartSchema,
  ]),
);

export const userPartsSchema = z.array(
  z.union([textPartSchema, turnResponsePartSchema, confirmationPartSchema]),
);

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
