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

// Cross-event facts the otherwise-pure tracker needs to gate cook→taste: the
// known epic set and which of them have a verdict so far (incl. this event).
export interface PhaseContext {
  epics?: readonly string[];
  verdictedEpics?: ReadonlySet<string>;
}

export function nextPhase(current: BrigadePhase, event: CookEvent, ctx?: PhaseContext): BrigadePhase {
  const target = phaseFor(event, ctx);
  if (!target) return current;
  return BRIGADE.indexOf(target) > BRIGADE.indexOf(current) ? target : current;
}

function phaseFor(event: CookEvent, ctx?: PhaseContext): BrigadePhase | undefined {
  switch (event.kind) {
    case 'plan-start':
      return 'recipe';
    case 'cook-start':
      return 'cook';
    case 'action': {
      // verify→taste fires on epic-verification verdicts (`epic <id> → …`), NOT
      // on per-slice `verify <target>` lines — those run mid-cook.
      const id = /^epic\s+(\S+)/.exec(event.message)?.[1];
      if (id === undefined) return undefined;
      // Gate: every known epic must have tasted. With no known set (no
      // run-shape), fall back to the pre-gate behavior of lighting on any verdict.
      if (!ctx?.epics?.length) return 'taste';
      return ctx.epics.every((e) => ctx.verdictedEpics?.has(e)) ? 'taste' : undefined;
    }
    case 'line':
      return /^\s*✓\s+promoted\b/.test(event.text) ? 'plate' : undefined;
    case 'cook-done':
      // ship→serve: the run completed (emitted after promotion). A halted run
      // does not ship, so it never lights serve.
      return event.ok ? 'serve' : undefined;
    default:
      return undefined;
  }
}
