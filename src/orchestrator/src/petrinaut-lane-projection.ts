// ---------------------------------------------------------------------------
// Petrinaut lane projection — project a compiled NetBlueprint (and, downstream,
// each streamed marking) onto a lane subset for the Petrinaut "actual" view.
//
// `both` is the identity projection (default; current behavior). `mechanical`
// suppresses the semantic lane so the demo graph shows only the deterministic
// TDD loop. This is a *projection* — execution always runs the full blueprint
// (engine wires the unprojected net); only what Petrinaut renders is filtered.
//
// Lane is authoritative on the blueprint (`contract.lane`), so the static net
// projection lives here. Live frames are projected by restricting markings to
// the surviving place set (see `petrinaut-lane-projection` marking helpers) —
// the real engine already consumes `done-spec` at the (suppressed)
// `assess-semantic:dispatch`, so restriction conserves with no token replay.
// ---------------------------------------------------------------------------

import { enumerateCandidateOutputs, type NetBlueprint, type TransitionSkeleton } from './net-blueprint.js';
import type { Marking, NetDefinition, TransitionFiring } from './petrinaut-stream-export.js';

export type PetrinautLanes = 'both' | 'mechanical';

/**
 * Project a compiled blueprint onto a lane subset. Pure and total.
 *
 * - `both`       → identity (returns the input blueprint unchanged).
 * - `mechanical` → drops every `lane === 'semantic'` transition, except the
 *   per-slice `complete-slice` transition (`return-done`), which is rewritten
 *   into a mechanical bridge consuming `done-spec` instead of `semantic-satisfied`.
 *   Its `complete-slice` handler is preserved verbatim, so `completed` and the
 *   `dep-signal:*` fan-out (which unlocks downstream slices) still fire.
 */
export function projectBlueprintLanes(blueprint: NetBlueprint, lanes: PetrinautLanes): NetBlueprint {
  if (lanes === 'both') return blueprint;

  const transitions: TransitionSkeleton[] = [];
  for (const t of blueprint.transitions) {
    if (t.contract.lane !== 'semantic') {
      transitions.push(t);
      continue;
    }
    // The slice-completion transition is the one semantic transition we keep —
    // rewired onto the mechanical `done-spec` place so completion stays reachable.
    if (t.handler.kind === 'complete-slice') {
      transitions.push({
        ...t,
        inputs: [`slice:${t.handler.sliceId}:done-spec`],
        contract: { ...t.contract, lane: 'mechanical', guard: 'done-spec (semantic lane elided)' },
      });
    }
    // Every other semantic transition is dropped.
  }

  // Surviving places = those still referenced by a kept transition. Semantic-only
  // places (semantic-budget, semantic-satisfied, assess-semantic:*) fall out
  // because their sole references were on dropped semantic transitions; cross-lane
  // places like `done-spec` survive via the mechanical lane + the rewritten bridge.
  const surviving = new Set<string>();
  for (const t of transitions) {
    for (const input of t.inputs) surviving.add(input);
    for (const output of enumerateCandidateOutputs(t)) surviving.add(output);
  }

  return {
    places: blueprint.places.filter((place) => surviving.has(place)),
    transitions,
    initialTokens: blueprint.initialTokens.filter((seed) => surviving.has(seed.place)),
  };
}

/**
 * Restrict a marking to a surviving place set. Pure — returns a new object,
 * never mutates the source. The bus feeds the projected definition's place set
 * here so every streamed frame drops suppressed-place tokens. Because the real
 * engine already consumed `done-spec` at the (now-suppressed)
 * `assess-semantic:dispatch`, restriction conserves with no token replay.
 */
export function projectMarking(marking: Marking, survivingPlaces: ReadonlySet<string>): Marking {
  const projected: Marking = {};
  for (const [place, count] of Object.entries(marking)) {
    if (survivingPlaces.has(place)) projected[place] = count;
  }
  return projected;
}

/** The place + transition id sets that survive a projected definition. */
export type SurvivingNodes = {
  places: ReadonlySet<string>;
  transitions: ReadonlySet<string>;
};

export function survivingNodes(definition: NetDefinition): SurvivingNodes {
  return {
    places: new Set(definition.places.map((p) => p.id)),
    transitions: new Set(definition.transitions.map((t) => t.id)),
  };
}

/**
 * Project one firing onto the surviving node sets. Returns `null` when the
 * firing's transition was suppressed (so the caller drops the frame) — e.g.
 * `assess-semantic:dispatch`. Surviving firings (mechanical + the rewritten
 * `return-done` bridge) get their consume/produce delta restricted to surviving
 * places.
 */
export function projectFiring(firing: TransitionFiring, surviving: SurvivingNodes): TransitionFiring | null {
  if (!surviving.transitions.has(firing.transitionId)) return null;
  return {
    ...firing,
    input: projectMarking(firing.input, surviving.places),
    output: projectMarking(firing.output, surviving.places),
  };
}
