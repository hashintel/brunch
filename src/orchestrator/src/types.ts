// ---------------------------------------------------------------------------
// Plan model — epics → slices (YAML-derived)
// ---------------------------------------------------------------------------

import type { MarkingSnapshot } from './petri-net.js';
import type { ProfileId } from './project-profile.js';

export type Verification = {
  kind: string;
  target: string;
};

export type Epic = {
  id: string;
  summary: string;
  depends_on: string[];
  verification: Verification[];
  /**
   * Integration-oracle (FE-876) reachability target — a *concrete* probe
   * (boot argv + paths). When present it is used directly; this is the Half-A
   * path (fixtures / explicit targets). `not-reachable` is the FE-800 orphan
   * (code merged but never wired into the running app). Absent + no
   * `reachability` → unit-test verdict only (unchanged behavior).
   */
  probe?: ProbeTarget;
  /**
   * Integration-oracle (FE-876) Half B — host-blind reachability *intent* the
   * architect emits (D160-K: planning stays host-blind). Cook-time grounding
   * resolves it into a concrete `ProbeTarget` by reading the worktree, via the
   * injected `ProbeGrounder` (the dispatch-seam piece). `probe` takes precedence
   * when both are set; intent without an injected grounder is a no-op (the
   * grounder lands with the pi-harness contract).
   */
  reachability?: ReachabilityIntent;
};

/**
 * A host-blind description of what must be reachable once the feature is wired,
 * e.g. "the GET /health endpoint returns 200 and the new feature route
 * responds". The architect emits this without knowing the boot command or port;
 * cook-time grounding turns it into a concrete `ProbeTarget`.
 */
export type ReachabilityIntent = {
  feature: string;
};

/**
 * Cook-time grounding seam (FE-876 Half B, dispatch seam): resolve a host-blind
 * `ReachabilityIntent` into a concrete `ProbeTarget` by reading the merged
 * worktree. Injected into `createPiActions` so the agent dispatch is swappable
 * and tests can stub it; the production implementation (an `execute`-mode agent
 * that reads the worktree) lands with the pi-harness contract.
 */
export type ProbeGrounder = (intent: ReachabilityIntent, sandboxDir: string) => Promise<ProbeTarget>;

export type Slice = {
  id: string;
  epic_id: string;
  definition: string;
  depends_on: string[];
  verification: Verification[];
  /**
   * Repo-relative POSIX file paths this slice exclusively mutates (exact
   * paths only — no globs, no directories). Optional until file-layout
   * authoring lands. Used by the executability contract to enforce
   * single-writer-per-file: a path declared by ≥2 slices is a design-class
   * `file-write-conflict` (never auto-repaired). A "join slice" is simply the
   * sole writer of a shared coordination file (e.g. `src/index.ts`) that
   * `depends_on` the slices it joins — not an exception to single-writer.
   */
  writes?: string[];
  /**
   * Spec requirement refs this slice contributes to (slice-id space, e.g.
   * `req-51`), matching `PlanSpec.requirements[].item_id`. The architect
   * authors `derivedFrom`; materialization filters it to known requirement
   * ids and preserves it here so a post-hoc projector can map execution back
   * onto spec requirements without a DB read (FE-885 spec-execution
   * observability). **Inert to execution** — the net compiler/interpreter
   * ignore it; only the progress projector reads it. Optional: authored /
   * legacy fixture plans omit it.
   */
  derived_from?: string[];
};

/**
 * A normalized snapshot of the spec items a plan was emitted from, carried on
 * `Plan.spec` so a cook run can be projected back onto the spec's intent graph
 * without re-reading the DB (FE-885). The orchestrator package stays pure of
 * `@/server/*`; the server-side builder supplies the snapshot at emit time.
 *
 * Item ids live in slice-id space (`req-<id>` / `crit-<id>`) so they line up
 * with `Slice.derived_from`; the numeric DB id is the prefix-stripped suffix,
 * which the consuming server uses to prefer live DB prose over the embedded
 * `content` snapshot. **Inert to execution.**
 */
export type PlanSpecRequirement = {
  item_id: string;
  content: string;
};

export type PlanSpecCriterion = {
  item_id: string;
  content: string;
  /** Requirement item ids this criterion verifies (`req-<id>` refs). */
  verifies: string[];
};

export type PlanSpec = {
  spec_id: string;
  requirements: PlanSpecRequirement[];
  criteria: PlanSpecCriterion[];
};

/**
 * Greenfield vs brownfield is spec-derived plan truth, not a function of
 * where the plan file sits on disk. `brunch plan <specId>` writes the
 * specification's mode here; `brunch cook` reads it to decide the worktree
 * strategy (greenfield → empty worktree; brownfield → clone the cwd repo).
 * Authored fixture plans omit it and load as `greenfield`.
 */
export type PlanMode = 'greenfield' | 'brownfield';

export type Plan = {
  mode: PlanMode;
  /**
   * Spec-derived toolchain profile id (see `project-profile.ts`). Resolved
   * to a `Toolchain` via `resolveToolchain(plan.profile)`; absent → bun.
   */
  profile?: ProfileId;
  /**
   * Architect-supplied harness prior-art (FE-894 ①): concise project build/
   * framework seams (code-split→router wiring, headless-render limits, etc.)
   * injected into every slice/epic agent task so agents apply it instead of
   * rediscovering it per slice. Absent → tasks are unchanged.
   */
  harnessNotes?: string;
  /**
   * Normalized snapshot of the spec items this plan was emitted from, so a
   * cook run can be projected back onto the spec's intent graph without a DB
   * read (FE-885). **Inert to execution** — the compiler/interpreter ignore
   * it. Optional: authored / legacy fixture plans omit it.
   */
  spec?: PlanSpec;
  epics: Epic[];
  slices: Slice[];
};

// ---------------------------------------------------------------------------
// Reports — append-only communication medium
// ---------------------------------------------------------------------------

export type ReportLine = {
  id: string;
  ts: string;
  epicId: string;
  sliceId: string;
  actor: string;
  event: string;
  payload: Record<string, unknown>;
};

export interface ReportSink {
  append(line: ReportLine): void;
  getById(id: string): ReportLine | undefined;
  getAll(): ReportLine[];
}

// ---------------------------------------------------------------------------
// Action dispatch — inline handlers (registry deferred per §12)
// ---------------------------------------------------------------------------

export type ActionContext = {
  slice: Slice;
  epic: Epic;
  plan: Plan;
  sandboxDir: string;
  reports: ReportSink;
};

/** Handler appends a report line and returns its id. */
export type ActionHandler = (ctx: ActionContext) => Promise<string>;

export type ActionHandlers = Record<string, ActionHandler>;

// ---------------------------------------------------------------------------
// Test runner — deterministic, orchestrator-owned
// ---------------------------------------------------------------------------

/**
 * Why a non-passing test run did not pass.
 * - `infra`  = the toolchain itself broke (runner binary missing / deps never
 *   installed) — a different fix than `test`.
 * - `test`   = the code under test failed its assertions (a genuine red,
 *   including a TDD red importing source that does not exist yet).
 * - `absent` = the runner matched **zero test files** ("No test files found").
 *   This is "not built yet", not a failure: the greenfield evaluate gate fires
 *   before the target test exists. Distinguishing it from `test` stops every
 *   clean slice from logging a phantom ✗ NEEDS WORK + a consumed attempt.
 *
 * Distinguishing these stops the cook loop from sending the code-writer to "fix
 * the code" when nothing was ever installed or nothing has been built yet
 * (`TestResult.passed` alone collapsed all three into one failure).
 */
export type TestFailureKind = 'infra' | 'test' | 'absent';

export type TestResult = {
  passed: boolean;
  output: string;
  /** Set only when `passed` is false; classifies the failure. */
  failureKind?: TestFailureKind;
};

export interface TestRunner {
  run(target: string, sandboxDir: string): Promise<TestResult>;
}

/** One verification target's outcome: its id plus the runner's `TestResult`. */
export type VerificationResult = { target: string } & TestResult;

/**
 * The verdict over a set of verification targets. `done` is the single oracle
 * rule — at least one target and every target passing (no requisite variety
 * otherwise). `failureKind` is the aggregate over the failed targets: `infra`
 * (the toolchain broke) dominates a plain `test` failure, because a run that
 * never executed is the actionable signal. Undefined when `done`.
 */
export type VerificationOutcome = {
  done: boolean;
  failureKind?: TestFailureKind;
  results: VerificationResult[];
};

// ---------------------------------------------------------------------------
// App runtime probe — real *app* execution, the analogue of test execution
// ---------------------------------------------------------------------------

/**
 * The verdict of booting the host app and exercising one feature endpoint:
 * - `reachable`     — the app answered the feature probe (wired into the running app)
 * - `not-reachable` — the app booted but the feature endpoint is absent (the
 *                     FE-800 orphan: a module that exists but isn't wired in)
 * - `infra`         — the app never booted / never became ready (a different
 *                     fix than "feature absent", mirroring `TestFailureKind`)
 */
export type ProbeOutcomeKind = 'reachable' | 'not-reachable' | 'infra';

/**
 * What the probe needs to boot + exercise an app. The boot argv and URLs are
 * **inputs** (later supplied by cook-time grounding), not a per-stack boot
 * engine — the harness owns the deterministic check, the boot mechanics may
 * lean on the agent's `bash`.
 */
export type ProbeSpec = {
  /** Argv that boots the app in the sandbox (e.g. `['node','server.js']`). */
  boot: readonly string[];
  /** URL polled until the app accepts connections (any HTTP response = ready). */
  readyUrl: string;
  /** URL whose response decides feature reachability. */
  featureUrl: string;
  /** Extra env for the boot process (e.g. a chosen `PORT`). */
  env?: Record<string, string>;
};

/**
 * The harness-resolvable shape of a probe: boot argv + the *paths* to poll and
 * exercise, before a concrete port is bound. `buildProbeSpec` turns this into a
 * `ProbeSpec` by allocating a free port — the deterministic, harness-owned piece
 * (a hardcoded port collides under parallel cook). Cook-time grounding later
 * supplies the argv + paths; the harness never guesses them.
 */
export type ProbeTarget = {
  /** Argv that boots the app in the sandbox (e.g. `['node','server.js']`). */
  boot: readonly string[];
  /** Path polled until the app accepts connections (e.g. `/health`). */
  readyPath: string;
  /** Path whose response decides feature reachability (e.g. `/feature`). */
  featurePath: string;
  /** Extra env for the boot process; the allocated `PORT` is added on top. */
  env?: Record<string, string>;
};

export type ProbeResult = {
  kind: ProbeOutcomeKind;
  /** Convenience: `kind === 'reachable'`. */
  reachable: boolean;
  /** HTTP status of the feature probe, when the app answered. */
  status?: number;
  /** Boot output + diagnostics, for the run report. */
  output: string;
};

// ---------------------------------------------------------------------------
// Orchestrator seam
// ---------------------------------------------------------------------------

export type RunPolicy = {
  maxRetries: number;
  /** Maximum semantic rework cycles per slice before halting. Defaults to maxRetries. */
  maxSemanticReworks?: number;
  /** FE-884 Slice B: max epic verify re-runs on an infra/timeout failure before
   *  halting (toolchain blips are re-run, not remediated). Defaults to maxRetries. */
  maxInfraRetries?: number;
  /** Number of tokens per shared agent pool (test-agent, code-agent).
   *  Defaults to slice count (unbounded — one token per slice). */
  agentPoolSize?: number;
};

export type OrchestratorInput = {
  plan: Plan;
  sandboxDir: string;
  actions: ActionHandlers;
  reports: ReportSink;
  testRunner: TestRunner;
  policy: RunPolicy;
  /** Ephemeral presentation events for live CLI surfaces (non-durable). */
  emit?: (event: import('./presenter/events.js').CookEvent) => void;
  /**
   * 'fixture' (default): per-slice worktrees are created empty. Greenfield.
   * 'codebase': per-slice worktrees are real `git worktree`s on slice-level
   *   branches (`brunch/slice/<runId>/<sliceId>`, via `brunchRef.slice`) off the
   *   run-level `brunch/run/<runId>` branch, with untracked/gitignored content
   *   CoW-copied from the parent. Brownfield.
   */
  sandboxMode?: 'fixture' | 'codebase';
  /**
   * 'per-slice' (default): each slice runs in its own dir (greenfield) or git
   *   worktree (codebase), merged into `__epic__/<epicId>/` for verification.
   * 'shared': all slices accrete into the single run sandbox; verify-epic runs
   *   in place, no per-slice dirs, no merge. Only valid for serial greenfield.
   */
  sliceLayout?: 'shared' | 'per-slice';
  /**
   * Required in `codebase` mode: the run id used to name slice-level branches
   * (`cook/<runId>/<sliceId>`). Unused in fixture mode.
   */
  runId?: string;
  /**
   * Optional run directory (e.g. `<baseDir>/.cook/runs/<runId>/`). When set,
   * the orchestrator writes the Petrinaut-format compiled net to
   * `<runDir>/net.json` after `compileTopology` returns. Tests and library
   * callers that do not need on-disk export can omit it.
   */
  runDir?: string;
  /**
   * Which `NetFolding` constructor to use for Petrinaut export and the live
   * event stream. `'identity'` (default) keeps the unfolded per-slice net;
   * `'color'` collapses N structurally-identical slice subnets and carries
   * slice identity on the token color. Ignored when `runDir` is absent.
   */
  petrinautFold?: 'color' | 'identity';
  /**
   * Lane projection for Petrinaut export + the live stream (FE-819 Card E).
   * `'both'` (default) renders the full net; `'mechanical'` suppresses the
   * semantic lane (drops `assess-semantic:*` / `semantic-*`, bridges
   * `done-spec → completed`) for a smaller demo graph. Projection only —
   * execution always runs the full net. Ignored when `runDir` is absent.
   */
  petrinautLanes?: 'both' | 'mechanical';
  /**
   * In-process fan-out for the Petrinaut event stream. When set, every event
   * the engine emits is forwarded to this callback so an out-of-band consumer
   * (e.g. `createPetrinautStreamBus` feeding the cook's `/stream` SSE
   * endpoint) can subscribe without the engine knowing the consumer exists.
   * Ignored when `runDir` is absent. File output to `petrinaut-events.jsonl`
   * is unaffected.
   */
  onPetrinautEvent?: (event: import('./petrinaut-events.js').PetrinautEvent) => void;
  /**
   * Awaited setup hook for the Petrinaut live-stream surface. Called once per
   * run after `compileTopology` builds the `SdcpnFile` and **before** the
   * engine emits the first `initial_marking` event, so the caller can stand up
   * an SSE server (or any other async sink) bound to the run's net. The
   * returned callback (if any) is fanned out alongside `onPetrinautEvent`.
   * Ignored when `runDir` is absent.
   *
   * Lifecycle contract: the hook is `await`ed; an error rejects `engine.run`
   * before any firing happens.
   */
  setupPetrinautStream?: (input: {
    runId: string;
    sdcpnFile: import('./petrinaut-sdcpn.js').SdcpnFile;
  }) => Promise<((event: import('./petrinaut-events.js').PetrinautEvent) => void) | undefined>;
  /** durable-resume: re-enter a halted/paused run — seed bookkeeping + `restoreMarking` after `wireHandlers`. Plan/policy must match the snapshot's run (same topology). */
  resume?: RunSnapshot;
  /** durable-resume: external pause signal — the interpreter drains in-flight deferred work then stops at a quiescent point (persisting a snapshot if `runDir` set). When to pause is `interactive-recovery`'s job. */
  shouldPause?: () => boolean;
};

/**
 * Everything needed to resume a stopped run: the marking at the stop point plus
 * the outcomes/reportIds accrued before it, so a resumed result reflects the
 * whole run, not just the tail. Quiescent markings only.
 */
export type RunSnapshot = {
  marking: MarkingSnapshot;
  slices: SliceOutcome[];
  epics: EpicOutcome[];
  reportIds: string[];
};

export type EpicOutcome = {
  epicId: string;
  status: 'completed' | 'halted';
};

export type SliceOutcome = {
  sliceId: string;
  status: 'completed' | 'halted';
};

export type OrchestratorResult = {
  status: 'completed' | 'halted';
  reason?: string;
  warnings: string[];
  reports: string[];
  epics: EpicOutcome[];
  slices: SliceOutcome[];
};

export interface Orchestrator {
  run(input: OrchestratorInput): Promise<OrchestratorResult>;
}

// ---------------------------------------------------------------------------
// Mutable run context — orchestrator-execution bookkeeping
// ---------------------------------------------------------------------------

/**
 * `halted` / `haltReason` retired from the mutable context. Halt is now
 * observable via the petri-net's `:halted` place tokens (see
 * `PetriNet.hasHaltToken()`), and the halt reason is carried on the halt
 * token itself (`Token.haltReason`). The engine derives both from the net
 * rather than mutating ctx in a fire closure.
 */
export type RunCtx = {
  reportIds: string[];
  sliceOutcomes: Map<string, SliceOutcome>;
  epicOutcomes: Map<string, EpicOutcome>;
  warnings?: string[];
};
