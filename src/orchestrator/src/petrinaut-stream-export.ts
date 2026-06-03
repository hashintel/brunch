// ---------------------------------------------------------------------------
// Brunch → Petrinaut live stream contract + export reducer.
//
// Reduces an in-flight or finished cook run's brunch-emitted artifacts (an
// SdcpnFile + the captured PetrinautEvent sequence) into the
// `BrunchExecutionExport` payload that the SSE stream serves to Petrinaut's
// read-only "actual/live" tab.
//
// Pure function: no filesystem side effects. The stream bus composes wire
// frames from the same reducer output; tests consume it directly and validate
// via the frame-replay oracle.
//
// The TokenColour / Marking sum type is preserved so the same reducer feeds
// both identity-folded (count arm) and color-folded (TokenColour[] arm) runs
// without a type widen later.
//
// Validated against real run 904d205d: 75 firings, no negative-marking
// violations, sane final state.
// ---------------------------------------------------------------------------

import type { PetrinautEvent, PetrinautTransitionFiredEvent } from './petrinaut-events.js';
import type { SdcpnFile } from './petrinaut-sdcpn.js';

// ---------------------------------------------------------------------------
// Public contract — `BrunchExecutionExport` and supporting types.
// ---------------------------------------------------------------------------

export type PlaceId = string;

/**
 * One coloured token instance — a map from each colour dimension name to a
 * discrete value. Matches Petrinaut's runtime `Record<string, number>` colour
 * arm in `@hashintel/petrinaut-core` simulation/api.ts.
 */
export type TokenColour = Record<string, number>;

/**
 * Per-place marking. Either a count (uncoloured / identity-fold runs) or a
 * list of coloured token instances (colour-fold runs). Matches Petrinaut's
 * `InitialMarking = number | Record<string, number>[]`. The sum is preserved
 * deliberately so the same reducer feeds both fold modes — identity-fold
 * runs only populate the count arm but the type permits the colour arm for
 * future colour-fold consumers.
 */
export type Marking = Record<PlaceId, number | TokenColour[]>;

export type SdcpnInputArc = {
  placeId: PlaceId;
  weight: number;
  type: 'standard' | 'inhibitor';
};

export type SdcpnOutputArc = {
  placeId: PlaceId;
  weight: number;
};

export type SdcpnPlace = {
  id: PlaceId;
  name: string;
  colorId: string | null;
  dynamicsEnabled: boolean;
  differentialEquationId: string | null;
};

export type SdcpnTransition = {
  id: string;
  name: string;
  inputArcs: SdcpnInputArc[];
  outputArcs: SdcpnOutputArc[];
  lambdaType: 'predicate' | 'stochastic';
  lambdaCode: string;
  transitionKernelCode: string;
};

/**
 * Tight subset of SdcpnFile that the streamed export carries. Drops
 * `scenarios` (the initial marking is lifted to `initialState` instead),
 * `differentialEquations`, `parameters`, and `metrics` — none of which
 * Petrinaut's "actual" view reads.
 */
export type NetDefinition = {
  version: number;
  meta: { generator: string; generatorVersion?: string };
  title: string;
  places: SdcpnPlace[];
  transitions: SdcpnTransition[];
  types: never[];
};

export type TransitionFiring = {
  transitionId: string;
  input: Marking;
  output: Marking;
  /** Preserved verbatim from `PetrinautTransitionFiredEvent.ts`. */
  ts: string;
};

export type BrunchExecutionExport = {
  definition: NetDefinition;
  initialState: Marking;
  transitionFirings: TransitionFiring[];
};

// ---------------------------------------------------------------------------
// Reducer.
// ---------------------------------------------------------------------------

export type ReduceBrunchExecutionExportInput = {
  sdcpnFile: SdcpnFile;
  events: readonly PetrinautEvent[];
};

/**
 * Project an SdcpnFile + captured PetrinautEvent sequence into the
 * `BrunchExecutionExport` payload Petrinaut consumes. Pure — no filesystem,
 * no globals, no process state.
 *
 * - `definition` is the tight 6-field NetDefinition projection of `sdcpnFile`.
 * - `initialState` comes from the single `initial_marking` event (throws if
 *   missing — every cook run must emit one).
 * - `transitionFirings` are the `transition_fired` events in arrival order,
 *   with `transitionName` mapped to `transitionId` and `ts` preserved
 *   verbatim. Per-place token arrays count-reduce to numbers on the count
 *   arm of Marking; per-place keys with zero tokens are not synthesized.
 */
export function reduceBrunchExecutionExport(input: ReduceBrunchExecutionExportInput): BrunchExecutionExport {
  const definition = projectNetDefinition(input.sdcpnFile);

  const initial = input.events.find((e) => e.kind === 'initial_marking');
  if (!initial || initial.kind !== 'initial_marking') {
    throw new Error('reduceBrunchExecutionExport: missing initial_marking event');
  }
  const initialState = reduceMarking(initial.marking);

  const transitionFirings: TransitionFiring[] = [];
  for (const event of input.events) {
    if (event.kind !== 'transition_fired') continue;
    transitionFirings.push(eventToTransitionFiring(event));
  }

  return { definition, initialState, transitionFirings };
}

/**
 * Project a single `transition_fired` PetrinautEvent into its contract-side
 * `TransitionFiring`. Shared by the static reducer above and the live stream
 * bus (`createPetrinautStreamBus`) so both paths produce identical firings.
 */
export function eventToTransitionFiring(event: PetrinautTransitionFiredEvent): TransitionFiring {
  return {
    transitionId: event.transitionName,
    input: reduceMarking(event.input),
    output: reduceMarking(event.output),
    ts: event.ts,
  };
}

/**
 * Project an SdcpnFile to NetDefinition by naming every kept field
 * explicitly. Not `Omit<SdcpnFile, 'scenarios'>` — that would still carry
 * `differentialEquations`, `parameters`, and `metrics`, none of which
 * Petrinaut's "actual" view reads.
 */
export function projectNetDefinition(sdcpnFile: SdcpnFile): NetDefinition {
  return {
    version: sdcpnFile.version,
    meta: sdcpnFile.meta,
    title: sdcpnFile.title,
    places: sdcpnFile.places,
    transitions: sdcpnFile.transitions,
    types: sdcpnFile.types,
  };
}

/**
 * Count-reduce a per-place token map onto the count arm of Marking. Empty
 * places (zero tokens) are not synthesized into the result so frame-replay
 * doesn't need to distinguish "absent" from "zero".
 *
 * Exported so the live stream bus (`createPetrinautStreamBus`) reduces the
 * `initial_marking` event identically to the static reducer.
 */
export function reduceMarking(byPlace: Record<string, readonly unknown[]>): Marking {
  const out: Marking = {};
  for (const [place, tokens] of Object.entries(byPlace)) {
    if (tokens.length > 0) out[place] = tokens.length;
  }
  return out;
}
