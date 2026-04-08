import type { TurnWithOptions } from './core.js';
import { safeDeserializeUserParts, type DataTurnResponsePart } from './parts.js';

export interface ProjectedTurnResponse {
  selectedOptionIds: number[];
  selectedOptionContents: string[];
  freeText?: string;
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
  const selectedOptionIds = responsePart?.data.selectedOptionIds ?? [];
  const freeText = responsePart?.data.freeText;

  if (responsePart) {
    const selectedOptionContents =
      turn.options
        ?.filter((option) => selectedOptionIds.includes(option.id))
        .sort((left, right) => left.position - right.position)
        .map((option) => option.content) ?? [];

    return {
      selectedOptionIds,
      selectedOptionContents,
      freeText,
    };
  }

  const selectedOptions =
    turn.options
      ?.filter((option) => option.is_selected)
      .sort((left, right) => left.position - right.position) ?? [];

  if (selectedOptions.length === 0) {
    return null;
  }

  return {
    selectedOptionIds: selectedOptions.map((option) => option.id),
    selectedOptionContents: selectedOptions.map((option) => option.content),
    freeText: undefined,
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
  return lines.join('\n');
}
