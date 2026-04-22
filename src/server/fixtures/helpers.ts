import {
  type BrunchAssistantPart,
  type BrunchUserPart,
  type DataTurnResponse,
  type PrefaceData,
  type ObserverResultData,
  type ReviewAction,
  type ReviewSetData,
  type StructuredQuestion,
} from '@/shared/chat.js';
import { createKnowledgeCollectionRecord } from '@/shared/knowledge.js';
import {
  createConfirmProposedPhaseClosureCommand,
  getPhaseClosureCommandText,
  type DataConfirmation,
  type WorkflowPhase,
} from '@/shared/phase-close.js';

import { serializeParts } from '../parts.js';

export function createEmptyFixtureObserverEntityIds(): ObserverResultData['entityIds'] {
  return createKnowledgeCollectionRecord(() => [] as number[]);
}

function createFixtureActivitySummaryPart(
  tools: string[],
  seconds?: number,
): Extract<BrunchAssistantPart, { type: 'data-activity-summary' }> {
  return {
    type: 'data-activity-summary',
    data: { seconds: seconds ?? 5 + (tools.join('').length % 10), tools },
  };
}

export function createFixtureReviewQuestionInput({
  phase,
  title,
  prompt,
  why,
  items,
}: {
  phase: Extract<ReviewSetData['phase'], 'requirements' | 'criteria'>;
  title: ReviewSetData['title'];
  prompt: StructuredQuestion['question'];
  why: StructuredQuestion['why'];
  items: ReviewSetData['items'];
}): StructuredQuestion {
  return {
    question: prompt,
    why,
    impact: 'high',
    options: [
      { content: 'Accept review', is_recommended: true },
      { content: 'Request changes', is_recommended: false },
    ],
    reviewActions: [
      { action: 'accept', optionPosition: 0 },
      { action: 'request-changes', optionPosition: 1 },
    ],
    reviewSet: {
      phase,
      title,
      items,
    },
  } satisfies StructuredQuestion;
}

export function serializeFixtureQuestionAssistantParts({
  turnId,
  toolCallId,
  input,
  entityIds = createEmptyFixtureObserverEntityIds(),
}: {
  turnId: number;
  toolCallId: string;
  input: StructuredQuestion;
  entityIds?: ObserverResultData['entityIds'];
}): string {
  return serializeParts([
    createFixtureActivitySummaryPart([]),
    {
      type: 'tool-ask_question',
      toolCallId,
      state: 'output-available',
      input,
      output: {
        ok: true,
        turnId,
        optionCount: input.options.length,
      },
    },
    { type: 'text', text: input.question },
    {
      type: 'data-observer-result',
      data: { entityIds },
    },
    ...(input.reviewSet
      ? [
          {
            type: 'data-review-set' as const,
            data: input.reviewSet,
          },
        ]
      : []),
  ] satisfies BrunchAssistantPart[]);
}

export function serializeFixturePhaseProposalAssistantParts({
  turnId,
  phase,
  summary,
  entityIds = createEmptyFixtureObserverEntityIds(),
}: {
  turnId: number;
  phase: WorkflowPhase;
  summary: string;
  entityIds?: ObserverResultData['entityIds'];
}): string {
  return serializeParts([
    createFixtureActivitySummaryPart([]),
    {
      type: 'tool-propose_phase_closure',
      toolCallId: `fixture-turn-${turnId}-propose-phase-closure`,
      state: 'output-available',
      input: {
        phase,
        summary,
      },
      output: {
        ok: true,
        turnId,
        phase,
      },
    },
    {
      type: 'data-phase-summary',
      data: {
        turnId,
        phase,
        summary,
      },
    },
    {
      type: 'data-observer-result',
      data: { entityIds },
    },
  ] satisfies BrunchAssistantPart[]);
}

export function serializeFixturePrefaceAssistantParts(data: PrefaceData): string {
  return serializeParts([
    createFixtureActivitySummaryPart([]),
    {
      type: 'data-preface',
      data,
    },
  ] satisfies BrunchAssistantPart[]);
}

export function serializeFixtureTurnResponseUserParts({
  text,
  data,
}: {
  text: string;
  data: DataTurnResponse;
}): string {
  return serializeParts([
    { type: 'text', text },
    {
      type: 'data-turn-response',
      data,
    },
  ] satisfies BrunchUserPart[]);
}

export function serializeFixtureAcceptedReviewUserParts({
  turnId,
  selectedOptionIds,
  text = 'Accept review',
  reviewAction = 'accept',
}: {
  turnId: number;
  selectedOptionIds: number[];
  text?: string;
  reviewAction?: Extract<ReviewAction, 'accept'>;
}): string {
  return serializeFixtureTurnResponseUserParts({
    text,
    data: {
      turnId,
      selectedOptionIds,
      reviewAction,
    },
  });
}

export function serializeFixtureConfirmationUserParts(
  command: DataConfirmation,
  text: string = getPhaseClosureCommandText(command),
): string {
  return serializeParts([
    { type: 'text', text },
    {
      type: 'data-confirmation',
      data: command,
    },
  ] satisfies BrunchUserPart[]);
}

export function serializeFixturePhaseConfirmationUserParts({
  phase,
  proposalTurnId,
}: {
  phase: WorkflowPhase;
  proposalTurnId: number;
}): string {
  return serializeFixtureConfirmationUserParts(
    createConfirmProposedPhaseClosureCommand(phase, proposalTurnId),
  );
}
