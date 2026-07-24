import { assertExecutablePlanDraftVersion, type ExecutablePlanDraft } from './executable-plan-draft.js';
import type { ExecutionContract } from './execution-contract.js';

export interface PlanPreviewVerificationTarget {
  readonly kind: 'criterion';
  readonly criterionId: string;
  readonly target: string;
}

export interface PlanPreviewSpecRequirement {
  readonly item_id: string;
  readonly title?: string;
  readonly content: string;
}

export interface PlanPreviewSpecCriterion {
  readonly item_id: string;
  readonly content: string;
  readonly verifies: readonly string[];
}

export interface PlanPreviewSpec {
  readonly spec_id: string;
  readonly requirements: readonly PlanPreviewSpecRequirement[];
  readonly criteria: readonly PlanPreviewSpecCriterion[];
}

export interface PlanPreviewEpic {
  readonly id: string;
  readonly summary: string;
  readonly depends_on: readonly string[];
  readonly verification: readonly PlanPreviewVerificationTarget[];
  // Old cook Plan also accepts `probe` and `reachability`, but the alpha draft
  // has no truthful boot/probe or host-blind reachability source yet.
}

export interface PlanPreviewSlice {
  readonly id: string;
  readonly epic_id?: string;
  readonly scope_id?: string;
  readonly definition: string;
  readonly depends_on: readonly string[];
  readonly verification: readonly PlanPreviewVerificationTarget[];
  readonly derived_from: readonly string[];
  readonly design_context?: readonly { readonly item_id: string; readonly content: string }[];
  readonly verification_context?: readonly { readonly item_id: string; readonly content: string }[];
  // Old cook Plan also accepts `writes`, but the alpha draft has no file-layout
  // authoring source yet. Keep it absent instead of inventing ownership.
}

export interface PlanPreview {
  readonly schemaVersion: 2;
  readonly mode: ExecutablePlanDraft['mode'];
  readonly scope_handoff_required: boolean;
  readonly spec: PlanPreviewSpec;
  readonly epics: readonly PlanPreviewEpic[];
  readonly slices: readonly PlanPreviewSlice[];
  readonly execution_contract?: ExecutionContract;
  readonly sideEffects: readonly [];
  // Old cook Plan also accepts `profile` and `harnessNotes`; the plan-owned
  // execution contract (FE-1197) supersedes the deferred `profile` slot.
}

export function previewPlan(
  draft: ExecutablePlanDraft,
  options?: { readonly executionContract?: ExecutionContract },
): PlanPreview {
  assertExecutablePlanDraftVersion(draft);
  return {
    schemaVersion: 2,
    mode: draft.mode,
    ...(options?.executionContract ? { execution_contract: options.executionContract } : {}),
    scope_handoff_required: draft.slices.some((slice) => slice.scopeId !== undefined),
    spec: previewSpec(draft),
    epics: draft.epics.map((epic) => ({
      id: epic.id,
      summary: epic.title,
      depends_on: epic.dependsOn,
      verification: epic.verification.map((target) => ({
        kind: target.kind,
        criterionId: target.criterionId,
        target: target.target,
      })),
    })),
    slices: draft.slices.map((slice) => ({
      id: slice.id,
      ...(slice.epicId === undefined ? {} : { epic_id: slice.epicId }),
      ...(slice.scopeId ? { scope_id: slice.scopeId } : {}),
      definition: slice.definition,
      depends_on: slice.dependsOn,
      verification: slice.verification.map((target) => ({
        kind: target.kind,
        criterionId: target.criterionId,
        target: target.target,
      })),
      derived_from: slice.requirementIds,
      ...(slice.designContext.length > 0
        ? {
            design_context: slice.designContext.map((item) => ({
              item_id: item.itemId,
              content: item.content,
            })),
          }
        : {}),
      ...(slice.verificationContext.length > 0
        ? {
            verification_context: slice.verificationContext.map((item) => ({
              item_id: item.itemId,
              content: item.content,
            })),
          }
        : {}),
    })),
    sideEffects: [],
  };
}

export function assertPlanPreviewVersion(preview: Pick<PlanPreview, 'schemaVersion'>): void {
  if (preview.schemaVersion !== 2) {
    throw new Error(`Unsupported plan preview schema version: ${String(preview.schemaVersion)}`);
  }
}

function previewSpec(draft: ExecutablePlanDraft): PlanPreviewSpec {
  const requirements = new Map<string, PlanPreviewSpecRequirement>();
  const criteria = new Map<string, PlanPreviewSpecCriterion>();

  for (const slice of draft.slices) {
    const scopedRequirements =
      slice.requirements && slice.requirements.length > 0
        ? slice.requirements
        : slice.requirementIds.map((requirementId) => ({
            itemId: requirementId,
            content: slice.definition,
          }));
    for (const requirement of scopedRequirements) {
      if (!requirements.has(requirement.itemId)) {
        requirements.set(requirement.itemId, {
          item_id: requirement.itemId,
          ...('title' in requirement ? { title: requirement.title } : {}),
          content: requirement.content,
        });
      }
    }

    for (const target of slice.verification) {
      const verifies = target.verifies && target.verifies.length > 0 ? target.verifies : slice.requirementIds;
      const existing = criteria.get(target.criterionId);
      if (existing) {
        criteria.set(target.criterionId, {
          ...existing,
          verifies: Array.from(new Set([...existing.verifies, ...verifies])),
        });
      } else {
        criteria.set(target.criterionId, {
          item_id: target.criterionId,
          content: target.target,
          verifies: [...verifies],
        });
      }
    }
  }
  for (const epic of draft.epics) {
    for (const target of epic.verification) {
      if (!criteria.has(target.criterionId)) {
        criteria.set(target.criterionId, {
          item_id: target.criterionId,
          content: target.target,
          verifies: [],
        });
      }
    }
  }

  return {
    spec_id: draft.specId,
    requirements: Array.from(requirements.values()),
    criteria: Array.from(criteria.values()),
  };
}
