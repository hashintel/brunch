import type { TurnWithOptions } from './core.js';
import { safeDeserializeUserParts, type DataTurnResponsePart } from './parts.js';

export interface ProjectedTurnResponse {
  selectedOptionIds: number[];
  selectedOptionContents: string[];
  freeText?: string;
  reviewAction?: import('@/shared/chat.js').ReviewAction;
  itemComments?: import('@/shared/chat.js').ReviewItemComment[];
}

function findTurnResponsePart(turn: Pick<TurnWithOptions, 'user_parts'>): DataTurnResponsePart | undefined {
  return safeDeserializeUserParts(turn.user_parts).find(
    (part): part is DataTurnResponsePart => part.type === 'data-turn-response',
  );
}

export function projectTurnResponse(
  turn: Pick<TurnWithOptions, 'user_parts' | 'options'>,
): ProjectedTurnResponse | null {
  const responsePart = findTurnResponsePart(turn);
  if (!responsePart) {
    return null;
  }

  const selectedOptionIds = responsePart.data.selectedOptionIds;
  const selectedOptionContents =
    turn.options
      ?.filter((option) => selectedOptionIds.includes(option.id))
      .sort((left, right) => left.position - right.position)
      .map((option) => option.content) ?? [];

  return {
    selectedOptionIds,
    selectedOptionContents,
    freeText: responsePart.data.freeText,
    reviewAction: responsePart.data.reviewAction,
    ...(responsePart.data.itemComments?.length ? { itemComments: responsePart.data.itemComments } : {}),
  };
}

export function formatProjectedTurnResponse(response: ProjectedTurnResponse): string {
  const chosenOptions =
    response.selectedOptionContents.length > 0
      ? response.selectedOptionContents
      : response.selectedOptionIds.map(String);

  const lines = ['Turn response:'];
  if (chosenOptions.length > 0) {
    lines.push(`  Chosen options: ${chosenOptions.join(', ')}`);
  }
  if (response.freeText) {
    lines.push(`  Free-text response: ${response.freeText}`);
  }
  if (response.reviewAction) {
    lines.push(`  Review action: ${response.reviewAction}`);
  }
  if (response.itemComments?.length) {
    lines.push('  Per-item comments:');
    for (const { itemIndex, comment } of response.itemComments) {
      lines.push(`    Item ${itemIndex}: ${comment}`);
    }
  }
  return lines.join('\n');
}
