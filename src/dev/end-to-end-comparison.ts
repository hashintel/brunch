export {
  assertControllerIsolation,
  EXECUTORS,
  hashEndToEndStudyContract,
  loadEndToEndStudyContract,
  parseEndToEndStudyContract,
  SPEC_SOURCES,
  type EndToEndStudyContract,
  type Executor,
  type SpecSource,
} from './end-to-end-comparison/study-contract.js';
export {
  parseImmutableHandoffRecord,
  sha256Bytes,
  writeImmutableHandoff,
  type ImmutableHandoffRecord,
} from './end-to-end-comparison/handoff-contract.js';
export {
  loadEndToEndMatrix,
  MATRIX_CELL_IDS,
  parseEndToEndMatrixManifest,
  type EndToEndMatrixManifest,
  type LoadedEndToEndMatrix,
  type MatrixCell,
  type MatrixCellId,
} from './end-to-end-comparison/matrix-contract.js';
export {
  parseRequirementLedger,
  parseRequirementRegistry,
  type ElicitationDisposition,
  type EvidenceReference,
  type HandoffDisposition,
  type ImplementationDisposition,
  type RequirementAssessment,
  type RequirementLedger,
  type RequirementLedgerCell,
  type RequirementLedgerRow,
  type RequirementOrigin,
  type RequirementRegistry,
  type VerificationDisposition,
} from './end-to-end-comparison/traceability-contract.js';
export {
  redactRequirementLedger,
  type AudienceSafeRequirementLedger,
} from './end-to-end-comparison/redaction.js';
export { prepareBrunchExecutionCell, type ExecutionLaunch } from './end-to-end-comparison/brunch-adapter.js';
export {
  finalizeClaudeExecutionWorkspace,
  prepareClaudeExecutionWorkspace,
  runClaudeExecutionWorkspace,
  type ClaudeExecutionRun,
  type PreparedClaudeExecutionWorkspace,
} from './end-to-end-comparison/claude-adapter.js';
export { retainExecutionCell } from './end-to-end-comparison/execution-cell.js';
export {
  admitHistoricalReplay,
  assertTargetBoundedPath,
  createBrunchSolutionIsolationPolicy,
  createClaudeSolutionIsolationPolicy,
  createNetworkDeniedCommandRunner,
  materializePinnedSourceTree,
  SolutionIsolationAdmissionError,
  type BrunchSolutionIsolationPolicy,
  type ClaudeSolutionIsolationPolicy,
  type IsolationAdmissionReason,
  type MaterializedPinnedSourceTree,
  type NetworkDeniedCommandRunner,
  type SolutionIsolationPolicy,
} from './end-to-end-comparison/solution-isolation.js';
