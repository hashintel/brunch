import { parseCandidatePlan, type CandidatePlan } from './candidate-plan.js';
import { capabilityVocabulary, type CapabilityProvider } from './capability-providers.js';
import {
  assembleExecutablePlanDraft,
  type ExecutablePlanDraft,
  type ExecutablePlanDraftSlice,
} from './executable-plan-draft.js';
import type { CapabilityRequirement, ExecutionContract } from './execution-contract.js';
import type { PlannerPort, PlannerRuntime } from './execution-ports.js';
import { validateCandidatePlan, type PlanValidationFinding } from './plan-validation.js';
import type { PlanningProjection } from './planning-projection.js';

// ceiling: constant repair bound; becomes plan-declared when plans need differentiated
// repair budgets (same trigger as SLICE_ATTEMPT_LIMIT).
export const PLAN_REPAIR_ROUND_LIMIT = 2;
// ceiling: 120s per model round; revisit when live planner telemetry shows valid
// candidates regularly need longer, or move the deadline into admitted policy.
export const PLAN_SYNTHESIS_ROUND_TIMEOUT_MS = 120_000;

export interface PlanSynthesisProgress {
  readonly round: number;
  readonly phase: 'started' | 'repairing' | 'admitted' | 'blocked' | 'timed_out';
}

export interface SynthesisRound {
  readonly round: number;
  readonly findings: readonly PlanValidationFinding[];
}

export type SynthesizePlanResult =
  | {
      readonly status: 'admitted';
      readonly candidate: CandidatePlan;
      readonly draft: ExecutablePlanDraft;
      readonly executionContract: ExecutionContract;
      readonly history: readonly SynthesisRound[];
    }
  | {
      readonly status: 'blocked';
      readonly findings: readonly PlanValidationFinding[];
      readonly history: readonly SynthesisRound[];
    };

// project -> synthesize -> validate -> bounded repair -> admit or block.
// There is deliberately no fallback plan on any path: an unrepaired candidate blocks
// with its exact findings instead of degrading to a trivial projection (FE-1197).
export async function synthesizePlan(args: {
  readonly projection: PlanningProjection;
  readonly detected: readonly CapabilityRequirement[];
  readonly providers: readonly CapabilityProvider[];
  readonly baseRequired?: readonly CapabilityRequirement[];
  readonly planner: PlannerPort;
  readonly runtime?: PlannerRuntime;
  readonly onProgress?: (progress: PlanSynthesisProgress) => void;
}): Promise<SynthesizePlanResult> {
  const history: SynthesisRound[] = [];
  let findings: readonly PlanValidationFinding[] = [];
  let priorCandidate: unknown;

  for (let round = 0; round <= PLAN_REPAIR_ROUND_LIMIT; round += 1) {
    args.runtime?.signal?.throwIfAborted();
    args.onProgress?.({ round, phase: 'started' });
    const outcome = await runPlannerRound(args, round, findings, priorCandidate);
    if (outcome.status === 'timed_out') {
      findings = [
        {
          code: 'planner_timeout',
          severity: 'error',
          message: `Planner round ${round + 1} exceeded ${PLAN_SYNTHESIS_ROUND_TIMEOUT_MS}ms.`,
        },
      ];
      history.push({ round, findings });
      args.onProgress?.({ round, phase: 'timed_out' });
      return { status: 'blocked', findings, history };
    }
    const synthesis = outcome.result;
    args.runtime?.signal?.throwIfAborted();
    if (synthesis.status === 'failed') {
      findings = [
        {
          code: 'malformed_candidate',
          severity: 'error',
          message: `Planner failed: ${synthesis.message}`,
        },
      ];
      history.push({ round, findings });
      priorCandidate = undefined;
      args.onProgress?.({
        round,
        phase: round === PLAN_REPAIR_ROUND_LIMIT ? 'blocked' : 'repairing',
      });
      continue;
    }
    priorCandidate = synthesis.candidate;
    const parsed = parseCandidatePlan(synthesis.candidate);
    if (parsed.status === 'malformed_candidate') {
      findings = [
        {
          code: 'malformed_candidate',
          severity: 'error',
          message: parsed.message,
        },
      ];
      history.push({ round, findings });
      args.onProgress?.({
        round,
        phase: round === PLAN_REPAIR_ROUND_LIMIT ? 'blocked' : 'repairing',
      });
      continue;
    }
    const validation = validateCandidatePlan({
      candidate: parsed.candidate,
      projection: args.projection,
      detected: args.detected,
      providers: args.providers,
      ...(args.baseRequired ? { baseRequired: args.baseRequired } : {}),
    });
    findings = validation.findings;
    history.push({ round, findings });
    if (!findings.some((finding) => finding.severity === 'error')) {
      args.onProgress?.({ round, phase: 'admitted' });
      return {
        status: 'admitted',
        candidate: parsed.candidate,
        draft: lowerCandidatePlan(parsed.candidate, args.projection),
        executionContract: validation.executionContract,
        history,
      };
    }
    args.onProgress?.({
      round,
      phase: round === PLAN_REPAIR_ROUND_LIMIT ? 'blocked' : 'repairing',
    });
  }

  return { status: 'blocked', findings, history };
}

async function runPlannerRound(
  args: Parameters<typeof synthesizePlan>[0],
  round: number,
  findings: readonly PlanValidationFinding[],
  priorCandidate: unknown,
): Promise<
  | { readonly status: 'completed'; readonly result: Awaited<ReturnType<PlannerPort['synthesize']>> }
  | { readonly status: 'timed_out' }
> {
  const controller = new AbortController();
  const parentSignal = args.runtime?.signal;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let onParentAbort: (() => void) | undefined;
  const deadline = new Promise<{ readonly status: 'timed_out' }>((resolve, reject) => {
    timeout = setTimeout(() => {
      resolve({ status: 'timed_out' });
      controller.abort(new Error('planner round timed out'));
    }, PLAN_SYNTHESIS_ROUND_TIMEOUT_MS);
    if (parentSignal) {
      onParentAbort = () => {
        controller.abort(parentSignal.reason);
        reject(parentSignal.reason);
      };
      parentSignal.addEventListener('abort', onParentAbort, { once: true });
    }
  });

  try {
    return await Promise.race([
      args.planner
        .synthesize({
          projection: args.projection,
          capabilityVocabulary: capabilityVocabulary(args.providers),
          ...(round > 0 ? { findings, priorCandidate } : {}),
          runtime: {
            ...(args.runtime?.modelRegistry ? { modelRegistry: args.runtime.modelRegistry } : {}),
            ...(args.runtime?.model ? { model: args.runtime.model } : {}),
            signal: controller.signal,
          },
        })
        .then((result) => ({ status: 'completed' as const, result })),
      deadline,
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
    if (parentSignal && onParentAbort) parentSignal.removeEventListener('abort', onParentAbort);
  }
}

function lowerCandidatePlan(candidate: CandidatePlan, projection: PlanningProjection): ExecutablePlanDraft {
  const requirementById = new Map(projection.requirements.map((item) => [item.itemId, item]));
  const criterionById = new Map(projection.criteria.map((item) => [item.itemId, item]));
  const scopeItemById = new Map(
    projection.scopes.flatMap((scope) =>
      [...scope.design, ...scope.verification].map((item) => [item.itemId, item] as const),
    ),
  );
  const verificationItemById = new Map([
    ...projection.commitments.verification.map((item) => [item.itemId, item] as const),
    ...projection.scopes.flatMap((scope) => scope.verification.map((item) => [item.itemId, item] as const)),
  ]);

  const slices: ExecutablePlanDraftSlice[] = candidate.slices.map((slice) => ({
    id: slice.id,
    epicId: slice.epicId,
    title: slice.title,
    definition:
      slice.doneCriteria.length > 0
        ? `${slice.goal}\n\nDone when:\n${slice.doneCriteria.map((criterion) => `- ${criterion}`).join('\n')}`
        : slice.goal,
    ...(slice.scopeId ? { scopeId: slice.scopeId } : {}),
    requirementId: slice.requirementIds[0]!,
    requirementIds: slice.requirementIds,
    requirements: slice.requirementIds.flatMap((requirementId) => {
      const requirement = requirementById.get(requirementId);
      return requirement
        ? [{ itemId: requirement.itemId, title: requirement.title, content: requirement.content }]
        : [];
    }),
    dependsOn: slice.dependsOn,
    designContext: slice.designItemIds.flatMap((itemId) => {
      const item = scopeItemById.get(itemId);
      return item ? [{ itemId: item.itemId, title: item.title, content: item.content }] : [];
    }),
    verificationContext: slice.verificationItemIds.flatMap((itemId) => {
      const item = verificationItemById.get(itemId);
      return item ? [{ itemId: item.itemId, title: item.title, content: item.content }] : [];
    }),
    verification: slice.criterionIds.flatMap((criterionId) => {
      const criterion = criterionById.get(criterionId);
      return criterion
        ? [
            {
              kind: 'criterion' as const,
              criterionId: criterion.itemId,
              target: criterion.content,
              ...(criterion.verifiesRequirements.length > 0
                ? { verifies: criterion.verifiesRequirements }
                : {}),
            },
          ]
        : [];
    }),
  }));
  return assembleExecutablePlanDraft({
    specId: candidate.specId,
    mode: projection.mode,
    epics: candidate.epics.map((epic) => ({
      id: epic.id,
      title: epic.title,
      dependsOn: epic.dependsOn,
      verification: epic.verificationCriterionIds.flatMap((criterionId) => {
        const criterion = criterionById.get(criterionId);
        return criterion
          ? [{ kind: 'criterion' as const, criterionId: criterion.itemId, target: criterion.content }]
          : [];
      }),
    })),
    slices,
  });
}
