import type { ProjectStateTurn, TurnKind } from '@/shared/api-types.js';
import { structuredQuestionSchema, type BrunchAssistantPart } from '@/shared/chat.js';

import { findPhaseOutcomeForTurn, type DB } from '../db.js';
import { safeDeserializeAssistantParts, safeDeserializeUserParts } from '../parts.js';
import { projectTurnResponse } from '../turn-response.js';
import type { ManifestScenario } from './manifest.js';

export function isProjectedControlTurnKind(turnKind: TurnKind | null | undefined): boolean {
  return turnKind === 'kickoff' || turnKind === 'recovery';
}

export function getPersistedReviewActions(turn: Pick<ProjectStateTurn, 'assistant_parts'>) {
  const askQuestionPart = safeDeserializeAssistantParts(turn.assistant_parts).find(
    (part): part is Extract<BrunchAssistantPart, { type: 'tool-ask_question' }> =>
      part.type === 'tool-ask_question' && 'input' in part,
  );
  if (!askQuestionPart) {
    return undefined;
  }

  const parsedInput = structuredQuestionSchema.safeParse(askQuestionPart.input);
  return parsedInput.success ? parsedInput.data.reviewActions : undefined;
}

export function projectRuntimeTurnToManifestTurn({
  db,
  projectId,
  turn,
}: {
  db: DB;
  projectId: number;
  turn: Pick<
    ProjectStateTurn,
    | 'id'
    | 'phase'
    | 'question'
    | 'answer'
    | 'why'
    | 'impact'
    | 'options'
    | 'user_parts'
    | 'assistant_parts'
    | 'turn_kind'
  >;
}): ManifestScenario['turns'][number] | null {
  if (isProjectedControlTurnKind(turn.turn_kind)) {
    return null;
  }

  if (turn.question) {
    const response = projectTurnResponse(turn);
    const options = turn.options ?? [];

    return {
      phase: turn.phase,
      question: turn.question,
      answer: turn.answer ?? null,
      why: turn.why ?? null,
      impact: turn.impact ?? null,
      options: options.map((option) => ({
        content: option.content,
        is_recommended: option.is_recommended,
      })),
      ...(response
        ? {
            selectedOptionPositions: options
              .filter((option) => option.is_selected)
              .sort((left, right) => left.position - right.position)
              .map((option) => option.position),
            freeText: response.freeText ?? null,
            ...(response.reviewAction ? { reviewAction: response.reviewAction } : {}),
          }
        : {}),
      ...(getPersistedReviewActions(turn) ? { reviewActions: getPersistedReviewActions(turn) } : {}),
    } satisfies ManifestScenario['turns'][number];
  }

  const isConfirmation = safeDeserializeUserParts(turn.user_parts).some(
    (part) => part.type === 'data-confirmation',
  );
  const isClosureProposal = Boolean(findPhaseOutcomeForTurn(db, projectId, turn.id));

  if (!isConfirmation && !isClosureProposal) {
    return null;
  }

  return {
    phase: turn.phase,
    question: '',
    answer: turn.answer ?? '',
    ...(isConfirmation ? { isConfirmation: true } : { isProposal: true }),
  } satisfies ManifestScenario['turns'][number];
}
