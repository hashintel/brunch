import type { SpecificationMode, SpecificationTurn } from './specification.js';

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
  mode: SpecificationMode;
  title: string;
  description: string;
  isRecommended: boolean;
}[];

export function isGroundingStrategyKickoffTurn(
  turn: Pick<SpecificationTurn, 'phase' | 'turn_kind' | 'question'> | undefined,
): boolean {
  return (
    turn?.phase === 'scope' &&
    turn.turn_kind === 'kickoff' &&
    turn.question === groundingStrategyKickoffQuestion
  );
}

export function getGroundingStrategyModeForPosition(position: number): SpecificationMode | null {
  return groundingStrategyChoices.find((choice) => choice.position === position)?.mode ?? null;
}

export function getGroundingStrategyPosition(mode: SpecificationMode): number | null {
  return groundingStrategyChoices.find((choice) => choice.mode === mode)?.position ?? null;
}

export function getGroundingStrategyTitle(mode: SpecificationMode): string | null {
  return groundingStrategyChoices.find((choice) => choice.mode === mode)?.title ?? null;
}
