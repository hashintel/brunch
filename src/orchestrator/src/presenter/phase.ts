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
      // verify→taste fires on the epic-verification verdict (`epic <id> → …`),
      // NOT on per-slice `verify <target>` lines — those run mid-cook and would
      // light taste while still cooking.
      return /^epic\b/.test(event.message) ? 'taste' : undefined;
    case 'line':
      return event.text.includes('promoted') ? 'plate' : undefined;
    case 'cook-done':
      // ship→serve: the run completed (emitted after promotion). A halted run
      // does not ship, so it never lights serve.
      return event.ok ? 'serve' : undefined;
    default:
      return undefined;
  }
}
