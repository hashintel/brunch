// ---------------------------------------------------------------------------
// NetBlueprint — pure declarative net shape, no closures or runtime refs.
// Produced by compileTopology(); consumed by wireHandlers().
// ---------------------------------------------------------------------------

import type { TransitionContract } from './petri-net.js';
import type { ReportLine } from './types.js';

// ---------------------------------------------------------------------------
// Guard — declarative routing predicate evaluated against a report payload
//
// Extension shape: add a new `kind` variant here and a matching case in
// evalGuard. Keep guards pure data so a static analyzer can reason about
// reachable markings without executing fire closures.
// ---------------------------------------------------------------------------

export type Guard = { kind: 'always' } | { kind: 'reportFieldTruthy'; field: string };

export function evalGuard(guard: Guard, report: ReportLine | undefined): boolean {
  switch (guard.kind) {
    case 'always':
      return true;
    case 'reportFieldTruthy': {
      const payload = report?.payload as Record<string, unknown> | undefined;
      return !!payload?.[guard.field];
    }
  }
}

// ---------------------------------------------------------------------------
// Token identity for initial token seeding and output routing
// ---------------------------------------------------------------------------

export type TokenSeed = {
  sliceId: string;
  epicId: string;
  retryCount?: number;
  reworkCount?: number;
};

// ---------------------------------------------------------------------------
// Handler descriptors — declarative recipe the wirer interprets
// ---------------------------------------------------------------------------

/** Structural passthrough — fixed outputs, no action call. */
type PassthroughDescriptor = {
  kind: 'passthrough';
  outputs: { place: string; sliceId: string; epicId: string }[];
};

/**
 * Call an action handler, route declaratively on guard evaluation.
 * Covers: evaluate, write-tests, write-code.
 */
type ActionDescriptor = {
  kind: 'action';
  actionKey: string;
  sliceId: string;
  epicId: string;
  /** Guard evaluated against the action's report; selects onTrue vs onFalse. */
  guard: Guard;
  /** Places to emit to when guard evaluates true. */
  onTrue: string[];
  /** Places to emit to when guard evaluates false. */
  onFalse: string[];
  /** Place to return a fresh agent-resource token to. */
  agentReturnPlace?: string;
};

/** Test runner with retry budget — 3-way routing on declarative guard. */
type RunTestsDescriptor = {
  kind: 'run-tests';
  sliceId: string;
  epicId: string;
  target: string;
  /** Guard evaluated against the tests-run report; selects onPass vs onFail. */
  passGuard: Guard;
  onPass: string[];
  onFail: string[];
  budgetPlace: string;
  maxRetries: number;
};

/** Semantic assessment with rework budget; routing is declarative. */
type AssessSemanticDescriptor = {
  kind: 'assess-semantic';
  actionKey: string;
  sliceId: string;
  epicId: string;
  /** Guard evaluated against the semantic-assessed report; selects onSatisfied vs onRejected. */
  satisfiedGuard: Guard;
  onSatisfied: string[];
  onRejected: string[];
  budgetPlace: string;
  maxReworks: number;
};

/** Mark slice completed, emit dep-signal tokens. */
type CompleteSliceDescriptor = {
  kind: 'complete-slice';
  sliceId: string;
  epicId: string;
  completedPlace: string;
  depSignals: string[];
};

/** Mark epic completed, emit dep-signal tokens. */
type CompleteEpicDescriptor = {
  kind: 'complete-epic';
  epicId: string;
  donePlace: string;
  depSignals: string[];
};

/** Verify epic — action call + pass/fail routing + halt on fail. */
type VerifyEpicDescriptor = {
  kind: 'verify-epic';
  actionKey: string;
  epicId: string;
  /** A representative slice for ActionContext. */
  representativeSliceId: string;
  /** Outputs on pass (done place + dep-signals). */
  onPassOutputs: { place: string; sliceId: string; epicId: string }[];
};

export type HandlerDescriptor =
  | PassthroughDescriptor
  | ActionDescriptor
  | RunTestsDescriptor
  | AssessSemanticDescriptor
  | CompleteSliceDescriptor
  | CompleteEpicDescriptor
  | VerifyEpicDescriptor;

// ---------------------------------------------------------------------------
// Transition skeleton — topology + declarative handler recipe
// ---------------------------------------------------------------------------

export type TransitionSkeleton = {
  id: string;
  inputs: string[];
  contract: TransitionContract;
  handler: HandlerDescriptor;
};

// ---------------------------------------------------------------------------
// NetBlueprint — the full declarative net shape
// ---------------------------------------------------------------------------

export type NetBlueprint = {
  places: string[];
  transitions: TransitionSkeleton[];
  initialTokens: { place: string; token: TokenSeed }[];
};

// ---------------------------------------------------------------------------
// enumerateCandidateOutputs — topology-only enumeration of reachable
// output places for one transition. Pure: no actions, no reports, no runner.
// Used by static analyzers (reachability, deadlock detection, simulation).
// ---------------------------------------------------------------------------

export function enumerateCandidateOutputs(transition: TransitionSkeleton): Set<string> {
  const out = new Set<string>();
  const h = transition.handler;
  switch (h.kind) {
    case 'passthrough':
      for (const o of h.outputs) out.add(o.place);
      return out;
    case 'action':
      for (const p of h.onTrue) out.add(p);
      for (const p of h.onFalse) out.add(p);
      if (h.agentReturnPlace) out.add(h.agentReturnPlace);
      return out;
    case 'run-tests':
      for (const p of h.onPass) out.add(p);
      for (const p of h.onFail) out.add(p);
      out.add(h.budgetPlace);
      return out;
    case 'assess-semantic':
      for (const p of h.onSatisfied) out.add(p);
      for (const p of h.onRejected) out.add(p);
      out.add(h.budgetPlace);
      return out;
    case 'complete-slice':
      out.add(h.completedPlace);
      for (const p of h.depSignals) out.add(p);
      return out;
    case 'complete-epic':
      out.add(h.donePlace);
      for (const p of h.depSignals) out.add(p);
      return out;
    case 'verify-epic':
      for (const o of h.onPassOutputs) out.add(o.place);
      return out;
  }
}
