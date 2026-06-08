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
// via the inverted frame-replay oracle.
//
// Marking semantics (FE-819 Card A): every firing carries the COMPLETE net
// marking — `input` is the full pre-firing marking, `output` the full
// post-firing marking — not just the places one transition touched. The
// engine emits per-firing deltas (consumed in `input`, produced in `output`);
// this module folds those deltas onto a running cumulative marking so
// Petrinaut's actual-mode frame reader (which treats `firing.output` as the
// whole frame marking) renders the true net state — pools, budgets, every
// slice — at every frame.
//
// Marking semantics are count-only: every per-place marking is a token count
// (`Record<PlaceId, number>`). Slice/colour identity rides the folded net's
// `colorId` structure (see SPEC §Lexicon `token color` / `color fold`), not the
// streamed marking, so both identity- and color-fold runs stream per-place
// counts. Petrinaut's wire union (`number | Record<string, number>[]`) accepts
// the count arm; a future colour-fold stream would need a colour-aware fold +
// its own oracle, re-added deliberately rather than carried as dead type surface.
//
// Validated against real run 904d205d: 75 firings, no negative-marking
// violations, sane final state.
// ---------------------------------------------------------------------------

import type { PetrinautEvent, PetrinautTransitionFiredEvent, TerminalEventKind } from './petrinaut-events.js';
import { projectFiring, projectMarking, survivingNodes } from './petrinaut-lane-projection.js';
import type { SdcpnFile } from './petrinaut-sdcpn.js';

// ---------------------------------------------------------------------------
// Public contract — `BrunchExecutionExport` and supporting types.
// ---------------------------------------------------------------------------

export type PlaceId = string;

/**
 * Per-place marking: a token count per place. Brunch streams counts only —
 * slice/colour identity is carried by the folded net's `colorId` structure,
 * not the marking. Wire-compatible with Petrinaut's
 * `InitialMarking = number | Record<string, number>[]` union via the count arm.
 */
export type Marking = Record<PlaceId, number>;

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
  /**
   * Lane projection (FE-819 Card E). `'mechanical'` restricts every frame to
   * the (lane-projected) definition's surviving nodes and drops suppressed-
   * transition firings. Defaults to `'both'` — a true identity (no projection),
   * so existing callers and the static export are unchanged.
   */
  lanes?: 'both' | 'mechanical';
};

/**
 * Project an SdcpnFile + captured PetrinautEvent sequence into the
 * `BrunchExecutionExport` payload Petrinaut consumes. Pure — no filesystem,
 * no globals, no process state.
 *
 * - `definition` is the tight 6-field NetDefinition projection of `sdcpnFile`,
 *   augmented with the synthetic run-status nodes (FE-819 Card C).
 * - `initialState` comes from the single `initial_marking` event (throws if
 *   missing — every cook run must emit one).
 * - `transitionFirings` are the `transition_fired` events in arrival order,
 *   with `transitionName` mapped to `transitionId` and `ts` preserved
 *   verbatim, then one synthetic `run:finish` firing at the first terminal
 *   event (Card C). Each firing carries the full pre/post net marking (Card
 *   A); per-place keys with zero tokens are not synthesized.
 */
export function reduceBrunchExecutionExport(input: ReduceBrunchExecutionExportInput): BrunchExecutionExport {
  const definition = augmentDefinitionWithRunStatus(projectNetDefinition(input.sdcpnFile));

  const initial = input.events.find((e) => e.kind === 'initial_marking');
  if (!initial || initial.kind !== 'initial_marking') {
    throw new Error('reduceBrunchExecutionExport: missing initial_marking event');
  }
  // The fold runs on the FULL real marking; frames are projected onto the
  // definition's surviving nodes (FE-819 Card E). In `both` mode the definition
  // retains every node, so projection is a no-op; in `mechanical` mode the
  // (already lane-projected) definition lacks semantic nodes, so suppressed-
  // transition firings drop and semantic-place tokens fall out of every frame.
  // The fold runs on the FULL real marking; in `mechanical` mode each frame is
  // projected onto the (lane-projected) definition's surviving nodes — suppressed-
  // transition firings drop and semantic-place tokens fall out. `both` is identity.
  const surviving = input.lanes === 'mechanical' ? survivingNodes(definition) : undefined;
  const project = (firing: TransitionFiring): TransitionFiring | null =>
    surviving ? projectFiring(firing, surviving) : firing;

  const fullInitial = reduceMarking(initial.marking);
  const initialState = surviving ? projectMarking(fullInitial, surviving.places) : fullInitial;

  const transitionFirings: TransitionFiring[] = [];
  let current = fullInitial;
  let terminalFired = false;
  for (const event of input.events) {
    if (event.kind === 'transition_fired') {
      const { firing, nextMarking } = eventToTransitionFiring(event, current);
      const projected = project(firing);
      if (projected) transitionFirings.push(projected);
      current = nextMarking;
    } else if (
      !terminalFired &&
      (event.kind === 'net_completed' || event.kind === 'net_halted' || event.kind === 'net_deadlocked')
    ) {
      // Run end fires one synthetic run-status firing (FE-819 Card C).
      terminalFired = true;
      const { firing, nextMarking } = synthesizeRunStatusFiring(current, event.kind, event.ts);
      const projected = project(firing);
      if (projected) transitionFirings.push(projected);
      current = nextMarking;
    }
  }

  return { definition, initialState, transitionFirings };
}

/**
 * Project a single `transition_fired` PetrinautEvent into its contract-side
 * `TransitionFiring`, given the full marking that holds *before* the firing.
 * Returns the firing — `input` is `preMarking`, `output` is the full marking
 * *after* folding the event's consume/produce deltas — and `nextMarking` so the
 * caller can thread cumulative state into the following firing.
 *
 * Shared by the static reducer above and the live stream bus
 * (`createPetrinautStreamBus`) so both paths produce identical full-marking
 * firings.
 */
export function eventToTransitionFiring(
  event: PetrinautTransitionFiredEvent,
  preMarking: Marking,
): { firing: TransitionFiring; nextMarking: Marking } {
  const consumed = reduceMarking(event.input);
  const produced = reduceMarking(event.output);
  const nextMarking = applyMarkingDelta(preMarking, consumed, produced);
  return {
    firing: {
      transitionId: event.transitionName,
      input: { ...preMarking },
      output: { ...nextMarking },
      ts: event.ts,
    },
    nextMarking,
  };
}

/**
 * Fold consume/produce deltas onto a full marking, returning a new marking.
 * Places that drain to zero are removed so "absent" and "zero" coincide,
 * matching `reduceMarking`'s no-empty-place invariant.
 */
function applyMarkingDelta(current: Marking, consumed: Marking, produced: Marking): Marking {
  const next: Marking = { ...current };
  for (const [place, n] of Object.entries(consumed)) {
    next[place] = (next[place] ?? 0) - n;
  }
  for (const [place, n] of Object.entries(produced)) {
    next[place] = (next[place] ?? 0) + n;
  }
  for (const [place, count] of Object.entries(next)) {
    if (count === 0) delete next[place];
  }
  return next;
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

// ---------------------------------------------------------------------------
// Synthetic run-status projection (FE-819 Card C).
//
// Today's Petrinaut renders places and tokens but ignores `status`/`terminal`
// SSE events (Card B). To make a halt *structurally* visible, the projected
// definition gains two run-status places and a synthetic `run:finish`
// transition, and run end fires one synthetic `transition_firing` depositing a
// token in the matching place — composing with the Card A full marking.
// Presentation-level only: the engine, contract schema, and real net are
// untouched.
// ---------------------------------------------------------------------------

export const RUN_COMPLETED_PLACE: PlaceId = 'run:completed';
export const RUN_HALTED_PLACE: PlaceId = 'run:halted';
export const RUN_FINISH_TRANSITION = 'run:finish';

const RUN_STATUS_PLACES: SdcpnPlace[] = [
  {
    id: RUN_COMPLETED_PLACE,
    name: 'Run completed',
    colorId: null,
    dynamicsEnabled: false,
    differentialEquationId: null,
  },
  {
    id: RUN_HALTED_PLACE,
    name: 'Run halted',
    colorId: null,
    dynamicsEnabled: false,
    differentialEquationId: null,
  },
];

const RUN_FINISH_TRANSITION_DEF: SdcpnTransition = {
  id: RUN_FINISH_TRANSITION,
  name: 'Run finish',
  inputArcs: [],
  // Both status places are reachable outputs; the actual firing deposits into
  // exactly one depending on the terminal outcome.
  outputArcs: [
    { placeId: RUN_COMPLETED_PLACE, weight: 1 },
    { placeId: RUN_HALTED_PLACE, weight: 1 },
  ],
  lambdaType: 'predicate',
  lambdaCode: '',
  transitionKernelCode: '',
};

/**
 * Append the synthetic run-status nodes to a projected definition. Original
 * places/transitions are preserved; the two status places and `run:finish`
 * transition are added so the terminal synthetic firing references only ids
 * present in the definition.
 */
export function augmentDefinitionWithRunStatus(definition: NetDefinition): NetDefinition {
  return {
    ...definition,
    places: [...definition.places, ...RUN_STATUS_PLACES],
    transitions: [...definition.transitions, RUN_FINISH_TRANSITION_DEF],
  };
}

/** The run-status place a terminal outcome marks (`completed` vs not). */
export function runStatusPlace(terminalKind: TerminalEventKind): PlaceId {
  return terminalKind === 'net_completed' ? RUN_COMPLETED_PLACE : RUN_HALTED_PLACE;
}

/**
 * Build the synthetic `run:finish` firing for run end, given the full marking
 * that holds before it. Deposits one token in the outcome's status place and
 * threads the resulting marking forward (Card A semantics). Shared by the
 * static reducer and the live stream bus so both paths produce the same final
 * frame.
 */
export function synthesizeRunStatusFiring(
  preMarking: Marking,
  terminalKind: TerminalEventKind,
  ts: string,
): { firing: TransitionFiring; nextMarking: Marking } {
  const place = runStatusPlace(terminalKind);
  const nextMarking = applyMarkingDelta(preMarking, {}, { [place]: 1 });
  return {
    firing: { transitionId: RUN_FINISH_TRANSITION, input: { ...preMarking }, output: { ...nextMarking }, ts },
    nextMarking,
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
