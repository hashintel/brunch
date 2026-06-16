// The kitchen-brigade phase tracker — a pure, monotonic projection of the
// CookEvent stream. The brigade names are phase labels, not commands
// (PLAN.md): detect→prep, plan→recipe, orchestrate→cook, verify→taste,
// promote→plate, ship→serve.
//
// Slice 2a derives the phase coarsely from the post-hoc event vocabulary;
// precise in-flight transitions arrive with the activity-start signals in
// slice 2b. The tracker never regresses.

import type { CookEvent } from './events.js';

export type BrigadePhase = 'prep' | 'recipe' | 'cook' | 'taste' | 'plate' | 'serve';

export const BRIGADE: readonly BrigadePhase[] = ['prep', 'recipe', 'cook', 'taste', 'plate', 'serve'];

export function nextPhase(current: BrigadePhase, event: CookEvent): BrigadePhase {
  const target = phaseFor(event);
  if (!target) return current;
  return BRIGADE.indexOf(target) > BRIGADE.indexOf(current) ? target : current;
}

function phaseFor(event: CookEvent): BrigadePhase | undefined {
  switch (event.kind) {
    case 'plan-start':
      return 'recipe';
    case 'cook-start':
      return 'cook';
    case 'action':
      return /^(verify|epic)/.test(event.message) ? 'taste' : undefined;
    case 'line':
      return event.text.includes('promoted') ? 'plate' : undefined;
    default:
      return undefined;
  }
}
