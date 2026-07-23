import {
  appendSliceStageEpoch,
  assertSliceRepairHistory,
  assertSliceRepairPolicy,
  currentRepairCycle,
  DEFAULT_SLICE_REPAIR_POLICY,
  mergeSliceRepairHistory,
  nextArtifactOrdinal,
} from './slice-repair-cycle/model.js';
import {
  activateRepair,
  admitStageReset,
  completeVerification,
  materializeRepair,
  validateActiveRepair,
  validateRepairAuthority,
} from './slice-repair-cycle/protocol.js';
import {
  boundedDiagnostic,
  REPAIR_CONTEXT_LIMIT_BYTES,
  REPAIR_DIAGNOSTIC_LIMIT_BYTES,
  repairContextPath,
} from './slice-repair-cycle/repair-context.js';
import {
  attemptExhaustedTransitionId,
  attemptPlaceId,
  attemptResetTransitionId,
  attemptRetryTransitionId,
  attemptSuccessTransitionId,
  compileSliceRepairTopology,
  sliceIntegrationTransitionId,
  verificationFailedPlaceId,
  verificationPassedPlaceId,
  verifyRepairTransitionId,
  verifyResultPlaceId,
  verifyVerdictTransitionId,
} from './slice-repair-cycle/topology.js';

export type {
  ActiveSliceRepairContext,
  PendingSliceRepair,
  SliceRepairContext,
  SliceRepairCycleRecord,
  SliceRepairDiagnostic,
  SliceRepairHistory,
  SliceRepairHistoryDelta,
  SliceRepairPolicy,
  SliceRepairStage,
  SliceRepairTarget,
  SliceStageEpoch,
} from './slice-repair-cycle/model.js';
export type { CompletedVerificationResolution } from './slice-repair-cycle/protocol.js';
export type { SliceRepairTopologyFragment } from './slice-repair-cycle/topology.js';

export const MAX_REPAIR_CYCLES = DEFAULT_SLICE_REPAIR_POLICY.maxRepairCycles;
export const MAX_STAGE_ATTEMPTS = DEFAULT_SLICE_REPAIR_POLICY.maxStageAttempts;

/** Shared functional protocol used by serial and parallel authority shells. */
export const sliceRepairProtocol = {
  policy: DEFAULT_SLICE_REPAIR_POLICY,
  assertPolicy: assertSliceRepairPolicy,
  assertHistory: assertSliceRepairHistory,
  appendEpoch: appendSliceStageEpoch,
  mergeHistory: mergeSliceRepairHistory,
  currentCycle: currentRepairCycle,
  nextArtifactOrdinal,
  completeVerification,
  validateRepairAuthority,
  materializeRepair,
  activateRepair,
  validateActiveRepair,
  admitReset: admitStageReset,
  boundedDiagnostic,
  contextPath: repairContextPath,
  limits: {
    contextBytes: REPAIR_CONTEXT_LIMIT_BYTES,
    diagnosticBytes: REPAIR_DIAGNOSTIC_LIMIT_BYTES,
  },
} as const;

/** Narrow identity/compiler surface needed by topology and runtime projection. */
export const sliceRepairTopology = {
  compile: compileSliceRepairTopology,
  attemptPlaceId,
  verifyResultPlaceId,
  verificationPassedPlaceId,
  verificationFailedPlaceId,
  attemptRetryTransitionId,
  attemptExhaustedTransitionId,
  attemptResetTransitionId,
  attemptSuccessTransitionId,
  verifyVerdictTransitionId,
  verifyRepairTransitionId,
  integrationTransitionId: sliceIntegrationTransitionId,
} as const;
