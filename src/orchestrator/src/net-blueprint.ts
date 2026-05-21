// ---------------------------------------------------------------------------
// NetBlueprint — pure declarative net shape, no closures or runtime refs.
// Produced by compileTopology(); consumed by wireHandlers().
// ---------------------------------------------------------------------------

import type { TransitionContract } from './petri-net.js';

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
 * Call an action handler, optionally route on a report payload field.
 * Covers: evaluate, write-tests, write-code.
 */
type ActionDescriptor = {
  kind: 'action';
  actionKey: string;
  sliceId: string;
  epicId: string;
  /** If set, read report.payload[routeField] to decide routing. */
  routeField?: string;
  /** Places to emit to when routeField is truthy (or always, if no routeField). */
  onTrue: string[];
  /** Places to emit to when routeField is falsy. */
  onFalse: string[];
  /** Place to return a fresh agent-resource token to. */
  agentReturnPlace?: string;
};

/** Test runner with retry budget — 3-way routing. */
type RunTestsDescriptor = {
  kind: 'run-tests';
  sliceId: string;
  epicId: string;
  target: string;
  onPass: string[];
  onFail: string[];
  budgetPlace: string;
};

/** Semantic assessment with rework budget. */
type AssessSemanticDescriptor = {
  kind: 'assess-semantic';
  actionKey: string;
  sliceId: string;
  epicId: string;
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
