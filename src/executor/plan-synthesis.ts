import { parseCandidatePlan, type CandidatePlan } from './candidate-plan.js';
import type { CapabilityProvider } from './capability-providers.js';
import {
  orderSlicesByDependencies,
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
}): Promise<SynthesizePlanResult> {
  const history: SynthesisRound[] = [];
  let findings: readonly PlanValidationFinding[] = [];
  let priorCandidate: unknown;

  for (let round = 0; round <= PLAN_REPAIR_ROUND_LIMIT; round += 1) {
    const synthesis = await args.planner.synthesize({
      projection: args.projection,
      ...(round > 0 ? { findings, priorCandidate } : {}),
      ...(args.runtime ? { runtime: args.runtime } : {}),
    });
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
      return {
        status: 'admitted',
        candidate: parsed.candidate,
        draft: lowerCandidatePlan(parsed.candidate, args.projection),
        executionContract: validation.executionContract,
        history,
      };
    }
  }

  return { status: 'blocked', findings, history };
}

function lowerCandidatePlan(candidate: CandidatePlan, projection: PlanningProjection): ExecutablePlanDraft {
  const requirementById = new Map(projection.requirements.map((item) => [item.itemId, item]));
  const criterionById = new Map(projection.criteria.map((item) => [item.itemId, item]));
  const scopeItemById = new Map(
    projection.scopes.flatMap((scope) =>
      [...scope.design, ...scope.verification].map((item) => [item.itemId, item] as const),
    ),
  );

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
      const item = scopeItemById.get(itemId);
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
  const orderedSlices = orderSlicesByDependencies(slices);

  return {
    schemaVersion: 2,
    specId: candidate.specId,
    mode: projection.mode,
    epics: candidate.epics.map((epic) => ({
      id: epic.id,
      title: epic.title,
      sliceIds: orderedSlices.filter((slice) => slice.epicId === epic.id).map((slice) => slice.id),
      dependsOn: epic.dependsOn,
      verification: epic.verificationCriterionIds.flatMap((criterionId) => {
        const criterion = criterionById.get(criterionId);
        return criterion
          ? [{ kind: 'criterion' as const, criterionId: criterion.itemId, target: criterion.content }]
          : [];
      }),
    })),
    slices: orderedSlices,
    sideEffects: [],
  };
}
