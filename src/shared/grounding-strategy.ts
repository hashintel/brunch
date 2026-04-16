import type { ProjectMode, ProjectStateTurn } from './api-types.js';

export const groundingStrategyKickoffQuestion = 'How should this specification start?';
export const groundingStrategyKickoffDescription = 'Choose how to start grounding this specification.';

export const groundingStrategyChoices = [
  {
    position: 0,
    mode: 'greenfield',
    title: 'New concept from scratch',
    description: 'Start with a blank slate and define everything fresh',
    isRecommended: true,
  },
  {
    position: 1,
    mode: 'brownfield',
    title: 'Feature within existing codebase',
    description: 'The agent will explore your code before the first interview question',
    isRecommended: false,
  },
] as const satisfies readonly {
  position: number;
  mode: ProjectMode;
  title: string;
  description: string;
  isRecommended: boolean;
}[];

export function isGroundingStrategyKickoffTurn(
  turn: Pick<ProjectStateTurn, 'phase' | 'turn_kind' | 'question'> | undefined,
): boolean {
  return (
    turn?.phase === 'scope' &&
    turn.turn_kind === 'kickoff' &&
    turn.question === groundingStrategyKickoffQuestion
  );
}

export function getGroundingStrategyModeForPosition(position: number): ProjectMode | null {
  return groundingStrategyChoices.find((choice) => choice.position === position)?.mode ?? null;
}

export function getGroundingStrategyPosition(mode: ProjectMode): number | null {
  return groundingStrategyChoices.find((choice) => choice.mode === mode)?.position ?? null;
}
