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
  worktreeDir: string;
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
  run(target: string, worktreeDir: string): Promise<TestResult>;
}

// ---------------------------------------------------------------------------
// Orchestrator seam
// ---------------------------------------------------------------------------

export type RunPolicy = {
  maxRetries: number;
  /** Maximum semantic rework cycles per slice before halting. Defaults to maxRetries. */
  maxSemanticReworks?: number;
};

export type OrchestratorInput = {
  plan: Plan;
  worktreeDir: string;
  actions: ActionHandlers;
  reports: ReportSink;
  testRunner: TestRunner;
  policy: RunPolicy;
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

export type RunCtx = {
  reportIds: string[];
  sliceOutcomes: Map<string, SliceOutcome>;
  epicOutcomes: Map<string, EpicOutcome>;
  halted: boolean;
  haltReason?: string;
};
