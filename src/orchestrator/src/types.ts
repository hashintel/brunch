// ---------------------------------------------------------------------------
// Plan model — epics → slices (YAML-derived)
// ---------------------------------------------------------------------------

export type Verification = {
  kind: string;
  target: string;
};

export type Epic = {
  id: string;
  summary: string;
  depends_on: string[];
  verification: Verification[];
};

export type Slice = {
  id: string;
  epic_id: string;
  definition: string;
  depends_on: string[];
  verification: Verification[];
};

export type Plan = {
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

export type TestResult = {
  passed: boolean;
  output: string;
};

export interface TestRunner {
  run(target: string, sandboxDir: string): Promise<TestResult>;
}

// ---------------------------------------------------------------------------
// Orchestrator seam
// ---------------------------------------------------------------------------

export type RunPolicy = {
  maxRetries: number;
  /** Maximum semantic rework cycles per slice before halting. Defaults to maxRetries. */
  maxSemanticReworks?: number;
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
  /**
   * 'fixture' (default): per-slice worktrees are created empty. Greenfield.
   * 'codebase': per-slice worktrees are real `git worktree`s on slice-level
   *   branches (`cook/<runId>/<sliceId>`) off the run-level cook branch,
   *   with untracked/gitignored content CoW-copied from the parent. Brownfield.
   */
  sandboxMode?: 'fixture' | 'codebase';
  /**
   * Required in `codebase` mode: the run id used to name slice-level branches
   * (`cook/<runId>/<sliceId>`). Unused in fixture mode.
   */
  runId?: string;
  /**
   * Optional run directory (e.g. `<baseDir>/.cook/runs/<runId>/`). When set,
   * the orchestrator writes the Petrinaut-format compiled net to
   * `<runDir>/net.json` after `compileTopology` returns (FE-762). Tests and
   * library callers that do not need on-disk export can omit it.
   */
  runDir?: string;
  /**
   * Which `NetFolding` constructor to use for Petrinaut export and the live
   * event stream (FE-764). `'identity'` (default) keeps the unfolded per-slice
   * net; `'color'` collapses N structurally-identical slice subnets and carries
   * slice identity on the token color. Ignored when `runDir` is absent.
   */
  petrinautFold?: 'color' | 'identity';
  /**
   * In-process fan-out for the Petrinaut event stream (FE-764 slice 3a).
   * When set, every event the engine emits is forwarded to this callback so
   * an out-of-band consumer (e.g. `createPetrinautStreamBus` feeding the
   * cook's `/stream` SSE endpoint) can subscribe without the engine knowing
   * the consumer exists. Ignored when `runDir` is absent. File output to
   * `petrinaut-events.jsonl` is unaffected.
   */
  onPetrinautEvent?: (event: import('./petrinaut-events.js').PetrinautEvent) => void;
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
 * FE-761 Slice 2b: `halted` / `haltReason` retired. Halt is now observable
 * via the petri-net's `:halted` place tokens (see `PetriNet.hasHaltToken()`),
 * and the halt reason is carried on the halt token itself
 * (`Token.haltReason`). The engine derives both from the net rather than
 * mutating ctx in a fire closure.
 */
export type RunCtx = {
  reportIds: string[];
  sliceOutcomes: Map<string, SliceOutcome>;
  epicOutcomes: Map<string, EpicOutcome>;
  warnings?: string[];
};
