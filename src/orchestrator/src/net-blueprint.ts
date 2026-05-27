// ---------------------------------------------------------------------------
// NetBlueprint — pure declarative net shape, no closures or runtime refs.
// Produced by compileTopology(); consumed by wireHandlers().
// ---------------------------------------------------------------------------

import type { TransitionContract } from './petri-net.js';
import type { ReportLine } from './types.js';

// ---------------------------------------------------------------------------
// RouteGuard — declarative routing predicate evaluated against a report payload
//
// Retained for run-tests / assess-semantic / verify-epic transitions that still
// branch inside their fire closure (FE-761 Slice 2 will retire these uses too).
// ---------------------------------------------------------------------------

export type RouteGuard = { kind: 'always' } | { kind: 'reportFieldTruthy'; field: string };

export function evalRouteGuard(guard: RouteGuard, report: ReportLine | undefined): boolean {
  switch (guard.kind) {
    case 'always':
      return true;
    case 'reportFieldTruthy': {
      const payload = report?.payload as Record<string, unknown> | undefined;
      return !!payload?.[guard.field];
    }
    default: {
      const unknown = guard as { kind: string };
      throw new Error(`Unsupported RouteGuard kind: ${unknown.kind}`);
    }
  }
}

// ---------------------------------------------------------------------------
// EnablingGuard — declarative enabling predicate evaluated against an input
// token's attached report. Distinct from RouteGuard: the EnablingGuard runs at
// `isEnabled` time (the firing policy uses it to pick which sibling transition
// is currently allowed to fire) rather than at fire time. Mutually-exclusive
// guards over the same intermediate place implement Petri-net-faithful
// conditional branching via sibling transitions (FE-761 Slice 1).
// ---------------------------------------------------------------------------

export type EnablingGuard =
  | { kind: 'always' }
  | { kind: 'tokenReportFieldTruthy'; field: string }
  | { kind: 'tokenReportFieldFalsy'; field: string };

export function evalEnablingGuard(guard: EnablingGuard, report: ReportLine | undefined): boolean {
  switch (guard.kind) {
    case 'always':
      return true;
    case 'tokenReportFieldTruthy': {
      const payload = report?.payload as Record<string, unknown> | undefined;
      return !!payload?.[guard.field];
    }
    case 'tokenReportFieldFalsy': {
      const payload = report?.payload as Record<string, unknown> | undefined;
      return !payload?.[guard.field];
    }
    default: {
      const unknown = guard as { kind: string };
      throw new Error(`Unsupported EnablingGuard kind: ${unknown.kind}`);
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
 * Call an action handler, attach the resulting reportId to the output token,
 * and emit to a single fixed output set. Conditional branching is expressed
 * downstream via sibling-passthrough transitions reading the attached report.
 *
 * Covers: evaluate (with intermediate place + 2 siblings), write-tests,
 * write-code (single output, no siblings).
 */
type ActionDescriptor = {
  kind: 'action';
  actionKey: string;
  sliceId: string;
  epicId: string;
  /** Single fixed output set. */
  outputs: string[];
  /** Place to return a fresh agent-resource token to. */
  agentReturnPlace?: string;
};

/**
 * Sibling passthrough — consumes a report-bearing token from an intermediate
 * place, evaluates its enabling guard against the token's attached report,
 * and (when enabled) emits to a single fixed output set. Pairs of siblings
 * over one intermediate place implement Petri-net-faithful branching:
 * complementary guards ensure exactly one sibling is enabled per token.
 *
 * Optional `onFire` declares a side effect the sibling performs in addition
 * to forwarding the token. Variants:
 *   - `mark-epic-completed` — used by the verify-epic pass sibling to record
 *     the epic outcome in `ctx.epicOutcomes`.
 *   - `attach-halt-reason` — used by halt-emitting siblings (e.g. the
 *     verify-epic fail sibling) to stamp `haltReason` on the forwarded
 *     token so the engine can surface it via `result.reason`. The sibling
 *     emits to a halted:* place (FE-761 Slice 2b: halted-as-place).
 */
type SiblingPassthroughDescriptor = {
  kind: 'sibling-passthrough';
  sliceId: string;
  epicId: string;
  /** The intermediate place this sibling reads from. */
  input: string;
  /** Fixed output set this sibling emits to when enabled. */
  outputs: string[];
  /** Predicate evaluated against the token's attached report. */
  enablingGuard: EnablingGuard;
  /** Optional fire-time side effect (epic completion mark / halt reason). */
  onFire?: { kind: 'mark-epic-completed' } | { kind: 'attach-halt-reason'; reason: string };
};

/**
 * Test runner with retry budget — producer. Runs tests synchronously,
 * attaches the test-run report to the output token, and emits to a single
 * intermediate place plus the retry-budget place. Sibling-passthrough
 * transitions downstream route by the report's `passed` field. On budget
 * exhaustion the producer instead emits a halt token (carrying its own
 * `haltReason`) to `slice:<sid>:halted` — FE-761 Slice 2b: halted-as-place.
 */
type RunTestsDescriptor = {
  kind: 'run-tests';
  sliceId: string;
  epicId: string;
  target: string;
  /** Single intermediate output place; siblings route from here. */
  intermediatePlace: string;
  /** Place to emit the (decremented or reset) retry-budget token to. */
  budgetPlace: string;
  maxRetries: number;
};

/**
 * Semantic assessment with rework budget — producer. Runs assessment
 * synchronously, attaches the assess-semantic report to the output token,
 * and emits to a single intermediate place. On rejection the budget place
 * receives an incremented rework token; on satisfaction the budget is
 * consumed and not returned. Sibling-passthrough transitions downstream
 * route by the report's `satisfied` field. On rework-budget exhaustion the
 * producer instead emits a halt token (carrying its own `haltReason`) to
 * `slice:<sid>:halted` — FE-761 Slice 2b: halted-as-place.
 */
type AssessSemanticDescriptor = {
  kind: 'assess-semantic';
  actionKey: string;
  sliceId: string;
  epicId: string;
  /** Single intermediate output place; siblings route from here. */
  intermediatePlace: string;
  /** Place to emit the (incremented) rework-budget token to on rejection. */
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

/**
 * Verify epic — producer. Runs verification synchronously against the
 * merged epic sandbox, attaches the verify-epic report to the output
 * token, and emits to a single intermediate place. Sibling-passthrough
 * transitions downstream route by the report's `passed` field — pass
 * marks the epic completed and emits done + dep-signals; fail halts.
 */
type VerifyEpicDescriptor = {
  kind: 'verify-epic';
  actionKey: string;
  epicId: string;
  /** A representative slice for ActionContext. */
  representativeSliceId: string;
  /** Single intermediate output place; siblings route from here. */
  intermediatePlace: string;
};

export type HandlerDescriptor =
  | PassthroughDescriptor
  | ActionDescriptor
  | SiblingPassthroughDescriptor
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
//
// Limitation by design (I125-K): this enumerates nominal declarative outputs
// from the current HandlerDescriptor shape. It does not model halt outputs
// produced inside budget-exhaustion / verify-failure closures, nor token
// transforms such as reportId attachment or counter propagation. Future
// behavior oracles that need halt/dead-end precision should add explicit
// declarative halt enumeration rather than inferring it from this helper alone.
// ---------------------------------------------------------------------------

export function enumerateCandidateOutputs(transition: TransitionSkeleton): Set<string> {
  const out = new Set<string>();
  const h = transition.handler;
  switch (h.kind) {
    case 'passthrough':
      for (const o of h.outputs) out.add(o.place);
      return out;
    case 'action':
      for (const p of h.outputs) out.add(p);
      if (h.agentReturnPlace) out.add(h.agentReturnPlace);
      return out;
    case 'sibling-passthrough':
      for (const p of h.outputs) out.add(p);
      return out;
    case 'run-tests':
      out.add(h.intermediatePlace);
      out.add(h.budgetPlace);
      return out;
    case 'assess-semantic':
      out.add(h.intermediatePlace);
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
      out.add(h.intermediatePlace);
      return out;
  }
}
